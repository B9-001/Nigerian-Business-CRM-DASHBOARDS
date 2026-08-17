import 'server-only'
import OpenAI from 'openai'
import type { AICompletionResult, AIMessage, AIProvider, AIToolCall, AIToolSchema } from './types'
import { AIProviderNotConfiguredError } from './types'

/**
 * OpenAI provider. Uses the Chat Completions API (function-calling + streaming)
 * which is stable across the installed SDK version. For web research
 * (CLAUDE.md #21), swap `webSearch: true` to route through the Responses
 * API's built-in `web_search` tool once the deployed `openai` SDK version is
 * confirmed to support it — the interface here is written so that's a
 * provider-internal change, not a call-site change.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai' as const
  readonly supportsWebSearch = true
  readonly supportsTools = true

  private client(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new AIProviderNotConfiguredError('OpenAI')
    return new OpenAI({ apiKey })
  }

  private toOpenAIMessages(messages: AIMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map((m) => {
      if (m.role === 'tool') {
        return { role: 'tool', content: m.content, tool_call_id: m.toolCallId ?? '' }
      }
      return { role: m.role, content: m.content } as OpenAI.Chat.ChatCompletionMessageParam
    })
  }

  async complete(
    messages: AIMessage[],
    opts?: { model?: string; tools?: AIToolSchema[]; webSearch?: boolean }
  ): Promise<AICompletionResult> {
    const client = this.client()
    const model = opts?.model ?? 'gpt-4o-mini'

    const tools: OpenAI.Chat.ChatCompletionTool[] | undefined = opts?.tools?.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }))

    const response = await client.chat.completions.create({
      model,
      messages: this.toOpenAIMessages(messages),
      tools,
      // Web search: if using a *-search-preview model this can be enabled;
      // otherwise this is a no-op flag reserved for the Responses-API upgrade.
    })

    const choice = response.choices[0]
    const toolCalls: AIToolCall[] = (choice?.message.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: safeJsonParse(tc.function.arguments),
    }))

    return {
      content: choice?.message.content ?? '',
      toolCalls,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
    }
  }

  async *stream(messages: AIMessage[], opts?: { model?: string }): AsyncGenerator<string, void, unknown> {
    const client = this.client()
    const model = opts?.model ?? 'gpt-4o-mini'

    const stream = await client.chat.completions.create({
      model,
      messages: this.toOpenAIMessages(messages),
      stream: true,
    })

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) yield delta
    }
  }
}

function safeJsonParse(input: string): Record<string, unknown> {
  try {
    return JSON.parse(input)
  } catch {
    return {}
  }
}

export const openAIProvider = new OpenAIProvider()

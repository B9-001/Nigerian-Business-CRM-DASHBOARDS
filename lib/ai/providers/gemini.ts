import 'server-only'
import { GoogleGenAI } from '@google/genai'
import type { AICompleteOptions, AICompletionResult, AIMessage, AIProvider, AIToolCall } from './types'
import { AIProviderNotConfiguredError, AIProviderRequestError, AIProviderTimeoutError } from './types'
import { withTimeout, DEFAULT_AI_TIMEOUT_MS } from '../timeout'
import { logAIEvent } from '../logging'

/**
 * Google Gemini provider — official `@google/genai` SDK (per the explicit
 * integration requirement; this replaces the earlier raw-fetch
 * implementation in the now-removed google.ts). Reads GEMINI_API_KEY,
 * never GOOGLE_AI_API_KEY (renamed for consistency with Google's own
 * current naming for this API).
 */
export class GeminiProvider implements AIProvider {
  readonly name = 'gemini' as const
  readonly supportsWebSearch = false
  readonly supportsTools = true

  private client(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new AIProviderNotConfiguredError('Gemini')
    return new GoogleGenAI({ apiKey })
  }

  /** Gemini's `contents` array uses role 'user' | 'model' (no 'assistant'/'tool'/'system'). */
  private toGeminiContents(messages: AIMessage[]) {
    return messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : ('user' as const),
        parts: [{ text: m.role === 'tool' ? `[tool result: ${m.name ?? 'unknown'}]\n${m.content}` : m.content }],
      }))
  }

  private systemInstruction(messages: AIMessage[]): string | undefined {
    return messages.find((m) => m.role === 'system')?.content
  }

  async complete(messages: AIMessage[], opts?: AICompleteOptions): Promise<AICompletionResult> {
    const client = this.client()
    const model = opts?.model ?? 'gemini-2.0-flash'
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS
    const start = Date.now()

    const tools = opts?.tools?.length
      ? [{ functionDeclarations: opts.tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }]
      : undefined

    logAIEvent({ event: 'ai.request.start', provider: 'gemini', model, workflow: 'complete' })

    try {
      const response = await withTimeout('gemini', timeoutMs, (signal) =>
        client.models.generateContent({
          model,
          contents: this.toGeminiContents(messages),
          config: {
            systemInstruction: this.systemInstruction(messages),
            tools,
            abortSignal: signal,
          },
        })
      )

      const functionCalls = response.functionCalls ?? []
      const toolCalls: AIToolCall[] = functionCalls.map((fc, i) => ({
        id: `gemini-call-${i}`,
        name: fc.name ?? '',
        arguments: (fc.args as Record<string, unknown>) ?? {},
      }))

      const usage = {
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      }

      logAIEvent({
        event: 'ai.request.success',
        provider: 'gemini',
        model,
        durationMs: Date.now() - start,
        tokensInput: usage.inputTokens,
        tokensOutput: usage.outputTokens,
      })

      return { content: response.text ?? '', toolCalls, usage }
    } catch (err) {
      logAIEvent({ event: 'ai.request.error', provider: 'gemini', model, durationMs: Date.now() - start, error: errorMessage(err) })
      if (err instanceof AIProviderTimeoutError) throw err
      throw new AIProviderRequestError('gemini', errorMessage(err), err)
    }
  }

  async *stream(messages: AIMessage[], opts?: { model?: string; timeoutMs?: number }): AsyncGenerator<string, void, unknown> {
    const client = this.client()
    const model = opts?.model ?? 'gemini-2.0-flash'

    const stream = await client.models.generateContentStream({
      model,
      contents: this.toGeminiContents(messages),
      config: { systemInstruction: this.systemInstruction(messages) },
    })

    for await (const chunk of stream) {
      if (chunk.text) yield chunk.text
    }
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

export const geminiProvider = new GeminiProvider()

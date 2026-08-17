import 'server-only'
import type { AICompletionResult, AIMessage, AIProvider } from './types'
import { AIProviderNotConfiguredError } from './types'

/**
 * Google Gemini provider (fallback / secondary AI provider — CLAUDE.md #22).
 * Plain fetch against the Gemini REST API since the Google GenAI SDK isn't a
 * project dependency yet. Not tool-calling-capable in this minimal
 * implementation; used mainly as a text-completion fallback if OpenAI fails.
 */
export class GoogleAIProvider implements AIProvider {
  readonly name = 'google' as const
  readonly supportsWebSearch = false
  readonly supportsTools = false

  private getApiKey(): string {
    const key = process.env.GOOGLE_AI_API_KEY
    if (!key) throw new AIProviderNotConfiguredError('Google AI')
    return key
  }

  async complete(messages: AIMessage[], opts?: { model?: string }): Promise<AICompletionResult> {
    const apiKey = this.getApiKey()
    const model = opts?.model ?? 'gemini-1.5-flash'

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        systemInstruction: messages.find((m) => m.role === 'system')
          ? { parts: [{ text: messages.find((m) => m.role === 'system')!.content }] }
          : undefined,
      }),
    })

    if (!res.ok) throw new Error(`Gemini request failed: ${res.status} ${await res.text()}`)
    const data = await res.json()

    const content = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''

    return {
      content,
      toolCalls: [],
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
    }
  }

  async *stream(messages: AIMessage[], opts?: { model?: string }): AsyncGenerator<string, void, unknown> {
    // Non-streaming fallback: yield the full completion as a single chunk.
    const result = await this.complete(messages, opts)
    yield result.content
  }
}

export const googleAIProvider = new GoogleAIProvider()

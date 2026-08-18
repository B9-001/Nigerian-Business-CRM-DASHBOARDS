export class AIProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`${provider} is not configured (missing API key).`)
    this.name = 'AIProviderNotConfiguredError'
  }
}

export class AIProviderTimeoutError extends Error {
  constructor(provider: string, timeoutMs: number) {
    super(`${provider} request timed out after ${timeoutMs}ms.`)
    this.name = 'AIProviderTimeoutError'
  }
}

export class AIProviderRequestError extends Error {
  constructor(
    provider: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(`${provider} request failed: ${message}`)
    this.name = 'AIProviderRequestError'
  }
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  name?: string
}

export interface AIToolSchema {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON schema
}

export interface AIToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface AICompletionResult {
  content: string
  toolCalls: AIToolCall[]
  usage: { inputTokens: number; outputTokens: number }
}

export interface AICompleteOptions {
  model?: string
  tools?: AIToolSchema[]
  webSearch?: boolean
  /** Defaults to a provider-level constant (see lib/ai/timeout.ts) if omitted. */
  timeoutMs?: number
}

/** Providers currently wired into the AI Center. Keep in sync with lib/ai/router.ts. */
export type AIProviderName = 'openai' | 'gemini'

export interface AIProvider {
  readonly name: AIProviderName
  readonly supportsWebSearch: boolean
  readonly supportsTools: boolean

  /** Non-streaming completion, used when tool-calling needs a final structured result. */
  complete(messages: AIMessage[], opts?: AICompleteOptions): Promise<AICompletionResult>

  /** Streaming completion — yields text chunks. No tool-calling mid-stream (tools resolve before the final stream). */
  stream(messages: AIMessage[], opts?: { model?: string; timeoutMs?: number }): AsyncGenerator<string, void, unknown>
}

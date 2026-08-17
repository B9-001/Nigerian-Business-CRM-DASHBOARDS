export class AIProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`${provider} is not configured (missing API key).`)
    this.name = 'AIProviderNotConfiguredError'
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

export interface AIProvider {
  readonly name: 'openai' | 'google'
  readonly supportsWebSearch: boolean
  readonly supportsTools: boolean

  /** Non-streaming completion, used when tool-calling needs a final structured result. */
  complete(messages: AIMessage[], opts?: { model?: string; tools?: AIToolSchema[]; webSearch?: boolean }): Promise<AICompletionResult>

  /** Streaming completion — yields text chunks. No tool-calling mid-stream (tools resolve before the final stream). */
  stream(messages: AIMessage[], opts?: { model?: string }): AsyncGenerator<string, void, unknown>
}

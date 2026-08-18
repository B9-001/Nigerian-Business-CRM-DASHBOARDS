/**
 * Structured logging for AI calls. NEVER pass API keys, raw Authorization
 * headers, or full request bodies here — only the fields below. Every
 * call site in lib/ai/** and app/api/ai/** should log through this instead
 * of ad-hoc console.log/console.error, so a grep for "apiKey" or "sk-"
 * across this directory never turns up a logging call site by construction.
 */
export interface AIEventLog {
  event: 'ai.request.start' | 'ai.request.success' | 'ai.request.error' | 'ai.request.timeout'
  provider: string
  model?: string
  workflow?: string
  organizationId?: string
  userId?: string
  durationMs?: number
  tokensInput?: number
  tokensOutput?: number
  /** Error message text only — never the raw error object (which may embed request headers). */
  error?: string
}

export function logAIEvent(entry: AIEventLog): void {
  const { event, ...rest } = entry
  const level = event === 'ai.request.error' || event === 'ai.request.timeout' ? 'error' : 'log'
  // eslint-disable-next-line no-console
  console[level](`[${event}]`, JSON.stringify(rest))
}

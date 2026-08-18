import { AIProviderTimeoutError } from './providers/types'

/** Default timeout for a single AI provider request. Long research/report
 * work must never hold this open — those run as background jobs instead
 * (see lib/ai/research.ts) — this bounds ordinary chat/tool-resolution calls. */
export const DEFAULT_AI_TIMEOUT_MS = 30_000

/**
 * Races a provider call against a timeout, and produces an AbortController
 * whose signal can be threaded into the underlying SDK call (both the
 * OpenAI and @google/genai SDKs accept an abort signal) so the outbound
 * HTTP request is actually cancelled, not just abandoned client-side.
 */
export async function withTimeout<T>(
  provider: string,
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await run(controller.signal)
  } catch (err) {
    if (controller.signal.aborted) {
      throw new AIProviderTimeoutError(provider, timeoutMs)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

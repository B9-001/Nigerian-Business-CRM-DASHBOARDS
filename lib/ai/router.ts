import type { AIProvider } from './providers/types'
import { openAIProvider } from './providers/openai'
import { geminiProvider } from './providers/gemini'

export type AITask = 'simple' | 'complex' | 'research' | 'document' | 'meeting_summary'

interface RouteResult {
  provider: AIProvider
  model: string
}

/**
 * Cost-aware model routing (CLAUDE.md #23) — cheap/fast models for simple
 * requests, stronger models only where the task actually needs them.
 * AI_DEFAULT_PROVIDER / AI_FALLBACK_PROVIDER accept 'openai' | 'gemini'.
 * Organizations can override defaults via organizations.settings.ai (not
 * wired into the UI yet — this reads a safe platform-level default).
 */
export function routeModel(task: AITask): RouteResult {
  const primary = process.env.AI_DEFAULT_PROVIDER === 'gemini' ? geminiProvider : openAIProvider

  switch (task) {
    case 'simple':
      return { provider: primary, model: primary.name === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash' }
    case 'complex':
      return { provider: primary, model: primary.name === 'openai' ? 'gpt-4o' : 'gemini-2.5-pro' }
    case 'research':
      // Needs web search — only OpenAI supports it in this provider set today
      // (Gemini has native grounding/search too, but it isn't wired into
      // GeminiProvider yet — see docs/ai.md "Known limitations").
      return { provider: openAIProvider, model: 'gpt-4o-search-preview' }
    case 'document':
      return { provider: primary, model: primary.name === 'openai' ? 'gpt-4o' : 'gemini-2.5-pro' }
    case 'meeting_summary':
      return { provider: primary, model: primary.name === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash' }
  }
}

export function getFallbackProvider(): AIProvider {
  return process.env.AI_FALLBACK_PROVIDER === 'openai' ? openAIProvider : geminiProvider
}

/** Very rough NGN cost estimate for ai_usage.estimated_cost_ngn — not billing-accurate. */
export function estimateCostNgn(model: string, inputTokens: number, outputTokens: number): number {
  const RATE_PER_1K_NGN: Record<string, { input: number; output: number }> = {
    'gpt-4o-mini': { input: 0.23, output: 0.9 },
    'gpt-4o': { input: 4.6, output: 13.8 },
    'gpt-4o-search-preview': { input: 4.6, output: 13.8 },
    'gemini-2.0-flash': { input: 0.1, output: 0.4 },
    'gemini-2.5-pro': { input: 1.6, output: 6.4 },
  }
  const rate = RATE_PER_1K_NGN[model] ?? { input: 1, output: 2 }
  return (inputTokens / 1000) * rate.input + (outputTokens / 1000) * rate.output
}

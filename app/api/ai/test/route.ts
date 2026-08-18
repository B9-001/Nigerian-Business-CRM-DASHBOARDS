import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/auth/platform-admin'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { openAIProvider } from '@/lib/ai/providers/openai'
import { geminiProvider } from '@/lib/ai/providers/gemini'
import { AIProviderNotConfiguredError, AIProviderRequestError, AIProviderTimeoutError, type AIProvider } from '@/lib/ai/providers/types'

/**
 * Development-only AI test endpoint — pings OpenAI and Gemini independently
 * with a trivial prompt and reports which are configured/working, without
 * needing to go through the chat UI or spend a real conversation. Gated
 * behind requirePlatformAdmin() (never public) AND refuses to run at all
 * outside development, in case this route is ever accidentally left
 * reachable in a production deployment.
 *
 * GET /api/ai/test — tests both providers, returns a per-provider result.
 */
async function testProvider(provider: AIProvider): Promise<{ provider: string; ok: boolean; message: string; durationMs: number }> {
  const start = Date.now()
  try {
    const result = await provider.complete([{ role: 'user', content: 'Reply with exactly one word: "pong".' }], { timeoutMs: 15_000 })
    return { provider: provider.name, ok: true, message: result.content.trim().slice(0, 100), durationMs: Date.now() - start }
  } catch (err) {
    let message = 'Unknown error'
    if (err instanceof AIProviderNotConfiguredError) message = 'Not configured (missing API key)'
    else if (err instanceof AIProviderTimeoutError) message = 'Timed out'
    else if (err instanceof AIProviderRequestError) message = err.message
    else if (err instanceof Error) message = err.message
    return { provider: provider.name, ok: false, message, durationMs: Date.now() - start }
  }
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'This endpoint is disabled in production.' }, { status: 404 })
  }

  const { user } = await requirePlatformAdmin()

  const { allowed } = await checkRateLimit(`ai-test:${user.id}`, 10, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  // Independent, parallel — one provider failing must not affect the other's result.
  const [openaiResult, geminiResult] = await Promise.all([testProvider(openAIProvider), testProvider(geminiProvider)])

  return NextResponse.json({
    tested_at: new Date().toISOString(),
    results: [openaiResult, geminiResult],
  })
}

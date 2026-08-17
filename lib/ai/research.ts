import 'server-only'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { routeModel, estimateCostNgn } from './router'
import { AIProviderNotConfiguredError } from './providers/types'

/**
 * Executes a single AI research job end-to-end: marks it RUNNING, calls the
 * web-search-capable model, writes an ai_research_reports row, marks
 * COMPLETED/FAILED. Designed to be called either:
 *   - synchronously from app/api/ai/research/route.ts when SYNC_AI_RESEARCH=1
 *     (no queue configured in this environment), or
 *   - from workers/ai as a background BullMQ job (CLAUDE.md #52 — research
 *     must not block a normal HTTP request in production).
 *
 * Every report distinguishes source URLs from AI-generated analysis
 * (CLAUDE.md #21/#25) — sources are stored separately in the `sources`
 * jsonb column, never blended into `content` as if they were the same thing.
 */
export async function runResearchJob(jobId: string): Promise<void> {
  const admin = createAdminClient()

  const { data: job } = await admin.from('ai_research_jobs').select('*').eq('id', jobId).single()
  if (!job) return

  await admin.from('ai_research_jobs').update({ status: 'RUNNING' }).eq('id', jobId)

  try {
    const { provider, model } = routeModel('research')

    const completion = await provider.complete(
      [
        {
          role: 'system',
          content:
            'You are a business research analyst. Research the user\'s query using web search. Clearly separate verified facts (with sources) from your own analysis/inference. If you cannot verify something, say so explicitly rather than guessing.',
        },
        { role: 'user', content: job.query },
      ],
      { model, webSearch: true }
    )

    // Best-effort extraction of URLs mentioned in the response as "sources"
    // until the Responses API's structured citations are wired in.
    const urls = Array.from(new Set(completion.content.match(/https?:\/\/[^\s)]+/g) ?? []))
    const sources = urls.map((url) => ({ url, title: url, snippet: '' }))

    await admin.from('ai_research_reports').insert({
      organization_id: job.organization_id,
      research_job_id: jobId,
      title: job.query.slice(0, 120),
      summary: completion.content.slice(0, 400),
      sources,
      content: completion.content,
    })

    await admin.from('ai_usage').insert({
      organization_id: job.organization_id,
      user_id: job.user_id,
      provider: provider.name,
      model,
      tokens_input: completion.usage.inputTokens,
      tokens_output: completion.usage.outputTokens,
      estimated_cost_ngn: estimateCostNgn(model, completion.usage.inputTokens, completion.usage.outputTokens),
      workflow: 'ai_research',
    })

    await admin.from('ai_research_jobs').update({ status: 'COMPLETED' }).eq('id', jobId)
  } catch (err) {
    const message = err instanceof AIProviderNotConfiguredError ? err.message : 'Research failed. Please try again.'
    console.error('[ai/research] job failed', jobId, err)
    await admin.from('ai_research_jobs').update({ status: 'FAILED', error: message }).eq('id', jobId)
  }
}

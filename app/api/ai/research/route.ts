import { NextResponse, type NextRequest } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { runResearchJob } from '@/lib/ai/research'

export async function POST(request: NextRequest) {
  try {
    const { user, profile } = await requirePermission(PERMISSIONS.AI_RESEARCH)

    const { allowed } = await checkRateLimit(
      `ai-research:${profile.organization_id}:${user.id}`,
      RATE_LIMITS.AI_RESEARCH.limit,
      RATE_LIMITS.AI_RESEARCH.windowMs
    )
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded. Please slow down.' }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))
    const query: string = typeof body.query === 'string' ? body.query.trim() : ''
    if (!query) {
      return NextResponse.json({ error: 'A research query is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: job, error } = await supabase
      .from('ai_research_jobs')
      .insert({ organization_id: profile.organization_id, user_id: user.id, query, status: 'PENDING' })
      .select('id, status')
      .single()

    if (error || !job) {
      return NextResponse.json({ error: 'Could not create research job' }, { status: 500 })
    }

    // Long-running research must not block a normal request in production —
    // see CLAUDE.md #52. Without Redis/BullMQ configured in this environment,
    // SYNC_AI_RESEARCH=1 lets the feature work end-to-end for demo purposes.
    if (process.env.SYNC_AI_RESEARCH === '1') {
      await runResearchJob(job.id)
    }

    return NextResponse.json({ jobId: job.id, status: process.env.SYNC_AI_RESEARCH === '1' ? 'COMPLETED' : 'PENDING' }, { status: 202 })
  } catch (err) {
    console.error('[ai/research] unhandled error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

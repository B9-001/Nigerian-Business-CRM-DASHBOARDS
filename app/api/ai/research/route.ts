import { NextResponse, type NextRequest } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { runResearchJob } from '@/lib/ai/research'
import { canAccessFeature } from '@/lib/billing/entitlements'
import { checkUsageLimit, incrementUsage } from '@/lib/billing/usage'

export async function POST(request: NextRequest) {
  try {
    const { user, profile } = await requirePermission(PERMISSIONS.AI_RESEARCH)

    const { allowed: withinRateLimit } = await checkRateLimit(
      `ai-research:${profile.organization_id}:${user.id}`,
      RATE_LIMITS.AI_RESEARCH.limit,
      RATE_LIMITS.AI_RESEARCH.windowMs
    )
    if (!withinRateLimit) {
      return NextResponse.json({ error: 'Rate limit exceeded. Please slow down.' }, { status: 429 })
    }

    // Plan entitlement + monthly usage cap (lib/billing) — a separate
    // limit from the general AI Assistant, matching plans.max_research_requests_month.
    const [hasFeature, usage] = await Promise.all([
      canAccessFeature('ai_research'),
      checkUsageLimit(profile.organization_id, 'ai_research_requests', 'max_research_requests_month'),
    ])
    if (!hasFeature) {
      return NextResponse.json({ error: "Your organization's plan doesn't include AI Research. Upgrade in Settings → Billing." }, { status: 403 })
    }
    if (!usage.allowed) {
      return NextResponse.json(
        { error: `Your organization has reached its monthly research request limit (${usage.limit}). Upgrade your plan for more.` },
        { status: 429 }
      )
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

    await incrementUsage(profile.organization_id, 'ai_research_requests')

    // Long-running research must not block a normal request in production —
    // see CLAUDE.md #52. Without Redis/BullMQ configured in this environment,
    // SYNC_AI_RESEARCH=1 lets the feature work end-to-end for demo purposes.
    if (process.env.SYNC_AI_RESEARCH === '1') {
      await runResearchJob(job.id)
    }

    return NextResponse.json({ jobId: job.id, status: process.env.SYNC_AI_RESEARCH === '1' ? 'COMPLETED' : 'PENDING' }, { status: 202 })
  } catch (err) {
    console.error('[ai/research] unhandled error', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

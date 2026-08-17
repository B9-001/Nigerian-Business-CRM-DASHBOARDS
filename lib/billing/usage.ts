import 'server-only'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { getFeatureLimit, type PlanLimitKey } from './entitlements'

/** Calendar-month bucket [first day, last day] for the given date (defaults to now). */
function currentPeriod(at: Date = new Date()): { start: string; end: string } {
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1))
  const end = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 0))
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

export async function getCurrentUsage(organizationId: string, featureKey: string): Promise<number> {
  const admin = createAdminClient()
  const { start } = currentPeriod()
  const { data } = await admin
    .from('usage_records')
    .select('usage_count')
    .eq('organization_id', organizationId)
    .eq('feature_key', featureKey)
    .eq('period_start', start)
    .maybeSingle()
  return data?.usage_count ?? 0
}

/**
 * Increments metered usage for the current calendar-month period. Always
 * server-side (admin client) — client-reported usage is never trusted for
 * enforcement, per CLAUDE.md #30.
 */
export async function incrementUsage(organizationId: string, featureKey: string, by = 1): Promise<void> {
  const admin = createAdminClient()
  const { start, end } = currentPeriod()

  const { data: existing } = await admin
    .from('usage_records')
    .select('id, usage_count')
    .eq('organization_id', organizationId)
    .eq('feature_key', featureKey)
    .eq('period_start', start)
    .maybeSingle()

  if (existing) {
    await admin.from('usage_records').update({ usage_count: existing.usage_count + by }).eq('id', existing.id)
  } else {
    await admin.from('usage_records').insert({ organization_id: organizationId, feature_key: featureKey, usage_count: by, period_start: start, period_end: end })
  }
}

export interface UsageLimitCheck {
  allowed: boolean
  current: number
  limit: number | null // null = unlimited
}

/**
 * Checks current usage against the org's plan limit for a metered feature.
 * `limitKey` maps to the corresponding column on `plans` (e.g. AI requests
 * -> max_ai_requests_month).
 */
export async function checkUsageLimit(organizationId: string, featureKey: string, limitKey: PlanLimitKey): Promise<UsageLimitCheck> {
  const [current, limit] = await Promise.all([getCurrentUsage(organizationId, featureKey), getFeatureLimit(limitKey)])
  return { allowed: limit === null || current < limit, current, limit }
}

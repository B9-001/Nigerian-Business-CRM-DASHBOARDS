import { cache } from 'react'
import { createClient } from '@/lib/database/supabase/server'
import { requireOrg } from '@/lib/auth/session'

/**
 * Feature-flag entitlement check — is this feature enabled on the org's
 * current plan? Backed by public.can_access_feature() (checks
 * subscriptions.status in trialing/active/past_due AND plan_features.enabled
 * for the org's plan). Request-cached the same way permission checks are
 * (see lib/auth/session.ts) so checking several features on one page costs
 * one query per feature at most once, not once per call site.
 *
 * Numeric limits (max_users, max_ai_requests_month, etc.) live on `plans`
 * directly — use getFeatureLimit() for those.
 */
export const canAccessFeature = cache(async (featureKey: string): Promise<boolean> => {
  await requireOrg()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('can_access_feature', { feature_key: featureKey })
  if (error) {
    console.error('[entitlements] can_access_feature failed', featureKey, error)
    return false
  }
  return Boolean(data)
})

export type PlanLimitKey = 'max_users' | 'max_projects' | 'max_storage_gb' | 'max_ai_requests_month' | 'max_research_requests_month' | 'max_api_requests_month'

/** Returns the org's plan limit for a given numeric field, or null (unlimited). */
export const getFeatureLimit = cache(async (limitKey: PlanLimitKey): Promise<number | null> => {
  const { profile } = await requireOrg()
  const supabase = await createClient()

  const { data: sub } = await supabase.from('subscriptions').select('plan_id').eq('organization_id', profile.organization_id).maybeSingle()
  if (!sub) return null

  const { data: plan } = await supabase
    .from('plans')
    .select('max_users, max_projects, max_storage_gb, max_ai_requests_month, max_research_requests_month, max_api_requests_month')
    .eq('id', sub.plan_id)
    .single()
  return plan ? plan[limitKey] : null
})

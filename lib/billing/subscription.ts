import 'server-only'
import { createAdminClient } from '@/lib/database/supabase/admin'
import type { Database } from '@/types/database'

export type Subscription = Database['public']['Tables']['subscriptions']['Row']

function addInterval(from: Date, interval: 'monthly' | 'annual'): Date {
  const d = new Date(from)
  if (interval === 'annual') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d
}

export async function getSubscriptionForOrg(organizationId: string): Promise<Subscription | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('subscriptions').select('*').eq('organization_id', organizationId).maybeSingle()
  return data
}

/**
 * Called after a Paystack transaction verifies successfully. Activates (or
 * renews) the org's subscription: sets status='active', plan_id, and
 * extends current_period_end by one billing interval from *now* (a simple,
 * honest renewal model — see docs/billing.md "Known limitations" re: this
 * not being a true Paystack recurring-subscription integration yet).
 */
export async function activateSubscription(params: {
  organizationId: string
  planId: string
  billingInterval: 'monthly' | 'annual'
  providerCustomerId?: string
  providerSubscriptionId?: string
}): Promise<void> {
  const admin = createAdminClient()
  const now = new Date()
  const periodEnd = addInterval(now, params.billingInterval)

  await admin.from('subscriptions').upsert(
    {
      organization_id: params.organizationId,
      plan_id: params.planId,
      status: 'active',
      billing_interval: params.billingInterval,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      cancelled_at: null,
      pending_plan_id: null,
      pending_plan_effective_at: null,
      ...(params.providerCustomerId ? { provider_customer_id: params.providerCustomerId } : {}),
      ...(params.providerSubscriptionId ? { provider_subscription_id: params.providerSubscriptionId } : {}),
    },
    { onConflict: 'organization_id' }
  )

  await admin.from('organizations').update({ plan: params.planId }).eq('id', params.organizationId)
}

/**
 * Upgrades take effect immediately (re-uses activateSubscription). Downgrades
 * are scheduled for the end of the current billing period (#17) so the org
 * keeps what it paid for until then — call applyScheduledPlanChanges() from
 * a worker/cron to actually flip pending_plan_id over once due.
 */
export async function scheduleDowngrade(organizationId: string, newPlanId: string): Promise<void> {
  const admin = createAdminClient()
  const sub = await getSubscriptionForOrg(organizationId)
  if (!sub) return

  await admin
    .from('subscriptions')
    .update({ pending_plan_id: newPlanId, pending_plan_effective_at: sub.current_period_end })
    .eq('organization_id', organizationId)
}

export async function cancelSubscription(organizationId: string, immediate: boolean): Promise<void> {
  const admin = createAdminClient()

  if (immediate) {
    await admin
      .from('subscriptions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_at_period_end: false })
      .eq('organization_id', organizationId)
  } else {
    await admin.from('subscriptions').update({ cancel_at_period_end: true }).eq('organization_id', organizationId)
  }
}

/** Reverses a scheduled cancellation (org changed their mind before period end). */
export async function resumeSubscription(organizationId: string): Promise<void> {
  const admin = createAdminClient()
  await admin.from('subscriptions').update({ cancel_at_period_end: false }).eq('organization_id', organizationId)
}

/**
 * Background maintenance, meant to run periodically (workers/analytics or a
 * dedicated worker — not wired to a scheduler in this environment, see
 * docs/billing.md). Applies any due scheduled downgrades, expires
 * subscriptions whose period ended with cancel_at_period_end set, and
 * expires trials that ran out without a paid subscription following.
 */
export async function runSubscriptionMaintenance(): Promise<{ downgraded: number; cancelled: number; trialsExpired: number }> {
  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  const { data: dueDowngrades } = await admin
    .from('subscriptions')
    .select('organization_id, pending_plan_id')
    .not('pending_plan_id', 'is', null)
    .lte('pending_plan_effective_at', nowIso)

  for (const row of dueDowngrades ?? []) {
    if (!row.pending_plan_id) continue
    await admin
      .from('subscriptions')
      .update({ plan_id: row.pending_plan_id, pending_plan_id: null, pending_plan_effective_at: null })
      .eq('organization_id', row.organization_id)
    await admin.from('organizations').update({ plan: row.pending_plan_id }).eq('id', row.organization_id)
  }

  const { data: dueCancellations } = await admin
    .from('subscriptions')
    .select('organization_id')
    .eq('cancel_at_period_end', true)
    .lte('current_period_end', nowIso)
    .neq('status', 'cancelled')

  for (const row of dueCancellations ?? []) {
    await admin
      .from('subscriptions')
      .update({ status: 'cancelled', cancelled_at: nowIso })
      .eq('organization_id', row.organization_id)
  }

  const { data: expiredTrials } = await admin
    .from('subscriptions')
    .select('organization_id')
    .eq('status', 'trialing')
    .lte('trial_end', nowIso)

  for (const row of expiredTrials ?? []) {
    await admin.from('subscriptions').update({ status: 'expired' }).eq('organization_id', row.organization_id)
  }

  return {
    downgraded: dueDowngrades?.length ?? 0,
    cancelled: dueCancellations?.length ?? 0,
    trialsExpired: expiredTrials?.length ?? 0,
  }
}

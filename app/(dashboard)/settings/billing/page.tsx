import Link from 'next/link'
import { CheckCircle2, XCircle } from 'lucide-react'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatNaira, formatDate, formatDateTime } from '@/lib/utils'
import { UsageBar } from './usage-bar'
import { UpgradeButton, DowngradeButton } from './plan-actions'
import { CancelSubscriptionButton, ResumeSubscriptionButton } from './cancel-subscription'

const FEATURE_LABELS: Record<string, string> = {
  crm: 'CRM',
  tasks: 'Tasks',
  projects: 'Projects',
  calendar: 'Calendar',
  meetings: 'Meetings',
  reports: 'Reports',
  google_meet: 'Google Meet',
  zoom: 'Zoom',
  ai_assistant: 'AI Assistant',
  ai_research: 'AI Research',
  advanced_analytics: 'Advanced Analytics',
  automation: 'Automation',
  api_access: 'API Access',
}

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const { payment } = await searchParams
  const { profile } = await requirePermission(PERMISSIONS.BILLING_MANAGE)
  const supabase = await createClient()

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

  const [
    { data: subscription },
    { data: plans },
    { data: planFeatures },
    { data: activeEmployees },
    { data: projectCount },
    { data: aiUsageThisMonth },
    { data: docSizes },
    { data: transactions },
  ] = await Promise.all([
    supabase.from('subscriptions').select('*').eq('organization_id', profile.organization_id).maybeSingle(),
    supabase.from('plans').select('*').order('price_ngn_month', { ascending: true, nullsFirst: false }),
    supabase.from('plan_features').select('plan_id, feature_key, enabled'),
    supabase.from('employees').select('id', { count: 'exact', head: true }).eq('organization_id', profile.organization_id).eq('employment_status', 'ACTIVE'),
    supabase.from('projects').select('id', { count: 'exact', head: true }).eq('organization_id', profile.organization_id),
    supabase
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', profile.organization_id)
      .gte('created_at', monthStart),
    supabase.from('documents').select('file_size').eq('organization_id', profile.organization_id),
    supabase
      .from('billing_transactions')
      .select('id, reference, amount, currency, status, payment_type, plan_id, created_at, paid_at')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const currentPlan = plans?.find((p) => p.id === subscription?.plan_id)
  const pendingPlan = plans?.find((p) => p.id === subscription?.pending_plan_id)
  const storageBytes = (docSizes ?? []).reduce((sum, d) => sum + (d.file_size ?? 0), 0)
  const storageGb = Math.round((storageBytes / 1024 ** 3) * 100) / 100

  const employeesCount = (activeEmployees as unknown as { count: number } | null)?.count ?? 0
  const projectsCount = (projectCount as unknown as { count: number } | null)?.count ?? 0
  const aiCount = (aiUsageThisMonth as unknown as { count: number } | null)?.count ?? 0

  const enabledFeatures = new Set(
    (planFeatures ?? []).filter((f) => f.plan_id === subscription?.plan_id && f.enabled).map((f) => f.feature_key)
  )

  return (
    <div>
      <PageHeader title="Billing & Subscription" description="Your BusinessOS plan, usage, and payment history." />

      {payment === 'success' && (
        <div className="mb-5 flex items-center gap-2 rounded-control border border-success/30 bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 size={16} /> Payment successful — your plan has been updated.
        </div>
      )}
      {(payment === 'failed' || payment === 'error') && (
        <div className="mb-5 flex items-center gap-2 rounded-control border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          <XCircle size={16} /> {payment === 'failed' ? 'Payment failed. No charge was made.' : 'Something went wrong verifying your payment.'}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-foreground">{currentPlan?.name ?? 'No plan'}</p>
            <p className="text-sm text-muted-foreground">
              {currentPlan?.price_ngn_month != null ? `${formatNaira(currentPlan.price_ngn_month)}/month` : 'Custom pricing'}
            </p>

            <div className="mt-3">
              <StatusBadge status={subscription?.status ?? 'expired'} />
            </div>

            {subscription?.status === 'trialing' && subscription.trial_end && (
              <p className="mt-2 text-xs text-muted-foreground">Trial ends {formatDate(subscription.trial_end)}</p>
            )}
            {subscription?.current_period_end && subscription.status !== 'trialing' && (
              <p className="mt-2 text-xs text-muted-foreground">
                {subscription.cancel_at_period_end ? 'Access ends' : 'Next billing date'}: {formatDate(subscription.current_period_end)}
              </p>
            )}
            {pendingPlan && (
              <p className="mt-2 text-xs text-warning">Switching to {pendingPlan.name} on {formatDate(subscription!.pending_plan_effective_at!)}</p>
            )}

            <div className="mt-4 space-y-2">
              {subscription?.cancel_at_period_end ? (
                <ResumeSubscriptionButton />
              ) : (
                subscription && subscription.status !== 'cancelled' && <CancelSubscriptionButton />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <UsageBar label="Team members" current={employeesCount} limit={currentPlan?.max_users ?? null} />
            <UsageBar label="Projects" current={projectsCount} limit={currentPlan?.max_projects ?? null} />
            <UsageBar label="AI requests (this month)" current={aiCount} limit={currentPlan?.max_ai_requests_month ?? null} />
            <UsageBar label="Storage" current={storageGb} limit={currentPlan?.max_storage_gb ?? null} unit=" GB" />

            <div className="border-t border-border pt-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Included features</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                  <span key={key} className={`text-xs ${enabledFeatures.has(key) ? 'text-foreground' : 'text-subtle line-through'}`}>
                    {enabledFeatures.has(key) ? '✓' : '—'} {label}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold text-foreground">Plans</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(plans ?? [])
          .filter((p) => p.is_active && p.is_public)
          .map((plan) => {
            const isCurrent = plan.id === subscription?.plan_id
            const isPending = plan.id === subscription?.pending_plan_id
            const isUpgrade = currentPlan?.price_ngn_month != null && plan.price_ngn_month != null && plan.price_ngn_month > currentPlan.price_ngn_month
            const isDowngrade = currentPlan?.price_ngn_month != null && plan.price_ngn_month != null && plan.price_ngn_month < currentPlan.price_ngn_month

            return (
              <Card key={plan.id} className={isCurrent ? 'border-primary ring-1 ring-primary' : undefined}>
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-foreground">
                    {plan.price_ngn_month != null ? formatNaira(plan.price_ngn_month) : 'Custom'}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <li>{plan.max_users ?? 'Unlimited'} team members</li>
                    <li>{plan.max_projects ?? 'Unlimited'} projects</li>
                    <li>{plan.max_storage_gb ?? 'Unlimited'} GB storage</li>
                    <li>{plan.max_ai_requests_month ?? 'Unlimited'} AI requests/mo</li>
                  </ul>

                  <div className="mt-4">
                    {plan.price_ngn_month == null ? (
                      <a href="mailto:sales@example.com">
                        <button className="w-full rounded-control border border-border py-2 text-sm font-semibold text-foreground hover:bg-surface-muted">
                          Contact Sales
                        </button>
                      </a>
                    ) : isCurrent ? (
                      <button disabled className="w-full rounded-control border border-border py-2 text-sm font-semibold text-subtle">
                        Current Plan
                      </button>
                    ) : isPending ? (
                      <button disabled className="w-full rounded-control border border-warning/40 bg-warning/10 py-2 text-sm font-semibold text-warning">
                        Scheduled
                      </button>
                    ) : isUpgrade ? (
                      <UpgradeButton planId={plan.id} />
                    ) : isDowngrade ? (
                      <DowngradeButton planId={plan.id} />
                    ) : (
                      <UpgradeButton planId={plan.id} label="Switch Plan" />
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!transactions || transactions.length === 0 ? (
            <EmptyState title="No payments yet" className="border-0" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Description</th>
                  <th className="px-4 py-2.5 font-medium">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDateTime(t.created_at)}</td>
                    <td className="px-4 py-2.5 text-foreground">{plans?.find((p) => p.id === t.plan_id)?.name ?? t.payment_type} plan</td>
                    <td className="px-4 py-2.5 text-foreground">{formatNaira(t.amount)}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-subtle">
                      <Link href={`/settings/billing/invoices/${t.reference}`} className="hover:text-primary hover:underline">
                        {t.reference}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

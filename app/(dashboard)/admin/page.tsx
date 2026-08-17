import { requirePlatformAdmin } from '@/lib/auth/platform-admin'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { PageHeader } from '@/components/dashboard/page-header'
import { MetricCard } from '@/components/dashboard/metric-card'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatNaira, formatDateTime } from '@/lib/utils'
import { DollarSign, TrendingUp, Users, AlertTriangle, Clock, XCircle } from 'lucide-react'

export default async function AdminDashboardPage() {
  await requirePlatformAdmin()
  const admin = createAdminClient()

  const [{ data: subscriptions }, { data: plans }, { data: recentTransactions }] = await Promise.all([
    admin.from('subscriptions').select('organization_id, plan_id, status, billing_interval, created_at'),
    admin.from('plans').select('id, price_ngn_month, annual_price_ngn'),
    admin
      .from('billing_transactions')
      .select('id, organization_id, amount, status, created_at, organizations(name)')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const planById = new Map((plans ?? []).map((p) => [p.id, p]))
  const subs = subscriptions ?? []

  const activeSubs = subs.filter((s) => s.status === 'active')
  const trialingSubs = subs.filter((s) => s.status === 'trialing')
  const pastDueSubs = subs.filter((s) => s.status === 'past_due')
  const cancelledSubs = subs.filter((s) => s.status === 'cancelled')

  const mrr = activeSubs.reduce((sum, s) => {
    const plan = planById.get(s.plan_id)
    if (!plan) return sum
    const monthly = s.billing_interval === 'annual' ? (plan.annual_price_ngn ?? 0) / 12 : (plan.price_ngn_month ?? 0)
    return sum + monthly
  }, 0)
  const arr = mrr * 12

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { count: failedPaymentsCount } = await admin
    .from('billing_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'FAILED')
    .gte('created_at', thirtyDaysAgo)

  // Simple approximation — no historical snapshots exist to compute a
  // precise cohort-based churn rate. Cancelled-this-30-days over
  // (active + cancelled-this-30-days) as a rough directional signal only.
  const cancelledRecently = cancelledSubs.filter((s) => s.created_at >= thirtyDaysAgo).length
  const churnRate = activeSubs.length + cancelledRecently > 0 ? (cancelledRecently / (activeSubs.length + cancelledRecently)) * 100 : 0

  return (
    <div>
      <PageHeader title="Revenue Overview" description="Platform-wide subscription revenue (approximate — no historical cohort snapshots yet)." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="MRR" value={formatNaira(mrr)} icon={DollarSign} emphasis />
        <MetricCard label="ARR" value={formatNaira(arr)} icon={TrendingUp} />
        <MetricCard label="Active Businesses" value={activeSubs.length} icon={Users} />
        <MetricCard label="Trial Organizations" value={trialingSubs.length} icon={Clock} />
        <MetricCard label="Past Due" value={pastDueSubs.length} icon={AlertTriangle} />
        <MetricCard label="Failed Payments (30d)" value={failedPaymentsCount ?? 0} icon={XCircle} />
        <MetricCard label="Cancelled" value={cancelledSubs.length} icon={XCircle} />
        <MetricCard label="Churn (approx.)" value={`${churnRate.toFixed(1)}%`} icon={TrendingUp} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Organization</th>
                <th className="px-4 py-2.5 font-medium">Amount</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(recentTransactions ?? []).map((t) => {
                const org = t.organizations as unknown as { name: string } | null
                return (
                  <tr key={t.id}>
                    <td className="px-4 py-2.5 text-foreground">{org?.name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-foreground">{formatNaira(t.amount)}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{t.status}</td>
                    <td className="px-4 py-2.5 text-xs text-subtle">{formatDateTime(t.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

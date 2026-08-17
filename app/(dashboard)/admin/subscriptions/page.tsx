import { requirePlatformAdmin } from '@/lib/auth/platform-admin'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { PageHeader } from '@/components/dashboard/page-header'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate } from '@/lib/utils'

const STATUSES = ['trialing', 'active', 'past_due', 'payment_failed', 'cancelled', 'expired', 'incomplete', 'paused']

export default async function AdminSubscriptionsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status, q } = await searchParams
  await requirePlatformAdmin()
  const admin = createAdminClient()

  let query = admin
    .from('subscriptions')
    .select('id, plan_id, provider, status, billing_interval, current_period_end, created_at, organizations(name)')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data: subscriptions } = await query.limit(200)

  const filtered = q
    ? (subscriptions ?? []).filter((s) => (s.organizations as unknown as { name: string } | null)?.name?.toLowerCase().includes(q.toLowerCase()))
    : subscriptions ?? []

  return (
    <div>
      <PageHeader title="Subscriptions" description="Every organization's subscription record." />

      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by organization…"
          className="h-9 rounded-control border border-border bg-surface px-3 text-sm focus:border-primary focus:outline-none"
        />
        <a href="/admin/subscriptions" className={navClass(!status)}>
          All
        </a>
        {STATUSES.map((s) => (
          <a key={s} href={`/admin/subscriptions?status=${s}`} className={navClass(status === s)}>
            {s.replace('_', ' ')}
          </a>
        ))}
      </form>

      {filtered.length === 0 ? (
        <EmptyState title="No subscriptions found" />
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Organization</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Interval</th>
                <th className="px-4 py-3 font-medium">Next billing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((s) => {
                const org = s.organizations as unknown as { name: string } | null
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium text-foreground">{org?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.plan_id}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.provider}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.billing_interval}</td>
                    <td className="px-4 py-3 text-xs text-subtle">{s.current_period_end ? formatDate(s.current_period_end) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function navClass(active: boolean) {
  return active
    ? 'flex h-9 items-center rounded-control bg-primary-soft px-3 text-xs font-semibold text-primary-dark'
    : 'flex h-9 items-center rounded-control border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-surface-muted'
}

import { requirePlatformAdmin } from '@/lib/auth/platform-admin'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { PageHeader } from '@/components/dashboard/page-header'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatNaira, formatDateTime } from '@/lib/utils'

const STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'ABANDONED']

export default async function AdminTransactionsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams
  await requirePlatformAdmin()
  const admin = createAdminClient()

  let query = admin
    .from('billing_transactions')
    .select('id, reference, amount, currency, status, provider_transaction_id, created_at, organizations(name)')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  const { data: transactions } = await query.limit(200)

  return (
    <div>
      <PageHeader title="Transactions" description="Every checkout attempt across all organizations." />

      <div className="mb-4 flex flex-wrap gap-2">
        <a href="/admin/transactions" className={navClass(!status)}>
          All
        </a>
        {STATUSES.map((s) => (
          <a key={s} href={`/admin/transactions?status=${s}`} className={navClass(status === s)}>
            {s}
          </a>
        ))}
      </div>

      {!transactions || transactions.length === 0 ? (
        <EmptyState title="No transactions found" />
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Organization</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transactions.map((t) => {
                const org = t.organizations as unknown as { name: string } | null
                return (
                  <tr key={t.id}>
                    <td className="px-4 py-3 font-medium text-foreground">{org?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-foreground">{formatNaira(t.amount)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-subtle">{t.reference}</td>
                    <td className="px-4 py-3 text-xs text-subtle">{formatDateTime(t.created_at)}</td>
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

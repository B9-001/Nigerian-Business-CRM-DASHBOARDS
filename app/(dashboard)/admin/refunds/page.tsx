import { requirePlatformAdmin } from '@/lib/auth/platform-admin'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatNaira, formatDateTime } from '@/lib/utils'
import { RefundButton } from './refund-button'

export default async function AdminRefundsPage() {
  await requirePlatformAdmin()
  const admin = createAdminClient()

  const [{ data: refunds }, { data: refundableTransactions }] = await Promise.all([
    admin.from('refunds').select('id, amount, status, reason, created_at, organizations(name)').order('created_at', { ascending: false }),
    admin
      .from('billing_transactions')
      .select('id, reference, amount, created_at, organizations(name)')
      .eq('status', 'SUCCESS')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return (
    <div>
      <PageHeader title="Refunds" description="Only platform admins can issue refunds — never exposed to organization users." />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Refund History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!refunds || refunds.length === 0 ? (
            <EmptyState title="No refunds issued yet" className="border-0" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Organization</th>
                  <th className="px-4 py-2.5 font-medium">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Reason</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {refunds.map((r) => {
                  const org = r.organizations as unknown as { name: string } | null
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-2.5 text-foreground">{org?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-foreground">{formatNaira(r.amount)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.reason}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-subtle">{formatDateTime(r.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Successful Transactions (refund-eligible)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!refundableTransactions || refundableTransactions.length === 0 ? (
            <EmptyState title="No transactions" className="border-0" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Organization</th>
                  <th className="px-4 py-2.5 font-medium">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Reference</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {refundableTransactions.map((t) => {
                    const org = t.organizations as unknown as { name: string } | null
                    return (
                      <tr key={t.id}>
                        <td className="px-4 py-2.5 text-foreground">{org?.name ?? '—'}</td>
                        <td className="px-4 py-2.5 text-foreground">{formatNaira(t.amount)}</td>
                        <td className="px-4 py-2.5 text-xs text-subtle">{t.reference}</td>
                        <td className="px-4 py-2.5 text-xs text-subtle">{formatDateTime(t.created_at)}</td>
                        <td className="px-4 py-2.5">
                          <RefundButton transactionId={t.id} />
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

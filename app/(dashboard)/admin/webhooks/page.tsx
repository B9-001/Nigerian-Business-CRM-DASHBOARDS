import { requirePlatformAdmin } from '@/lib/auth/platform-admin'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { PageHeader } from '@/components/dashboard/page-header'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDateTime } from '@/lib/utils'

export default async function AdminWebhooksPage({ searchParams }: { searchParams: Promise<{ failed?: string }> }) {
  const { failed } = await searchParams
  await requirePlatformAdmin()
  const admin = createAdminClient()

  let query = admin
    .from('billing_events')
    .select('id, provider, event_type, reference, processed, error_message, created_at')
    .order('created_at', { ascending: false })

  if (failed) query = query.not('error_message', 'is', null)

  const { data: events } = await query.limit(100)

  return (
    <div>
      <PageHeader title="Webhook Events" description="Every inbound Paystack webhook, for idempotency auditing and failure inspection." />

      <div className="mb-4 flex gap-2">
        <a href="/admin/webhooks" className={navClass(!failed)}>
          All
        </a>
        <a href="/admin/webhooks?failed=1" className={navClass(!!failed)}>
          Failed only
        </a>
      </div>

      {!events || events.length === 0 ? (
        <EmptyState title="No webhook events yet" />
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Processed</th>
                <th className="px-4 py-3 font-medium">Error</th>
                <th className="px-4 py-3 font-medium">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 font-medium text-foreground">{e.event_type}</td>
                  <td className="px-4 py-3 text-xs text-subtle">{e.reference ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge tone={e.processed ? 'success' : 'warning'}>{e.processed ? 'Processed' : 'Pending'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-danger">{e.error_message ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-subtle">{formatDateTime(e.created_at)}</td>
                </tr>
              ))}
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

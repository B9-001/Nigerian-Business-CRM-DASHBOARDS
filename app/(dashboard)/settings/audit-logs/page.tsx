import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDateTime } from '@/lib/utils'

export default async function AuditLogsPage() {
  const { profile } = await requirePermission(PERMISSIONS.AUDIT_VIEW)
  const supabase = await createClient()

  const { data: logs } = await supabase
    .from('audit_logs')
    .select('id, action, resource_type, resource_id, metadata, created_at, actor:profiles!actor_id(full_name, email)')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div>
      <PageHeader title="Audit Logs" description="Every sensitive action taken in your organization." />

      {!logs || logs.length === 0 ? (
        <EmptyState title="No audit events yet" />
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Resource</th>
                <th className="px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => {
                const actor = log.actor as unknown as { full_name: string | null; email: string } | null
                return (
                  <tr key={log.id}>
                    <td className="px-4 py-2.5 font-medium text-foreground">{log.action}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{actor?.full_name ?? actor?.email ?? 'System'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{log.resource_type}</td>
                    <td className="px-4 py-2.5 text-xs text-subtle">{formatDateTime(log.created_at)}</td>
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

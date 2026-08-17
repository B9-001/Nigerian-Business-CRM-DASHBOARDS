import { requirePlatformAdmin } from '@/lib/auth/platform-admin'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { logAuditEvent } from '@/lib/security/audit'
import { PageHeader } from '@/components/dashboard/page-header'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

export default async function AdminOrganizationsPage() {
  const { user } = await requirePlatformAdmin()
  const admin = createAdminClient()

  const [{ data: organizations }, { data: subscriptions }] = await Promise.all([
    admin.from('organizations').select('id, name, plan, created_at, employees(count)').order('created_at', { ascending: false }),
    admin.from('subscriptions').select('organization_id, status, current_period_end, plan_id'),
  ])

  const subsByOrg = new Map((subscriptions ?? []).map((s) => [s.organization_id, s]))

  // Audit every platform-admin read of cross-tenant data (CLAUDE.md #63) —
  // no casual browsing without a trail.
  for (const org of organizations ?? []) {
    await logAuditEvent({
      organizationId: org.id,
      actorId: user.id,
      action: 'platform_admin.viewed_org_data',
      resourceType: 'organizations',
      resourceId: org.id,
    })
  }

  return (
    <div>
      <PageHeader title="Organizations" description="Every organization on the platform." />

      <div className="overflow-hidden rounded-card border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Employees</th>
              <th className="px-4 py-3 font-medium">Next billing</th>
              <th className="px-4 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(organizations ?? []).map((org) => {
              const count = (org.employees as unknown as { count: number }[])?.[0]?.count ?? 0
              const sub = subsByOrg.get(org.id)
              return (
                <tr key={org.id}>
                  <td className="px-4 py-3 font-medium text-foreground">{org.name}</td>
                  <td className="px-4 py-3">
                    <Badge tone="primary">{org.plan}</Badge>
                  </td>
                  <td className="px-4 py-3">{sub ? <StatusBadge status={sub.status} /> : <span className="text-subtle">—</span>}</td>
                  <td className="px-4 py-3 text-muted-foreground">{count}</td>
                  <td className="px-4 py-3 text-xs text-subtle">{sub?.current_period_end ? formatDate(sub.current_period_end) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-subtle">{formatDate(org.created_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

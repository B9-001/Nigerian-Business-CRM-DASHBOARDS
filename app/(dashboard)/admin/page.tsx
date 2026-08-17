import { requirePlatformAdmin } from '@/lib/auth/platform-admin'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { logAuditEvent } from '@/lib/security/audit'
import { PageHeader } from '@/components/dashboard/page-header'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

export default async function PlatformAdminPage() {
  const { user } = await requirePlatformAdmin()
  const admin = createAdminClient()

  const { data: organizations } = await admin
    .from('organizations')
    .select('id, name, plan, created_at, employees(count)')
    .order('created_at', { ascending: false })

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
      <PageHeader title="Platform Admin" description="Cross-tenant view for the SaaS owner. Every view here is audit-logged." />

      <div className="overflow-hidden rounded-card border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Employees</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(organizations ?? []).map((org) => {
              const count = (org.employees as unknown as { count: number }[])?.[0]?.count ?? 0
              return (
                <tr key={org.id}>
                  <td className="px-4 py-3 font-medium text-foreground">{org.name}</td>
                  <td className="px-4 py-3">
                    <Badge tone="primary">{org.plan}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{count}</td>
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

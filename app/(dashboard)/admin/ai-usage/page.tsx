import { requirePlatformAdmin } from '@/lib/auth/platform-admin'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { logAuditEvent } from '@/lib/security/audit'
import { PageHeader } from '@/components/dashboard/page-header'
import { formatNaira } from '@/lib/utils'

export default async function PlatformAIUsagePage() {
  const { user } = await requirePlatformAdmin()
  const admin = createAdminClient()

  const { data: usage } = await admin.from('ai_usage').select('organization_id, tokens_input, tokens_output, estimated_cost_ngn, organizations(name)')

  const byOrg = new Map<string, { name: string; tokens: number; cost: number }>()
  for (const row of usage ?? []) {
    const org = row.organizations as unknown as { name: string } | null
    const existing = byOrg.get(row.organization_id) ?? { name: org?.name ?? 'Unknown', tokens: 0, cost: 0 }
    existing.tokens += row.tokens_input + row.tokens_output
    existing.cost += Number(row.estimated_cost_ngn)
    byOrg.set(row.organization_id, existing)
  }

  for (const orgId of byOrg.keys()) {
    await logAuditEvent({ organizationId: orgId, actorId: user.id, action: 'platform_admin.viewed_org_data', resourceType: 'ai_usage' })
  }

  const rows = Array.from(byOrg.values()).sort((a, b) => b.cost - a.cost)

  return (
    <div>
      <PageHeader title="Platform AI Usage" description="AI token consumption and estimated cost across all organizations." />

      <div className="overflow-hidden rounded-card border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="px-4 py-3 font-medium">Tokens</th>
              <th className="px-4 py-3 font-medium">Estimated Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.tokens.toLocaleString()}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatNaira(r.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

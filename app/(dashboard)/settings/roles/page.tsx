import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS, ROLES } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { OverrideToggle } from './override-toggle'

export default async function RolesSettingsPage() {
  const { profile } = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)
  const supabase = await createClient()

  const [{ data: permissions }, { data: rolePermissions }, { data: members }, { data: overrides }] = await Promise.all([
    supabase.from('permissions').select('key, category, description').order('category'),
    supabase.from('role_permissions').select('role, permission_key'),
    supabase.from('profiles').select('id, full_name, email, role').eq('organization_id', profile.organization_id).order('full_name'),
    supabase.from('user_permission_overrides').select('user_id, permission_key, granted').eq('organization_id', profile.organization_id),
  ])

  const grantSet = new Set((rolePermissions ?? []).map((r) => `${r.role}:${r.permission_key}`))

  return (
    <div>
      <PageHeader title="Roles & Permissions" description="Default role grants and per-user overrides." />

      <Card className="mb-5 overflow-x-auto">
        <CardHeader>
          <CardTitle>Default role permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3">Permission</th>
                {ROLES.map((r) => (
                  <th key={r} className="px-2 py-2 text-center">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(permissions ?? []).map((p) => (
                <tr key={p.key} className="border-b border-border/60">
                  <td className="py-1.5 pr-3 text-foreground">{p.key}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-2 py-1.5 text-center">
                      {grantSet.has(`${r}:${p.key}`) ? <span className="text-success">✓</span> : <span className="text-subtle">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-user overrides</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {(members ?? []).map((member) => (
            <div key={member.id}>
              <p className="mb-2 text-sm font-semibold text-foreground">
                {member.full_name ?? member.email} <span className="font-normal text-subtle">({member.role})</span>
              </p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {(permissions ?? []).map((p) => {
                  const override = overrides?.find((o) => o.user_id === member.id && o.permission_key === p.key)
                  const current = override ? (override.granted ? 'granted' : 'revoked') : 'default'
                  return (
                    <div key={p.key} className="flex items-center justify-between rounded-control border border-border px-2 py-1">
                      <span className="truncate text-xs text-muted-foreground">{p.key}</span>
                      <OverrideToggle userId={member.id} permissionKey={p.key} current={current} />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

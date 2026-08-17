import { UsersRound } from 'lucide-react'
import { requireOrg, can } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { TeamForm } from './team-form'
import { DeleteTeamButton } from './delete-button'

export default async function TeamsPage() {
  const { profile } = await requireOrg()
  const supabase = await createClient()
  const canManage = await can(PERMISSIONS.DEPARTMENTS_MANAGE)

  const [{ data: teams }, { data: departments }] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name, description, department:departments(name), employees(count)')
      .eq('organization_id', profile.organization_id)
      .order('name'),
    supabase.from('departments').select('id, name').eq('organization_id', profile.organization_id).order('name'),
  ])

  return (
    <div>
      <PageHeader title="Teams" description="Smaller working groups within your departments." />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {teams && teams.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {teams.map((team) => {
                const dept = team.department as { name: string } | null
                const count = (team.employees as unknown as { count: number }[])?.[0]?.count ?? 0
                return (
                  <Card key={team.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{team.name}</p>
                        <p className="text-xs text-subtle">{dept?.name ?? 'No department'}</p>
                        <p className="mt-2 text-xs text-muted-foreground">{count} member{count === 1 ? '' : 's'}</p>
                      </div>
                      {canManage && <DeleteTeamButton teamId={team.id} />}
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : (
            <EmptyState icon={UsersRound} title="No teams yet" description="Create a team to group employees within a department." />
          )}
        </div>

        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>New Team</CardTitle>
            </CardHeader>
            <CardContent>
              <TeamForm departments={departments ?? []} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

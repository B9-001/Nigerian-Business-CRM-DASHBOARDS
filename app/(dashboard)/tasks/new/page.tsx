import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card } from '@/components/ui/card'
import { TaskForm } from '../task-form'

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>
}) {
  const { projectId } = await searchParams
  const { profile } = await requirePermission(PERMISSIONS.TASKS_CREATE)
  const supabase = await createClient()

  const [{ data: projects }, { data: departments }, { data: members }] = await Promise.all([
    supabase.from('projects').select('id, name').eq('organization_id', profile.organization_id).order('name'),
    supabase.from('departments').select('id, name').eq('organization_id', profile.organization_id).order('name'),
    supabase.from('profiles').select('id, full_name, email').eq('organization_id', profile.organization_id).order('full_name'),
  ])

  return (
    <div>
      <PageHeader title="New Task" />
      <Card className="max-w-2xl">
        <TaskForm
          projects={projects ?? []}
          departments={departments ?? []}
          members={members ?? []}
          defaultProjectId={projectId}
        />
      </Card>
    </div>
  )
}

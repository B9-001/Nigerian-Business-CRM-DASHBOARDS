import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card } from '@/components/ui/card'
import { ProjectForm } from '../project-form'

export default async function NewProjectPage() {
  const { profile } = await requirePermission(PERMISSIONS.PROJECTS_CREATE)
  const supabase = await createClient()
  const { data: departments } = await supabase
    .from('departments')
    .select('id, name')
    .eq('organization_id', profile.organization_id)
    .order('name')

  return (
    <div>
      <PageHeader title="New Project" />
      <Card className="max-w-2xl">
        <ProjectForm departments={departments ?? []} />
      </Card>
    </div>
  )
}

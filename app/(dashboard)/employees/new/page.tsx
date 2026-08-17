import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card } from '@/components/ui/card'
import { EmployeeForm } from '../employee-form'

export default async function NewEmployeePage() {
  const { profile } = await requirePermission(PERMISSIONS.EMPLOYEES_CREATE)
  const supabase = await createClient()

  const [{ data: departments }, { data: teams }, { data: employees }] = await Promise.all([
    supabase.from('departments').select('id, name').eq('organization_id', profile.organization_id).order('name'),
    supabase.from('teams').select('id, name').eq('organization_id', profile.organization_id).order('name'),
    supabase
      .from('employees')
      .select('id, first_name, last_name')
      .eq('organization_id', profile.organization_id)
      .order('first_name'),
  ])

  return (
    <div>
      <PageHeader title="Add Employee" description="Create a new employee record for your organization." />
      <Card className="max-w-2xl">
        <EmployeeForm departments={departments ?? []} teams={teams ?? []} employees={employees ?? []} />
      </Card>
    </div>
  )
}

import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card } from '@/components/ui/card'
import { EmployeeForm } from '../../employee-form'

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { profile } = await requirePermission(PERMISSIONS.EMPLOYEES_UPDATE)
  const supabase = await createClient()

  const [{ data: employee }, { data: departments }, { data: teams }, { data: employees }] = await Promise.all([
    supabase.from('employees').select('*').eq('id', id).eq('organization_id', profile.organization_id).single(),
    supabase.from('departments').select('id, name').eq('organization_id', profile.organization_id).order('name'),
    supabase.from('teams').select('id, name').eq('organization_id', profile.organization_id).order('name'),
    supabase
      .from('employees')
      .select('id, first_name, last_name')
      .eq('organization_id', profile.organization_id)
      .order('first_name'),
  ])

  if (!employee) notFound()

  return (
    <div>
      <PageHeader title={`Edit ${employee.first_name} ${employee.last_name}`} />
      <Card className="max-w-2xl">
        <EmployeeForm departments={departments ?? []} teams={teams ?? []} employees={employees ?? []} initial={employee} />
      </Card>
    </div>
  )
}

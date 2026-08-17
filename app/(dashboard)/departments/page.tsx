import { Building2 } from 'lucide-react'
import { requireOrg, can } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { DepartmentForm } from './department-form'
import { DeleteDepartmentButton } from './delete-button'

export default async function DepartmentsPage() {
  const { profile } = await requireOrg()
  const supabase = await createClient()
  const canManage = await can(PERMISSIONS.DEPARTMENTS_MANAGE)

  const { data: departments } = await supabase
    .from('departments')
    .select('id, name, description, employees(count)')
    .eq('organization_id', profile.organization_id)
    .order('name')

  return (
    <div>
      <PageHeader title="Departments" description="Organize your business into departments." />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {departments && departments.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {departments.map((dept) => {
                const count = (dept.employees as unknown as { count: number }[])?.[0]?.count ?? 0
                return (
                  <Card key={dept.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{dept.name}</p>
                        {dept.description && <p className="mt-0.5 text-xs text-muted-foreground">{dept.description}</p>}
                        <p className="mt-2 text-xs text-subtle">{count} employee{count === 1 ? '' : 's'}</p>
                      </div>
                      {canManage && <DeleteDepartmentButton departmentId={dept.id} />}
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : (
            <EmptyState icon={Building2} title="No departments yet" description="Create your first department to organize employees." />
          )}
        </div>

        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>New Department</CardTitle>
            </CardHeader>
            <CardContent>
              <DepartmentForm />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

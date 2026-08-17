import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string; status?: string }>
}) {
  const { department, status } = await searchParams
  const { profile } = await requirePermission(PERMISSIONS.EMPLOYEES_VIEW)
  const supabase = await createClient()

  let query = supabase
    .from('employees')
    .select('id, first_name, last_name, email, job_title, employment_status, avatar_url, department:departments(name)')
    .eq('organization_id', profile.organization_id)
    .order('first_name', { ascending: true })

  if (department) query = query.eq('department_id', department)
  if (status) query = query.eq('employment_status', status)

  const [{ data: employees }, { data: departments }] = await Promise.all([
    query,
    supabase.from('departments').select('id, name').eq('organization_id', profile.organization_id).order('name'),
  ])

  return (
    <div>
      <PageHeader
        title="Team"
        description="Your organization's employee directory."
        actions={
          <Link
            href="/employees/new"
            className="inline-flex h-10 items-center gap-1.5 rounded-control bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            <Plus size={16} /> Add Employee
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterLink label="All departments" href="/employees" active={!department} />
        {departments?.map((d) => (
          <FilterLink key={d.id} label={d.name} href={`/employees?department=${d.id}`} active={department === d.id} />
        ))}
      </div>

      {employees && employees.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map((employee) => {
            const name = `${employee.first_name} ${employee.last_name}`
            const dept = employee.department as { name: string } | null
            return (
              <Link key={employee.id} href={`/employees/${employee.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <Avatar name={name} src={employee.avatar_url} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                      <p className="truncate text-xs text-muted-foreground">{employee.job_title ?? 'No title set'}</p>
                      <p className="truncate text-xs text-subtle">{dept?.name ?? 'Unassigned'}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <StatusBadge status={employee.employment_status} />
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No employees yet"
          description="Add your first team member to start assigning tasks and projects."
          action={
            <Link href="/employees/new" className="text-sm font-semibold text-primary hover:text-primary-hover">
              Add Employee
            </Link>
          }
        />
      )}
    </div>
  )
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'rounded-full bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary-dark'
          : 'rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-surface-muted'
      }
    >
      {label}
    </Link>
  )
}

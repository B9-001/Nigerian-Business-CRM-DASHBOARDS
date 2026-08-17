import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Mail, Phone, Calendar, Pencil } from 'lucide-react'
import { requirePermission, can } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate } from '@/lib/utils'
import { SuspendButton } from './suspend-button'

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { profile } = await requirePermission(PERMISSIONS.EMPLOYEES_VIEW)
  const supabase = await createClient()

  const { data: employee } = await supabase
    .from('employees')
    .select(
      'id, first_name, last_name, email, phone, job_title, employment_status, avatar_url, join_date, user_id, department:departments(name), team:teams(name), manager:employees!manager_id(first_name,last_name)'
    )
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!employee) notFound()

  const canManage = await can(PERMISSIONS.EMPLOYEES_UPDATE)
  const canSuspend = await can(PERMISSIONS.EMPLOYEES_DELETE)

  const [{ data: tasks }, { data: meetings }] = await Promise.all([
    employee.user_id
      ? supabase
          .from('tasks')
          .select('id, title, status, due_date')
          .eq('organization_id', profile.organization_id)
          .eq('assigned_to', employee.user_id)
          .order('created_at', { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),
    supabase
      .from('meeting_attendees')
      .select('meeting:meetings(id, title, start_time)')
      .eq('organization_id', profile.organization_id)
      .eq('employee_id', employee.id)
      .limit(6),
  ])

  const name = `${employee.first_name} ${employee.last_name}`
  const department = employee.department as { name: string } | null
  const team = employee.team as { name: string } | null
  const manager = employee.manager as { first_name: string; last_name: string } | null

  return (
    <div>
      <PageHeader
        title={name}
        description={employee.job_title ?? undefined}
        actions={
          canManage ? (
            <Link
              href={`/employees/${employee.id}/edit`}
              className="inline-flex h-10 items-center gap-1.5 rounded-control border border-border bg-surface px-4 text-sm font-semibold text-foreground hover:bg-surface-muted"
            >
              <Pencil size={15} /> Edit
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <Avatar name={name} src={employee.avatar_url} size={72} />
            <h2 className="mt-3 text-base font-semibold text-foreground">{name}</h2>
            <p className="text-sm text-muted-foreground">{employee.job_title ?? 'No title set'}</p>
            <div className="mt-2">
              <StatusBadge status={employee.employment_status} />
            </div>
          </div>

          <div className="mt-5 space-y-2.5 border-t border-border pt-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail size={14} /> {employee.email}
            </div>
            {employee.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone size={14} /> {employee.phone}
              </div>
            )}
            {employee.join_date && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar size={14} /> Joined {formatDate(employee.join_date)}
              </div>
            )}
          </div>

          <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
            <p>
              <span className="text-muted-foreground">Department:</span> {department?.name ?? 'Unassigned'}
            </p>
            <p>
              <span className="text-muted-foreground">Team:</span> {team?.name ?? 'Unassigned'}
            </p>
            <p>
              <span className="text-muted-foreground">Manager:</span>{' '}
              {manager ? `${manager.first_name} ${manager.last_name}` : 'None'}
            </p>
          </div>

          {canSuspend && employee.employment_status === 'ACTIVE' && (
            <div className="mt-4 border-t border-border pt-4">
              <SuspendButton employeeId={employee.id} />
            </div>
          )}
        </Card>

        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Assigned Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {tasks && tasks.length > 0 ? (
                <ul className="divide-y divide-border">
                  {tasks.map((task) => (
                    <li key={task.id} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="truncate text-foreground">{task.title}</span>
                      <StatusBadge status={task.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No tasks assigned" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming Meetings</CardTitle>
            </CardHeader>
            <CardContent>
              {meetings && meetings.length > 0 ? (
                <ul className="divide-y divide-border">
                  {meetings.map((m, i) => {
                    const meeting = m.meeting as { id: string; title: string; start_time: string } | null
                    if (!meeting) return null
                    return (
                      <li key={meeting.id ?? i} className="py-2.5 text-sm">
                        <p className="text-foreground">{meeting.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(meeting.start_time)}</p>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <EmptyState title="No upcoming meetings" />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

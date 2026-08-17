import Link from 'next/link'
import { Plus, ListTodo } from 'lucide-react'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { StatusBadge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusSelect } from '@/components/tasks/status-select'
import { KanbanBoard, type KanbanTask } from '@/components/tasks/kanban-board'
import { formatDate, isOverdue } from '@/lib/utils'

type Filter = 'mine' | 'overdue' | 'completed' | 'all'

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; filter?: Filter }>
}) {
  const { view = 'list', filter = 'all' } = await searchParams
  const { user, profile } = await requirePermission(PERMISSIONS.TASKS_VIEW)
  const supabase = await createClient()

  let query = supabase
    .from('tasks')
    .select('id, title, status, priority, due_date, assignee:profiles!assigned_to(full_name, email)')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })

  if (filter === 'mine') query = query.eq('assigned_to', user.id)
  if (filter === 'completed') query = query.eq('status', 'COMPLETED')
  if (filter === 'overdue') query = query.lt('due_date', new Date().toISOString().slice(0, 10)).not('status', 'in', '("COMPLETED","CANCELLED")')

  const { data: tasks } = await query.limit(200)

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Everything your team is working on."
        actions={
          <Link
            href="/tasks/new"
            className="inline-flex h-10 items-center gap-1.5 rounded-control bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            <Plus size={16} /> New Task
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <FilterLink label="All" query={{ view, filter: 'all' }} active={filter === 'all'} />
          <FilterLink label="My Tasks" query={{ view, filter: 'mine' }} active={filter === 'mine'} />
          <FilterLink label="Overdue" query={{ view, filter: 'overdue' }} active={filter === 'overdue'} />
          <FilterLink label="Completed" query={{ view, filter: 'completed' }} active={filter === 'completed'} />
        </div>
        <div className="flex gap-2">
          <FilterLink label="List" query={{ view: 'list', filter }} active={view === 'list'} />
          <FilterLink label="Kanban" query={{ view: 'kanban', filter }} active={view === 'kanban'} />
        </div>
      </div>

      {!tasks || tasks.length === 0 ? (
        <EmptyState icon={ListTodo} title="No tasks found" description="Create a task to get your team moving." />
      ) : view === 'kanban' ? (
        <KanbanBoard tasks={tasks as unknown as KanbanTask[]} />
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Assignee</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tasks.map((task) => {
                const assignee = task.assignee as unknown as { full_name: string | null; email: string } | null
                return (
                  <tr key={task.id} className="hover:bg-surface-muted/60">
                    <td className="px-4 py-3">
                      <Link href={`/tasks/${task.id}`} className="font-medium text-foreground hover:text-primary">
                        {task.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {assignee ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={assignee.full_name ?? assignee.email} size={22} />
                          <span className="text-muted-foreground">{assignee.full_name ?? assignee.email}</span>
                        </div>
                      ) : (
                        <span className="text-subtle">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={task.priority} />
                    </td>
                    <td className={`px-4 py-3 ${isOverdue(task.due_date) && task.status !== 'COMPLETED' ? 'text-danger' : 'text-muted-foreground'}`}>
                      {task.due_date ? formatDate(task.due_date) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusSelect taskId={task.id} status={task.status} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FilterLink({ label, query, active }: { label: string; query: Record<string, string>; active: boolean }) {
  const params = new URLSearchParams(query).toString()
  return (
    <Link
      href={`/tasks?${params}`}
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

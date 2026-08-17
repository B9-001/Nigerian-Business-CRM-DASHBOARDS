import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Plus } from 'lucide-react'
import { requirePermission, can } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusSelect } from '@/components/tasks/status-select'
import { formatDate, formatDateTime, isOverdue } from '@/lib/utils'
import { CommentForm } from './comment-form'
import { DeleteTaskButton } from './delete-button'

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { profile } = await requirePermission(PERMISSIONS.TASKS_VIEW)
  const supabase = await createClient()

  const { data: task } = await supabase
    .from('tasks')
    .select(
      'id, title, description, status, priority, due_date, estimated_hours, created_at, project:projects(id, name), assignee:profiles!assigned_to(full_name, email), creator:profiles!created_by(full_name, email)'
    )
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!task) notFound()

  const [{ data: comments }, { data: subtasks }, { data: attachments }, canDelete] = await Promise.all([
    supabase
      .from('task_comments')
      .select('id, body, created_at, author:profiles!author_id(full_name, email)')
      .eq('task_id', id)
      .order('created_at', { ascending: true }),
    supabase.from('tasks').select('id, title, status').eq('parent_task_id', id).order('created_at'),
    supabase.from('task_attachments').select('id, file_name, created_at').eq('task_id', id).order('created_at'),
    can(PERMISSIONS.TASKS_DELETE),
  ])

  const project = task.project as { id: string; name: string } | null
  const assignee = task.assignee as { full_name: string | null; email: string } | null
  const creator = task.creator as { full_name: string | null; email: string } | null

  return (
    <div>
      <PageHeader
        title={task.title}
        description={project ? `In project: ${project.name}` : undefined}
        actions={canDelete ? <DeleteTaskButton taskId={task.id} /> : undefined}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-foreground">{task.description || 'No description provided.'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Subtasks</CardTitle>
              <Link
                href={`/tasks/new?parentTaskId=${task.id}`}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover"
              >
                <Plus size={13} /> Add subtask
              </Link>
            </CardHeader>
            <CardContent>
              {subtasks && subtasks.length > 0 ? (
                <ul className="divide-y divide-border">
                  {subtasks.map((s) => (
                    <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                      <Link href={`/tasks/${s.id}`} className="text-foreground hover:text-primary">
                        {s.title}
                      </Link>
                      <StatusBadge status={s.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No subtasks" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attachments</CardTitle>
            </CardHeader>
            <CardContent>
              {attachments && attachments.length > 0 ? (
                <ul className="space-y-1.5 text-sm">
                  {attachments.map((a) => (
                    <li key={a.id} className="text-foreground">
                      {a.file_name}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No attachments" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardContent>
              {comments && comments.length > 0 ? (
                <ul className="space-y-4">
                  {comments.map((c) => {
                    const author = c.author as { full_name: string | null; email: string } | null
                    return (
                      <li key={c.id} className="flex gap-3">
                        <Avatar name={author?.full_name ?? author?.email ?? '?'} size={30} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-medium text-foreground">{author?.full_name ?? author?.email}</span>
                            <span className="text-xs text-subtle">{formatDateTime(c.created_at)}</span>
                          </div>
                          <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{c.body}</p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <EmptyState title="No comments yet" />
              )}
              <CommentForm taskId={task.id} />
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit space-y-4">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Status</p>
            <StatusSelect taskId={task.id} status={task.status} />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Priority</p>
            <StatusBadge status={task.priority} />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Assignee</p>
            {assignee ? (
              <div className="flex items-center gap-2">
                <Avatar name={assignee.full_name ?? assignee.email} size={26} />
                <span className="text-sm text-foreground">{assignee.full_name ?? assignee.email}</span>
              </div>
            ) : (
              <span className="text-sm text-subtle">Unassigned</span>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Due date</p>
            <p className={`text-sm ${isOverdue(task.due_date) && task.status !== 'COMPLETED' ? 'text-danger font-medium' : 'text-foreground'}`}>
              {task.due_date ? formatDate(task.due_date) : 'No due date'}
            </p>
          </div>
          {task.estimated_hours && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Estimated hours</p>
              <p className="text-sm text-foreground">{task.estimated_hours}h</p>
            </div>
          )}
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Created by</p>
            <p className="text-sm text-foreground">{creator?.full_name ?? creator?.email ?? 'Unknown'}</p>
            <p className="text-xs text-subtle">{formatDateTime(task.created_at)}</p>
          </div>
        </Card>
      </div>
    </div>
  )
}

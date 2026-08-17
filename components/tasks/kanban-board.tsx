'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { updateTaskStatusAction } from '@/app/(dashboard)/tasks/actions'
import { StatusBadge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { formatDate, isOverdue } from '@/lib/utils'

export interface KanbanTask {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  assignee: { full_name: string | null; email: string } | null
}

const COLUMNS = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'COMPLETED', 'CANCELLED']

export function KanbanBoard({ tasks }: { tasks: KanbanTask[] }) {
  const [, startTransition] = useTransition()

  function handleDrop(e: React.DragEvent<HTMLDivElement>, status: string) {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('text/task-id')
    if (taskId) startTransition(() => updateTaskStatusAction(taskId, status))
  }

  return (
    <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-2">
      {COLUMNS.map((status) => {
        const columnTasks = tasks.filter((t) => t.status === status)
        return (
          <div
            key={status}
            className="w-72 shrink-0 rounded-card bg-surface-muted p-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, status)}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {status.replace('_', ' ')}
              </span>
              <span className="text-xs text-subtle">{columnTasks.length}</span>
            </div>
            <div className="space-y-2.5">
              {columnTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/task-id', task.id)}
                  className="block rounded-control border border-border bg-surface p-3 shadow-soft transition-shadow hover:shadow-md"
                >
                  <p className="text-sm font-medium text-foreground">{task.title}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <StatusBadge status={task.priority} />
                    {task.assignee && <Avatar name={task.assignee.full_name ?? task.assignee.email} size={22} />}
                  </div>
                  {task.due_date && (
                    <p className={`mt-1.5 text-xs ${isOverdue(task.due_date) && status !== 'COMPLETED' ? 'text-danger' : 'text-subtle'}`}>
                      Due {formatDate(task.due_date)}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

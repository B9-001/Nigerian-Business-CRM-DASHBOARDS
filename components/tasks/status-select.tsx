'use client'

import { useTransition } from 'react'
import { updateTaskStatusAction } from '@/app/(dashboard)/tasks/actions'

const STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'COMPLETED', 'CANCELLED']

export function StatusSelect({ taskId, status }: { taskId: string; status: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => startTransition(() => updateTaskStatusAction(taskId, e.target.value))}
      className="h-8 rounded-control border border-border bg-surface px-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
      onClick={(e) => e.stopPropagation()}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s.replace('_', ' ')}
        </option>
      ))}
    </select>
  )
}

'use client'

import { useTransition } from 'react'
import { updateProjectStatusAction } from '../actions'

const STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']

export function ProjectStatusSelect({ projectId, status }: { projectId: string; status: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => startTransition(() => updateProjectStatusAction(projectId, e.target.value))}
      className="h-9 rounded-control border border-border bg-surface px-2.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s.replace('_', ' ')}
        </option>
      ))}
    </select>
  )
}

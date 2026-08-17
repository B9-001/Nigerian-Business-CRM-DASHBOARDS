'use client'

import { useTransition } from 'react'
import { updateTicketAction } from '../../crm/actions'

export function TicketControls({ ticketId, status, priority }: { ticketId: string; status: string; priority: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-wrap gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
        <select
          value={status}
          disabled={pending}
          onChange={(e) => startTransition(() => updateTicketAction(ticketId, { status: e.target.value }))}
          className="h-9 rounded-control border border-border bg-surface px-2.5 text-xs font-medium focus:border-primary focus:outline-none"
        >
          {['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'].map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Priority</label>
        <select
          value={priority}
          disabled={pending}
          onChange={(e) => startTransition(() => updateTicketAction(ticketId, { priority: e.target.value }))}
          className="h-9 rounded-control border border-border bg-surface px-2.5 text-xs font-medium focus:border-primary focus:outline-none"
        >
          {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

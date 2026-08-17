'use client'

import { useTransition } from 'react'
import { updateLeadStatusAction, convertLeadAction } from '../actions'
import { Avatar } from '@/components/ui/avatar'

const STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']

export function LeadCard({
  lead,
}: {
  lead: { id: string; name: string; company: string | null; status: string; owner: { full_name: string | null; email: string } | null }
}) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="rounded-control border border-border bg-surface p-3 shadow-soft">
      <p className="text-sm font-medium text-foreground">{lead.name}</p>
      {lead.company && <p className="text-xs text-muted-foreground">{lead.company}</p>}
      <div className="mt-2 flex items-center justify-between">
        {lead.owner ? <Avatar name={lead.owner.full_name ?? lead.owner.email} size={22} /> : <span />}
      </div>
      <select
        value={lead.status}
        disabled={pending}
        onChange={(e) => startTransition(() => updateLeadStatusAction(lead.id, e.target.value))}
        className="mt-2 h-8 w-full rounded-control border border-border bg-surface-muted px-2 text-xs focus:border-primary focus:outline-none"
      >
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {lead.status !== 'WON' && (
        <button
          disabled={pending}
          onClick={() => startTransition(() => convertLeadAction(lead.id))}
          className="mt-2 w-full rounded-control bg-primary-soft px-2 py-1.5 text-xs font-semibold text-primary-dark hover:bg-primary-soft/70"
        >
          Convert to customer
        </button>
      )}
    </div>
  )
}

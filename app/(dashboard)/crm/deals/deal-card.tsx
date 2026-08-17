'use client'

import { useTransition } from 'react'
import { updateDealStageAction } from '../actions'
import { Avatar } from '@/components/ui/avatar'
import { formatNaira } from '@/lib/utils'

const STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']

export function DealCard({
  deal,
}: {
  deal: { id: string; title: string; value_ngn: number; stage: string; owner: { full_name: string | null; email: string } | null }
}) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="rounded-control border border-border bg-surface p-3 shadow-soft">
      <p className="text-sm font-medium text-foreground">{deal.title}</p>
      <p className="text-xs font-semibold text-primary">{formatNaira(deal.value_ngn)}</p>
      <div className="mt-2 flex items-center justify-between">
        {deal.owner ? <Avatar name={deal.owner.full_name ?? deal.owner.email} size={22} /> : <span />}
      </div>
      <select
        value={deal.stage}
        disabled={pending}
        onChange={(e) => startTransition(() => updateDealStageAction(deal.id, e.target.value))}
        className="mt-2 h-8 w-full rounded-control border border-border bg-surface-muted px-2 text-xs focus:border-primary focus:outline-none"
      >
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { initiateRefundAction } from './actions'
import { Button } from '@/components/ui/button'

export function RefundButton({ transactionId }: { transactionId: string }) {
  const [reason, setReason] = useState('')
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  if (!open) {
    return (
      <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
        Refund
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason"
        className="h-8 w-32 rounded-control border border-border bg-surface px-2 text-xs focus:border-primary focus:outline-none"
      />
      <Button
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() => startTransition(() => initiateRefundAction(transactionId, reason))}
      >
        {pending ? 'Processing…' : 'Confirm'}
      </Button>
    </div>
  )
}

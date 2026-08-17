'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

const REASONS = ['Too expensive', 'Missing features', 'Technical issues', 'Business closed', 'Not using enough', 'Other']

export function CancelSubscriptionButton() {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(REASONS[0])
  const [immediate, setImmediate] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function submit() {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ immediate, reason }),
      })
      if (res.ok) {
        setOpen(false)
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="destructive" className="w-full" onClick={() => setOpen(true)}>
        Cancel Subscription
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4">
          <div className="w-full max-w-sm rounded-card bg-surface p-5 shadow-soft">
            <h3 className="text-sm font-semibold text-foreground">Cancel your subscription?</h3>
            <p className="mt-1 text-xs text-muted-foreground">Why are you cancelling? (optional, helps us improve)</p>

            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-3 h-10 w-full rounded-control border border-border bg-surface px-2.5 text-sm focus:border-primary focus:outline-none"
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <div className="mt-4 space-y-2 text-sm">
              <label className="flex items-start gap-2">
                <input type="radio" name="cancel-mode" checked={!immediate} onChange={() => setImmediate(false)} className="mt-0.5" />
                <span>
                  <span className="font-medium text-foreground">Cancel at end of billing period</span>
                  <span className="block text-xs text-muted-foreground">Keep access until your current period ends. Recommended.</span>
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input type="radio" name="cancel-mode" checked={immediate} onChange={() => setImmediate(true)} className="mt-0.5" />
                <span>
                  <span className="font-medium text-foreground">Cancel immediately</span>
                  <span className="block text-xs text-muted-foreground">Access ends right away. No refund for the remaining period.</span>
                </span>
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)} disabled={loading}>
                Keep subscription
              </Button>
              <Button variant="destructive" className="flex-1" onClick={submit} disabled={loading}>
                {loading ? 'Cancelling…' : 'Confirm cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function ResumeSubscriptionButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function resume() {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume: true }),
      })
      if (res.ok) router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={resume} disabled={loading}>
      {loading ? 'Resuming…' : 'Keep subscription active'}
    </Button>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function UpgradeButton({ planId, label = 'Upgrade' }: { planId: string; label?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingInterval: 'monthly' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not start checkout')
        setLoading(false)
        return
      }
      window.location.href = data.authorizationUrl
    } catch {
      setError('Network error')
      setLoading(false)
    }
  }

  return (
    <div>
      <Button className="w-full" onClick={start} disabled={loading}>
        {loading ? 'Redirecting to Paystack…' : label}
      </Button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}

export function DowngradeButton({ planId }: { planId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function start() {
    if (!confirm('Schedule a downgrade to this plan? It will take effect at the end of your current billing period.')) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/downgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not schedule downgrade')
        setLoading(false)
        return
      }
      router.refresh()
    } catch {
      setError('Network error')
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button variant="secondary" className="w-full" onClick={start} disabled={loading}>
        {loading ? 'Scheduling…' : 'Downgrade'}
      </Button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}

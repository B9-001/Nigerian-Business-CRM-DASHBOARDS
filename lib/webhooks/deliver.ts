import 'server-only'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { signPayload } from './sign'
import type { Json } from '@/types/database'

const MAX_ATTEMPTS = 8
const BASE_DELAY_MS = 30_000
const MAX_DELAY_MS = 60 * 60 * 1000

/**
 * Fans an event out to every active webhook_endpoint subscribed to it.
 * Called synchronously from API routes/server actions right after the
 * triggering write — this only ENQUEUES (inserts a PENDING delivery row);
 * the actual HTTP POST happens in deliverPendingWebhooks(), run by
 * workers/webhooks so a slow/broken customer endpoint never blocks the
 * request that created the event.
 */
export async function enqueueWebhookDelivery(
  organizationId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  const admin = createAdminClient()

  const { data: endpoints } = await admin
    .from('webhook_endpoints')
    .select('id, events')
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  const targets = (endpoints ?? []).filter((e) => e.events.includes(eventType) || e.events.includes('*'))
  if (targets.length === 0) return

  await admin.from('webhook_deliveries').insert(
    targets.map((endpoint) => ({
      organization_id: organizationId,
      webhook_endpoint_id: endpoint.id,
      event_type: eventType,
      payload: payload as Json,
      status: 'PENDING' as const,
      idempotency_key: crypto.randomUUID(),
    }))
  )
}

/**
 * Delivers pending webhook deliveries whose retry time has arrived. Meant
 * to be called on an interval by workers/webhooks/index.ts. Exponential
 * backoff (30s * 2^attempts, capped at 1h); gives up after MAX_ATTEMPTS.
 */
export async function deliverPendingWebhooks(): Promise<{ delivered: number; failed: number }> {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: pending } = await admin
    .from('webhook_deliveries')
    .select('id, organization_id, webhook_endpoint_id, event_type, payload, attempt_count')
    .eq('status', 'PENDING')
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .limit(50)

  let delivered = 0
  let failed = 0

  for (const delivery of pending ?? []) {
    const { data: endpoint } = await admin
      .from('webhook_endpoints')
      .select('url, secret')
      .eq('id', delivery.webhook_endpoint_id)
      .single()

    if (!endpoint) {
      await admin.from('webhook_deliveries').update({ status: 'FAILED' }).eq('id', delivery.id)
      failed += 1
      continue
    }

    const body = JSON.stringify({ event: delivery.event_type, data: delivery.payload })
    const signature = signPayload(endpoint.secret, body)

    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': `sha256=${signature}` },
        body,
        signal: AbortSignal.timeout(10_000),
      })

      if (res.ok) {
        await admin
          .from('webhook_deliveries')
          .update({ status: 'SUCCESS', attempt_count: delivery.attempt_count + 1, last_attempt_at: now, response_status: res.status })
          .eq('id', delivery.id)
        delivered += 1
      } else {
        await failAttempt(delivery.id, delivery.attempt_count, res.status)
        failed += 1
      }
    } catch {
      await failAttempt(delivery.id, delivery.attempt_count, null)
      failed += 1
    }
  }

  return { delivered, failed }

  async function failAttempt(id: string, attemptCount: number, responseStatus: number | null) {
    const nextAttempt = attemptCount + 1
    const isTerminal = nextAttempt >= MAX_ATTEMPTS
    const delay = Math.min(BASE_DELAY_MS * 2 ** attemptCount, MAX_DELAY_MS)

    await admin
      .from('webhook_deliveries')
      .update({
        status: isTerminal ? 'FAILED' : 'PENDING',
        attempt_count: nextAttempt,
        last_attempt_at: new Date().toISOString(),
        next_retry_at: isTerminal ? null : new Date(Date.now() + delay).toISOString(),
        response_status: responseStatus,
      })
      .eq('id', id)
  }
}

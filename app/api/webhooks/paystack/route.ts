import { NextResponse, type NextRequest } from 'next/server'
import { verifyPaystackWebhookSignature } from '@/lib/billing/paystack'
import { processVerifiedTransaction } from '@/lib/billing/process-payment'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import type { Json } from '@/types/database'

/**
 * Paystack webhook. Every event is persisted to billing_events BEFORE
 * processing, keyed on a deterministic idempotency_key
 * (`${event_type}:${reference-or-id}`) so a redelivered event can never be
 * processed twice — Paystack retries webhooks on anything but a 200, so
 * redelivery is the expected common case, not an edge case.
 */
export async function POST(request: NextRequest) {
  const admin = createAdminClient()

  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const { allowed } = await checkRateLimit(`webhook-inbound:paystack:${ip}`, RATE_LIMITS.WEBHOOK_INBOUND.limit, RATE_LIMITS.WEBHOOK_INBOUND.windowMs)
    if (!allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const rawBody = await request.text()
    const signature = request.headers.get('x-paystack-signature')

    if (!verifyPaystackWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(rawBody) as { event: string; data: Record<string, unknown> }
    const reference = (event.data?.reference as string | undefined) ?? null
    const idempotencyKey = `${event.event}:${reference ?? event.data?.id ?? rawBody.length}`

    const { data: existing } = await admin
      .from('billing_events')
      .select('id, processed')
      .eq('provider', 'paystack')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()

    if (existing?.processed) {
      // Already handled — acknowledge without reprocessing.
      return NextResponse.json({ received: true, duplicate: true });
    }

    const { data: eventRow } = existing
      ? { data: existing }
      : await admin
          .from('billing_events')
          .insert({ provider: 'paystack', event_type: event.event, idempotency_key: idempotencyKey, reference, payload: event as unknown as Json })
          .select('id')
          .single();

    try {
      switch (event.event) {
        case 'charge.success':
          if (reference) await processVerifiedTransaction(reference)
          break
        case 'refund.processed':
        case 'refund.failed': {
          const providerRefundId = String(event.data?.id ?? '')
          if (providerRefundId) {
            await admin
              .from('refunds')
              .update({ status: event.event === 'refund.processed' ? 'PROCESSED' : 'FAILED' })
              .eq('provider_refund_id', providerRefundId)
          }
          break
        }
        default:
          // Unhandled event types are still recorded (for the platform
          // admin's webhook-events viewer) but require no action.
          break
      }

      if (eventRow) {
        await admin.from('billing_events').update({ processed: true, processed_at: new Date().toISOString() }).eq('id', eventRow.id)
      }
    } catch (processingError) {
      console.error('[webhooks/paystack] event processing failed', event.event, processingError)
      if (eventRow) {
        await admin
          .from('billing_events')
          .update({ error_message: processingError instanceof Error ? processingError.message : String(processingError) })
          .eq('id', eventRow.id)
      }
      // Still return 200 to prevent Paystack hammering retries for an error
      // that (e.g.) a missing plan won't fix on redelivery — the event is
      // captured in billing_events for admin inspection/manual retry.
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[webhooks/paystack] unhandled error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

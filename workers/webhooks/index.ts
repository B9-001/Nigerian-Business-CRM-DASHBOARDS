/**
 * Webhook delivery worker. Polls for PENDING webhook_deliveries whose retry
 * time has arrived and attempts delivery with exponential backoff. Run as a
 * standalone process: `npm run worker:webhooks`.
 *
 * Implemented as a simple interval loop rather than a BullMQ repeatable job
 * — deliverPendingWebhooks() is idempotent-safe to call on any cadence, and
 * this keeps the worker runnable even before Redis/BullMQ is provisioned in
 * an environment (it only needs Supabase + network access to customer URLs).
 */
import { deliverPendingWebhooks } from '@/lib/webhooks/deliver'

const INTERVAL_MS = 30_000

async function tick() {
  try {
    const { delivered, failed } = await deliverPendingWebhooks()
    if (delivered || failed) {
      console.log(`[worker:webhooks] delivered=${delivered} failed=${failed}`)
    }
  } catch (err) {
    console.error('[worker:webhooks] tick failed', err)
  }
}

function startWorker() {
  console.log('[worker:webhooks] started, polling every', INTERVAL_MS, 'ms')
  tick()
  setInterval(tick, INTERVAL_MS)
}

startWorker()

import { NextResponse, type NextRequest } from 'next/server'
import { createHmac } from 'node:crypto'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'

/**
 * Inbound Zoom webhooks. Handles the URL-validation handshake Zoom performs
 * when you register the endpoint, then verifies real events via the
 * documented `v0:timestamp:body` HMAC scheme before touching the database.
 * https://developers.zoom.us/docs/api/webhooks/
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const { allowed } = await checkRateLimit(`webhook-inbound:zoom:${ip}`, RATE_LIMITS.WEBHOOK_INBOUND.limit, RATE_LIMITS.WEBHOOK_INBOUND.windowMs)
    if (!allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const rawBody = await request.text()
    const body = JSON.parse(rawBody)

    // Zoom endpoint URL validation handshake.
    if (body.event === 'endpoint.url_validation') {
      const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN
      if (!secret) return NextResponse.json({ error: 'Zoom webhook secret not configured' }, { status: 501 })
      const hash = createHmac('sha256', secret).update(body.payload.plainToken).digest('hex')
      return NextResponse.json({ plainToken: body.payload.plainToken, encryptedToken: hash })
    }

    const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN
    const signatureHeader = request.headers.get('x-zm-signature')
    const timestamp = request.headers.get('x-zm-request-timestamp')

    if (!secret || !signatureHeader || !timestamp) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    const expected = 'v0=' + createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex')
    if (expected !== signatureHeader) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    if (body.event === 'meeting.ended' || body.event?.startsWith('recording.')) {
      const providerMeetingId = String(body.payload?.object?.id ?? '')
      const admin = createAdminClient()

      const { data: meeting } = await admin
        .from('meetings')
        .select('id, organization_id')
        .eq('provider', 'ZOOM')
        .eq('provider_meeting_id', providerMeetingId)
        .maybeSingle()

      if (meeting) {
        if (body.event === 'meeting.ended') {
          await admin.from('meetings').update({ status: 'COMPLETED' }).eq('id', meeting.id)
        }

        if (body.event?.startsWith('recording.')) {
          // Idempotent: unique(organization_id, idempotency_key) prevents
          // duplicate rows if Zoom redelivers the same event.
          await admin
            .from('meeting_artifacts')
            .upsert(
              {
                organization_id: meeting.organization_id,
                meeting_id: meeting.id,
                type: 'RECORDING',
                external_id: providerMeetingId,
                idempotency_key: String(body.event_ts ?? body.payload?.object?.uuid ?? crypto.randomUUID()),
              },
              { onConflict: 'organization_id,idempotency_key', ignoreDuplicates: true }
            )
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[webhooks/zoom] unhandled error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

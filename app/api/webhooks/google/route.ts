import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'

/**
 * Inbound Google push notifications (Calendar/Meet watch channels). Google
 * sends headers, not a JSON body, for resource-change notifications:
 *   X-Goog-Channel-ID, X-Goog-Channel-Token, X-Goog-Resource-ID,
 *   X-Goog-Resource-State ('sync' | 'exists' | 'not_exists'), X-Goog-Message-Number
 *
 * X-Goog-Channel-Token should be compared against a value stored when the
 * watch channel was registered (not implemented in this environment — no
 * live Google Workspace project to register a channel against). The
 * structure below is correct and ready for that piece to be wired in.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const { allowed } = await checkRateLimit(`webhook-inbound:google:${ip}`, RATE_LIMITS.WEBHOOK_INBOUND.limit, RATE_LIMITS.WEBHOOK_INBOUND.windowMs)
    if (!allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const resourceState = request.headers.get('x-goog-resource-state')
    const channelToken = request.headers.get('x-goog-channel-token')
    const resourceId = request.headers.get('x-goog-resource-id')

    if (resourceState === 'sync') {
      // Initial sync message when the channel is created — nothing to do.
      return NextResponse.json({ ok: true })
    }

    if (!channelToken) {
      return NextResponse.json({ error: 'Missing channel token' }, { status: 401 })
    }

    // TODO: look up the organization by the stored channel token once
    // watch-channel registration is implemented, then fetch the changed
    // resource via the Calendar/Meet API and update the matching `meetings`
    // row (mirrors the Zoom webhook's meeting.ended handling above).
    console.log('[webhooks/google] resource change notification', { resourceState, resourceId })

    const admin = createAdminClient()
    void admin // reserved for the lookup described above

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[webhooks/google] unhandled error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

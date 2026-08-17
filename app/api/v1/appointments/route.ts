import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { verifyApiKey } from '@/lib/security/api-keys'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { enqueueWebhookDelivery } from '@/lib/webhooks/deliver'

const schema = z.object({
  title: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().optional(),
  customerEmail: z.string().email().optional(),
  description: z.string().optional(),
})

/** POST /api/v1/appointments — external booking creates a `meetings` row (provider OTHER). */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyApiKey(request.headers.get('authorization'))
    if (!auth) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })

    const { allowed } = await checkRateLimit(`public-api:${auth.organizationId}`, RATE_LIMITS.PUBLIC_API.limit, RATE_LIMITS.PUBLIC_API.windowMs)
    if (!allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 })

    const admin = createAdminClient()

    let customerId: string | null = null
    if (parsed.data.customerEmail) {
      const { data: existing } = await admin
        .from('customers')
        .select('id')
        .eq('organization_id', auth.organizationId)
        .eq('email', parsed.data.customerEmail)
        .maybeSingle()
      customerId = existing?.id ?? null
    }

    const { data: meeting, error } = await admin
      .from('meetings')
      .insert({
        organization_id: auth.organizationId,
        provider: 'OTHER',
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        start_time: new Date(parsed.data.startTime).toISOString(),
        end_time: parsed.data.endTime ? new Date(parsed.data.endTime).toISOString() : null,
        customer_id: customerId,
      })
      .select('id, title, start_time, status')
      .single()

    if (error || !meeting) return NextResponse.json({ error: 'Could not create appointment' }, { status: 500 })

    await enqueueWebhookDelivery(auth.organizationId, 'meeting.created', meeting)
    return NextResponse.json(meeting, { status: 201 })
  } catch (err) {
    console.error('[api/v1/appointments] unhandled error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Note: /api/v1/products and /api/v1/orders from CLAUDE.md #27 are examples
// for a future inventory/commerce module (CLAUDE.md #65) — no backing tables
// exist yet, so they're intentionally not implemented here.

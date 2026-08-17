import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { verifyApiKey } from '@/lib/security/api-keys'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { enqueueWebhookDelivery } from '@/lib/webhooks/deliver'

const schema = z.object({
  subject: z.string().min(1),
  description: z.string().optional(),
  customerEmail: z.string().email().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
})

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

    const { data: ticket, error } = await admin
      .from('tickets')
      .insert({
        organization_id: auth.organizationId,
        customer_id: customerId,
        subject: parsed.data.subject,
        description: parsed.data.description ?? null,
        priority: parsed.data.priority ?? 'MEDIUM',
      })
      .select('id, subject, status, priority, created_at')
      .single()

    if (error || !ticket) return NextResponse.json({ error: 'Could not create ticket' }, { status: 500 })

    await enqueueWebhookDelivery(auth.organizationId, 'ticket.created', ticket)
    return NextResponse.json(ticket, { status: 201 })
  } catch (err) {
    console.error('[api/v1/tickets] unhandled error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

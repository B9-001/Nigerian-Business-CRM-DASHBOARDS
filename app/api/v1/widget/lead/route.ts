import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { enqueueWebhookDelivery } from '@/lib/webhooks/deliver'

const schema = z.object({
  widgetKey: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  message: z.string().optional(),
})

/**
 * Lead capture from the embeddable website widget (app/widget.js). Resolves
 * the organization via the PUBLIC widget key ONLY — never the secret
 * webhook key — so this endpoint is safe to call from any customer website.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const { allowed } = await checkRateLimit(`widget:${ip}`, RATE_LIMITS.WIDGET.limit, RATE_LIMITS.WIDGET.windowMs)
    if (!allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const admin = createAdminClient()
    const { data: organization } = await admin
      .from('organizations')
      .select('id')
      .eq('public_widget_key', parsed.data.widgetKey)
      .maybeSingle()

    if (!organization) return NextResponse.json({ error: 'Invalid widget key' }, { status: 404 })

    const { data: lead, error } = await admin
      .from('leads')
      .insert({
        organization_id: organization.id,
        name: parsed.data.name,
        email: parsed.data.email,
        notes: parsed.data.message ?? null,
        source: 'website_widget',
      })
      .select('id')
      .single()

    if (error || !lead) return NextResponse.json({ error: 'Could not submit' }, { status: 500 })

    await enqueueWebhookDelivery(organization.id, 'lead.created', lead)
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    console.error('[api/v1/widget/lead] unhandled error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

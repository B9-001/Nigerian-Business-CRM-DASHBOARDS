import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { verifyApiKey } from '@/lib/security/api-keys'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { enqueueWebhookDelivery } from '@/lib/webhooks/deliver'

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  source: z.string().optional(),
})

/**
 * POST /api/v1/leads — public API, authenticated via `Authorization: Bearer <api key>`.
 * See CLAUDE.md #27-28.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyApiKey(request.headers.get('authorization'))
    if (!auth) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
    }

    const { allowed } = await checkRateLimit(`public-api:${auth.organizationId}`, RATE_LIMITS.PUBLIC_API.limit, RATE_LIMITS.PUBLIC_API.windowMs)
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await request.json().catch(() => null)
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: lead, error } = await admin
      .from('leads')
      .insert({ organization_id: auth.organizationId, ...parsed.data })
      .select('id, name, status, created_at')
      .single()

    if (error || !lead) {
      return NextResponse.json({ error: 'Could not create lead' }, { status: 500 })
    }

    await enqueueWebhookDelivery(auth.organizationId, 'lead.created', lead)

    return NextResponse.json(lead, { status: 201 })
  } catch (err) {
    console.error('[api/v1/leads] unhandled error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

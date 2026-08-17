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

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyApiKey(request.headers.get('authorization'))
    if (!auth) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })

    const { allowed } = await checkRateLimit(`public-api:${auth.organizationId}`, RATE_LIMITS.PUBLIC_API.limit, RATE_LIMITS.PUBLIC_API.windowMs)
    if (!allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 })

    const admin = createAdminClient()
    const { data: customer, error } = await admin
      .from('customers')
      .insert({ organization_id: auth.organizationId, ...parsed.data })
      .select('id, name, status, created_at')
      .single()

    if (error || !customer) return NextResponse.json({ error: 'Could not create customer' }, { status: 500 })

    await enqueueWebhookDelivery(auth.organizationId, 'customer.created', customer)
    return NextResponse.json(customer, { status: 201 })
  } catch (err) {
    console.error('[api/v1/customers] unhandled error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyApiKey(request.headers.get('authorization'))
    if (!auth) return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })

    const { allowed } = await checkRateLimit(`public-api:${auth.organizationId}`, RATE_LIMITS.PUBLIC_API.limit, RATE_LIMITS.PUBLIC_API.windowMs)
    if (!allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('customers')
      .select('id, name, email, company, status, created_at')
      .eq('organization_id', auth.organizationId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ error: 'Could not list customers' }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    console.error('[api/v1/customers] unhandled error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

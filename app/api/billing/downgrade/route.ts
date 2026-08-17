import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { scheduleDowngrade } from '@/lib/billing/subscription'
import { logAuditEvent } from '@/lib/security/audit'

const schema = z.object({ planId: z.string().min(1) })

/**
 * Downgrades don't require payment — schedule the plan change for the end
 * of the current billing period (#17) so the org keeps what it already
 * paid for until then. Upgrades go through /api/billing/checkout instead,
 * since those require a new payment.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, profile } = await requirePermission(PERMISSIONS.BILLING_MANAGE)
    const parsed = schema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const supabase = await createClient()
    const { data: plan } = await supabase.from('plans').select('id, is_active').eq('id', parsed.data.planId).maybeSingle()
    if (!plan || !plan.is_active) {
      return NextResponse.json({ error: 'Plan not available' }, { status: 404 })
    }

    await scheduleDowngrade(profile.organization_id, plan.id)

    await logAuditEvent({
      organizationId: profile.organization_id,
      actorId: user.id,
      action: 'billing.downgrade_scheduled',
      resourceType: 'subscription',
      metadata: { plan_id: plan.id },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[billing/downgrade] unhandled error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

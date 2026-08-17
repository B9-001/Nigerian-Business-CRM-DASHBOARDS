import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/session'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { cancelSubscription, resumeSubscription } from '@/lib/billing/subscription'
import { logAuditEvent } from '@/lib/security/audit'

const schema = z.object({
  immediate: z.boolean().default(false),
  reason: z.string().optional(),
  resume: z.boolean().default(false),
})

/** Cancel (default: at period end, #16) or resume a previously-scheduled cancellation. */
export async function POST(request: NextRequest) {
  try {
    const { user, profile } = await requirePermission(PERMISSIONS.BILLING_MANAGE)
    const parsed = schema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    if (parsed.data.resume) {
      await resumeSubscription(profile.organization_id)
      await logAuditEvent({ organizationId: profile.organization_id, actorId: user.id, action: 'billing.subscription_resumed', resourceType: 'subscription' })
      return NextResponse.json({ ok: true })
    }

    await cancelSubscription(profile.organization_id, parsed.data.immediate)

    await logAuditEvent({
      organizationId: profile.organization_id,
      actorId: user.id,
      action: 'billing.subscription_cancelled',
      resourceType: 'subscription',
      metadata: { immediate: parsed.data.immediate, reason: parsed.data.reason ?? null },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[billing/cancel] unhandled error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { paystackProvider } from '@/lib/billing/paystack'
import { BillingProviderError } from '@/lib/billing/provider'
import { logAuditEvent } from '@/lib/security/audit'

const schema = z.object({
  planId: z.string().min(1),
  billingInterval: z.enum(['monthly', 'annual']).default('monthly'),
})

/**
 * Starts a checkout. The client sends only a plan id — the price is always
 * loaded server-side from `plans` (never trust a client-supplied amount,
 * per CLAUDE.md #44/#57's payment-security rules).
 */
export async function POST(request: NextRequest) {
  try {
    const { user, profile } = await requirePermission(PERMISSIONS.BILLING_MANAGE)

    const parsed = schema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: plan } = await supabase
      .from('plans')
      .select('id, name, price_ngn_month, annual_price_ngn, is_active, is_public')
      .eq('id', parsed.data.planId)
      .maybeSingle()

    if (!plan || !plan.is_active || !plan.is_public) {
      return NextResponse.json({ error: 'Plan not available' }, { status: 404 })
    }

    const amountNgn = parsed.data.billingInterval === 'annual' ? plan.annual_price_ngn : plan.price_ngn_month
    if (amountNgn == null || amountNgn <= 0) {
      return NextResponse.json({ error: 'This plan requires contacting sales' }, { status: 400 })
    }

    const { data: org } = await supabase.from('organizations').select('name').eq('id', profile.organization_id).single()

    const reference = `nbos_${profile.organization_id.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin

    let checkout
    try {
      checkout = await paystackProvider.createCheckout({
        organizationId: profile.organization_id,
        planId: plan.id,
        billingInterval: parsed.data.billingInterval,
        amountNgn,
        email: user.email!,
        reference,
        callbackUrl: `${appUrl}/api/billing/verify?redirect=1`,
        metadata: { organization_name: org?.name },
      })
    } catch (err) {
      console.error('[billing/checkout] Paystack initialize failed', err)
      const message = err instanceof BillingProviderError ? err.message : 'Could not start checkout'
      return NextResponse.json({ error: message }, { status: 502 })
    }

    // Admin client: billing_transactions has no client insert policy — all
    // writes go through verified server routes only.
    const admin = createAdminClient()
    const { error: insertError } = await admin.from('billing_transactions').insert({
      organization_id: profile.organization_id,
      reference: checkout.reference,
      amount: amountNgn,
      currency: 'NGN',
      status: 'PENDING',
      payment_type: 'subscription',
      plan_id: plan.id,
      metadata: { billing_interval: parsed.data.billingInterval, initiated_by: user.id },
    })

    if (insertError) {
      console.error('[billing/checkout] failed to record pending transaction', insertError)
      return NextResponse.json({ error: 'Could not start checkout' }, { status: 500 })
    }

    await logAuditEvent({
      organizationId: profile.organization_id,
      actorId: user.id,
      action: 'billing.checkout_started',
      resourceType: 'billing_transaction',
      metadata: { plan_id: plan.id, reference: checkout.reference },
    })

    return NextResponse.json({ authorizationUrl: checkout.authorizationUrl, reference: checkout.reference })
  } catch (err) {
    console.error('[billing/checkout] unhandled error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

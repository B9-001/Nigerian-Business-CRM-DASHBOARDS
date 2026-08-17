import 'server-only'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { paystackProvider } from './paystack'
import { activateSubscription } from './subscription'
import { createInvoiceForTransaction } from './invoices'
import { logAuditEvent } from '@/lib/security/audit'
import type { Json } from '@/types/database'

export type ProcessResult = 'activated' | 'failed' | 'already_processed' | 'not_found'

/**
 * Shared verify-and-activate logic used by BOTH the checkout callback
 * redirect AND the webhook handler, so a payment gets activated exactly
 * once no matter which path fires first (idempotent — re-checks the
 * transaction's stored status before doing anything, and Paystack itself
 * is the source of truth via verifyPayment(), never the browser redirect
 * alone — CLAUDE.md #44).
 */
export async function processVerifiedTransaction(reference: string): Promise<ProcessResult> {
  const admin = createAdminClient()

  const { data: transaction } = await admin.from('billing_transactions').select('*').eq('reference', reference).maybeSingle()
  if (!transaction) return 'not_found'

  if (transaction.status === 'SUCCESS') {
    return 'already_processed'
  }

  const verified = await paystackProvider.verifyPayment(reference)

  if (verified.status !== 'success') {
    await admin
      .from('billing_transactions')
      .update({
        status: verified.status === 'abandoned' ? 'ABANDONED' : 'FAILED',
        metadata: { ...(transaction.metadata as object), verify: verified.raw } as Json,
      })
      .eq('reference', reference)
    return 'failed'
  }

  // Guard against a concurrent webhook+callback race both reaching this
  // point: re-check status right before writing, and let a unique
  // constraint-free "only update if still PENDING" pattern make the second
  // writer a no-op rather than double-activating.
  const { data: stillPending } = await admin
    .from('billing_transactions')
    .select('id')
    .eq('reference', reference)
    .eq('status', 'PENDING')
    .maybeSingle()

  if (!stillPending) {
    return 'already_processed'
  }

  const planId = transaction.plan_id
  const billingInterval = (transaction.metadata as { billing_interval?: 'monthly' | 'annual' })?.billing_interval ?? 'monthly'

  if (planId) {
    await activateSubscription({
      organizationId: transaction.organization_id,
      planId,
      billingInterval,
      providerCustomerId: verified.customerCode,
    })
  }

  const { data: updatedTransaction } = await admin
    .from('billing_transactions')
    .update({
      status: 'SUCCESS',
      provider_transaction_id: verified.providerTransactionId,
      paid_at: verified.paidAt ?? new Date().toISOString(),
    })
    .eq('reference', reference)
    .eq('status', 'PENDING') // final idempotency guard at the write itself
    .select('*')
    .single()

  if (updatedTransaction) {
    await createInvoiceForTransaction(updatedTransaction)

    await logAuditEvent({
      organizationId: transaction.organization_id,
      actorId: null,
      action: 'billing.payment_succeeded',
      resourceType: 'billing_transaction',
      resourceId: transaction.id,
      metadata: { reference, plan_id: planId },
    })
  }

  return 'activated'
}

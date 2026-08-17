'use server'

import { revalidatePath } from 'next/cache'
import { requirePlatformAdmin } from '@/lib/auth/platform-admin'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { paystackProvider } from '@/lib/billing/paystack'
import { logAuditEvent } from '@/lib/security/audit'

/**
 * Platform-admin-only refund initiation (#27). Ordinary organization users
 * can never reach this — it's not exposed anywhere in the org-facing
 * billing UI, and this action itself re-checks requirePlatformAdmin().
 */
export async function initiateRefundAction(transactionId: string, reason: string) {
  const { user } = await requirePlatformAdmin()
  const admin = createAdminClient()

  const { data: transaction } = await admin.from('billing_transactions').select('*').eq('id', transactionId).single()
  if (!transaction || transaction.status !== 'SUCCESS' || !transaction.provider_transaction_id) return

  const { data: refund } = await admin
    .from('refunds')
    .insert({
      organization_id: transaction.organization_id,
      transaction_id: transaction.id,
      amount: transaction.amount,
      currency: transaction.currency,
      reason,
      status: 'PENDING',
      requested_by: user.id,
      processed_by: user.id,
    })
    .select('id')
    .single()

  try {
    const result = await paystackProvider.createRefund({ providerTransactionId: transaction.provider_transaction_id })
    if (refund) {
      await admin.from('refunds').update({ provider_refund_id: result.providerRefundId, status: 'PROCESSED' }).eq('id', refund.id)
    }
    await admin.from('billing_transactions').update({ status: 'REFUNDED' }).eq('id', transaction.id)
  } catch (err) {
    console.error('[admin/refunds] Paystack refund failed', err)
    if (refund) {
      await admin.from('refunds').update({ status: 'FAILED' }).eq('id', refund.id)
    }
  }

  await logAuditEvent({
    organizationId: transaction.organization_id,
    actorId: user.id,
    action: 'platform_admin.refund_initiated',
    resourceType: 'billing_transaction',
    resourceId: transaction.id,
    metadata: { reason },
  })

  revalidatePath('/admin/refunds')
  revalidatePath('/admin/transactions')
}

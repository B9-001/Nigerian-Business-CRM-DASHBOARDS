import 'server-only'
import type { BillingProvider, CheckoutParams, CheckoutResult, RefundParams, RefundResult, VerifyResult } from './provider'
import { BillingProviderError } from './provider'

const PAYSTACK_BASE_URL = 'https://api.paystack.co'

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) throw new BillingProviderError('PAYSTACK_SECRET_KEY is not configured', 'paystack')
  return key
}

async function paystackFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  const body = await res.json().catch(() => null)

  if (!res.ok || !body?.status) {
    throw new BillingProviderError(body?.message ?? `Paystack request failed (${res.status})`, 'paystack', body)
  }

  return body.data as T
}

/**
 * All checkout transactions are created with the platform's subaccount
 * (PAYSTACK_SUBACCOUNT_CODE) attached — the subaccount was created with
 * percentage_charge=0, meaning it receives 100% of the transaction and the
 * main account (the API keys' owner) retains 0%. See
 * supabase/migrations/20260101001400_billing_paystack.sql for the billing
 * schema this settles into.
 */
export class PaystackProvider implements BillingProvider {
  readonly name = 'paystack' as const

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const subaccount = process.env.PAYSTACK_SUBACCOUNT_CODE

    const data = await paystackFetch<{ authorization_url: string; access_code: string; reference: string }>(
      '/transaction/initialize',
      {
        method: 'POST',
        body: JSON.stringify({
          email: params.email,
          amount: Math.round(params.amountNgn * 100), // NGN -> kobo at the API boundary
          currency: 'NGN',
          reference: params.reference,
          callback_url: params.callbackUrl,
          ...(subaccount ? { subaccount } : {}),
          metadata: {
            organization_id: params.organizationId,
            plan_id: params.planId,
            billing_interval: params.billingInterval,
            ...params.metadata,
          },
        }),
      }
    )

    return { authorizationUrl: data.authorization_url, reference: data.reference, accessCode: data.access_code }
  }

  async verifyPayment(reference: string): Promise<VerifyResult> {
    const data = await paystackFetch<{
      id: number
      status: string
      amount: number
      currency: string
      paid_at: string | null
      reference: string
      customer: { customer_code: string; email: string }
    }>(`/transaction/verify/${encodeURIComponent(reference)}`)

    const status: VerifyResult['status'] = data.status === 'success' ? 'success' : data.status === 'abandoned' ? 'abandoned' : 'failed'

    return {
      reference: data.reference,
      status,
      amountKobo: data.amount,
      currency: data.currency,
      paidAt: data.paid_at,
      providerTransactionId: String(data.id),
      customerCode: data.customer?.customer_code,
      customerEmail: data.customer?.email,
      raw: data,
    }
  }

  async createRefund(params: RefundParams): Promise<RefundResult> {
    const data = await paystackFetch<{ id: number; status: string }>('/refund', {
      method: 'POST',
      body: JSON.stringify({
        transaction: params.providerTransactionId,
        ...(params.amountKobo ? { amount: params.amountKobo } : {}),
        ...(params.reason ? { merchant_note: params.reason } : {}),
      }),
    })

    return { providerRefundId: String(data.id), status: data.status, raw: data }
  }
}

export const paystackProvider = new PaystackProvider()

// Re-exported so existing call sites (app/api/webhooks/paystack/route.ts)
// can keep importing it from '@/lib/billing/paystack' — the implementation
// lives in paystack-signature.ts (no `server-only` guard, so it stays
// unit-testable under plain Node/vitest).
export { verifyPaystackWebhookSignature } from './paystack-signature'

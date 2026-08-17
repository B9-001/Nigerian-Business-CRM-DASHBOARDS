/**
 * Provider-agnostic billing interface. This is BusinessOS's OWN SaaS
 * subscription revenue (organizations paying the platform) — never to be
 * confused with any payments an organization processes from its own
 * customers, which is a separate, unrelated concept this codebase doesn't
 * model at all.
 *
 * lib/billing/paystack.ts is the only implementation today. Adding Stripe
 * or Flutterwave later means writing a new file that implements this same
 * interface — no call site outside lib/billing/ should ever import
 * '@/lib/billing/paystack' directly.
 */

export interface CheckoutParams {
  organizationId: string
  planId: string
  billingInterval: 'monthly' | 'annual'
  amountNgn: number
  email: string
  reference: string
  callbackUrl: string
  metadata?: Record<string, unknown>
}

export interface CheckoutResult {
  authorizationUrl: string
  reference: string
  accessCode?: string
}

export type PaymentStatus = 'success' | 'failed' | 'abandoned'

export interface VerifyResult {
  reference: string
  status: PaymentStatus
  amountKobo: number
  currency: string
  paidAt: string | null
  providerTransactionId: string
  customerCode?: string
  customerEmail?: string
  raw: unknown
}

export interface RefundParams {
  providerTransactionId: string
  amountKobo?: number
  reason?: string
}

export interface RefundResult {
  providerRefundId: string
  status: string
  raw: unknown
}

export interface BillingProvider {
  readonly name: 'paystack' | 'stripe' | 'flutterwave'
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>
  verifyPayment(reference: string): Promise<VerifyResult>
  createRefund(params: RefundParams): Promise<RefundResult>
}

export class BillingProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'BillingProviderError'
  }
}

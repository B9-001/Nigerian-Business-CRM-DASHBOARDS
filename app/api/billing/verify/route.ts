import { NextResponse, type NextRequest } from 'next/server'
import { processVerifiedTransaction } from '@/lib/billing/process-payment'

/**
 * Paystack redirects the browser here after checkout (callback_url). We
 * NEVER trust that the redirect itself means success — Paystack's own
 * transaction/verify endpoint is re-checked server-side via
 * processVerifiedTransaction() before anything is activated. This route
 * and the webhook (/api/webhooks/paystack) share that same function, so
 * whichever fires first wins and the other is a safe no-op.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const reference = searchParams.get('reference') ?? searchParams.get('trxref')
  const billingUrl = `${origin}/settings/billing`

  if (!reference) {
    return NextResponse.redirect(`${billingUrl}?payment=error`)
  }

  try {
    const result = await processVerifiedTransaction(reference)

    if (result === 'activated' || result === 'already_processed') {
      return NextResponse.redirect(`${billingUrl}?payment=success`)
    }
    if (result === 'failed') {
      return NextResponse.redirect(`${billingUrl}?payment=failed`)
    }
    return NextResponse.redirect(`${billingUrl}?payment=error`)
  } catch (err) {
    console.error('[billing/verify] unhandled error', err)
    return NextResponse.redirect(`${billingUrl}?payment=error`)
  }
}

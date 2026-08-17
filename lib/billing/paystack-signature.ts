import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Split out from paystack.ts (which has a `server-only` guard because it
 * makes live API calls) so this pure crypto function can be unit-tested
 * directly under vitest/Node without tripping the `server-only` package's
 * "can't be imported outside a Server Component" check — that check only
 * matters for the Next.js webpack client bundle graph, which a Node test
 * runner isn't part of. Real app code only ever calls this from the
 * webhook Route Handler (a genuine server context) via the re-export in
 * paystack.ts.
 */
function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured')
  }
  return key
}

/**
 * Verifies Paystack's `x-paystack-signature` header: HMAC-SHA512 of the raw
 * request body using the secret key, hex-encoded. Must run against the raw
 * (unparsed) body — parsing and re-serializing JSON can change byte-for-byte
 * output and break the signature.
 */
export function verifyPaystackWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false

  const expected = createHmac('sha512', getSecretKey()).update(rawBody).digest('hex')
  const expectedBuf = Buffer.from(expected, 'hex')
  const actualBuf = Buffer.from(signature, 'hex')

  if (expectedBuf.length !== actualBuf.length) return false
  return timingSafeEqual(expectedBuf, actualBuf)
}

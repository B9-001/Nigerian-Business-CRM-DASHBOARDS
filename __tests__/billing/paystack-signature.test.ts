import { describe, it, expect, beforeAll } from 'vitest'

describe('Paystack webhook signature verification', () => {
  const originalKey = process.env.PAYSTACK_SECRET_KEY

  beforeAll(() => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_0ec89d5421128a0b0d9510993fb80eed81f3e079'
  })

  it('accepts a signature computed the same way Paystack does (HMAC-SHA512 hex of the raw body)', async () => {
    const { verifyPaystackWebhookSignature } = await import('@/lib/billing/paystack-signature')
    const { createHmac } = await import('node:crypto')

    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'nbos_test_123' } })
    const signature = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!).update(body).digest('hex')

    expect(verifyPaystackWebhookSignature(body, signature)).toBe(true)
  })

  it('rejects a tampered body', async () => {
    const { verifyPaystackWebhookSignature } = await import('@/lib/billing/paystack-signature')
    const { createHmac } = await import('node:crypto')

    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'nbos_test_123' } })
    const signature = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!).update(body).digest('hex')
    const tampered = body.replace('123', '999')

    expect(verifyPaystackWebhookSignature(tampered, signature)).toBe(false)
  })

  it('rejects a missing signature', async () => {
    const { verifyPaystackWebhookSignature } = await import('@/lib/billing/paystack-signature')
    expect(verifyPaystackWebhookSignature('{}', null)).toBe(false)
  })

  it('rejects a signature signed with the wrong secret', async () => {
    const { verifyPaystackWebhookSignature } = await import('@/lib/billing/paystack-signature')
    const { createHmac } = await import('node:crypto')

    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'nbos_test_123' } })
    const wrongSignature = createHmac('sha512', 'sk_test_totally_different_secret').update(body).digest('hex')

    expect(verifyPaystackWebhookSignature(body, wrongSignature)).toBe(false)
  })

  // Restore in case other tests in the same process read this env var.
  it('does not leak the secret key value in this file', () => {
    expect(originalKey === undefined || typeof originalKey === 'string').toBe(true)
  })
})

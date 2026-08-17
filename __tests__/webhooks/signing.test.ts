import { describe, it, expect } from 'vitest'
import { signPayload, verifySignature } from '@/lib/webhooks/sign'

describe('webhook signing', () => {
  const secret = 'test-secret-value'
  const payload = JSON.stringify({ event: 'lead.created', data: { id: '123' } })

  it('round-trips: a payload signed with a secret verifies with the same secret', () => {
    const signature = signPayload(secret, payload)
    expect(verifySignature(secret, payload, signature)).toBe(true)
  })

  it('rejects a tampered payload', () => {
    const signature = signPayload(secret, payload)
    const tampered = payload.replace('123', '456')
    expect(verifySignature(secret, tampered, signature)).toBe(false)
  })

  it('rejects a signature produced with a different secret', () => {
    const signature = signPayload('wrong-secret', payload)
    expect(verifySignature(secret, payload, signature)).toBe(false)
  })
})

import { createHmac, timingSafeEqual } from 'node:crypto'

export function signPayload(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function verifySignature(secret: string, payload: string, signature: string): boolean {
  const expected = signPayload(secret, payload)
  const expectedBuf = Buffer.from(expected, 'hex')
  const actualBuf = Buffer.from(signature, 'hex')
  if (expectedBuf.length !== actualBuf.length) return false
  return timingSafeEqual(expectedBuf, actualBuf)
}

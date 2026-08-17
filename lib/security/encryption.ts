import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * AES-256-GCM encryption for integration credentials (Google/Zoom OAuth
 * tokens, etc). Never store these values in plaintext — see
 * supabase/migrations/20260101000900_integrations_webhooks_billing.sql,
 * table `integration_credentials`, which has no client-facing RLS policies.
 */
const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!key) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY is not configured. Generate one with: openssl rand -base64 32')
  }
  const buf = Buffer.from(key, 'base64')
  if (buf.length !== 32) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY must decode to 32 bytes (base64 of `openssl rand -base64 32`).')
  }
  return buf
}

export function encryptCredential(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // pack as iv.authTag.ciphertext, base64
  return [iv, authTag, encrypted].map((b) => b.toString('base64')).join('.')
}

export function decryptCredential(packed: string): string {
  const [ivB64, tagB64, dataB64] = packed.split('.')
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Malformed encrypted credential payload.')

  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(tagB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

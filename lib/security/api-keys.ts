import 'server-only'
import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/database/supabase/admin'

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex')
}

export interface ApiKeyContext {
  organizationId: string
  apiKeyId: string
  scopes: string[]
}

/**
 * Resolves the organization for a public API request from its API key.
 * This is the ONLY source of truth for which tenant a /api/v1 request
 * belongs to — request bodies must never be trusted to say which
 * organization they're for.
 */
export async function verifyApiKey(authHeader: string | null): Promise<ApiKeyContext | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const rawKey = authHeader.slice('Bearer '.length).trim()
  if (!rawKey) return null

  const admin = createAdminClient()
  const keyHash = hashApiKey(rawKey)

  const { data } = await admin
    .from('api_keys')
    .select('id, organization_id, scopes, revoked_at')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (!data || data.revoked_at) return null

  await admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id)

  return { organizationId: data.organization_id, apiKeyId: data.id, scopes: data.scopes }
}

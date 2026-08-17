import 'server-only'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { encryptCredential, decryptCredential } from '@/lib/security/encryption'

export interface OAuthTokenPayload {
  access_token: string
  refresh_token?: string
  expires_at?: number // epoch ms
}

/**
 * Loads and decrypts an organization's OAuth credentials for a given
 * provider. `integration_credentials` has no client-facing RLS policies —
 * this must always run through the admin (service-role) client, and only
 * ever server-side.
 */
export async function getIntegrationTokens(
  organizationId: string,
  provider: 'GOOGLE' | 'ZOOM'
): Promise<OAuthTokenPayload | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('integration_credentials')
    .select('encrypted_payload')
    .eq('organization_id', organizationId)
    .eq('provider', provider)
    .maybeSingle()

  if (!data) return null

  try {
    return JSON.parse(decryptCredential(data.encrypted_payload)) as OAuthTokenPayload
  } catch (err) {
    console.error(`[meetings] failed to decrypt ${provider} credentials for org ${organizationId}`, err)
    return null
  }
}

export async function saveIntegrationTokens(
  organizationId: string,
  provider: 'GOOGLE' | 'ZOOM',
  connectedBy: string,
  tokens: OAuthTokenPayload
): Promise<void> {
  const admin = createAdminClient()
  const encrypted = encryptCredential(JSON.stringify(tokens))
  const expiresAt = tokens.expires_at ? new Date(tokens.expires_at).toISOString() : null

  await admin.from('integration_credentials').upsert(
    {
      organization_id: organizationId,
      provider,
      encrypted_payload: encrypted,
      connected_by: connectedBy,
      connected_at: new Date().toISOString(),
      expires_at: expiresAt,
    },
    { onConflict: 'organization_id,provider' }
  )
}

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const MAX_LOGO_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])

/**
 * Uploads an organization logo to the public `avatars` bucket at
 * `${organizationId}/logo-*`, matching the storage RLS policy
 * (`avatars_owner_write`, path first segment = current_org_id()) — so this
 * must be called with the RLS-scoped server client (not admin) AFTER the
 * organization already exists and the caller's profile is linked to it.
 * Returns the public URL, or null if no file was provided / upload failed.
 */
export async function uploadOrganizationLogo(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  file: File | null
): Promise<string | null> {
  if (!file || file.size === 0) return null

  if (!ALLOWED_TYPES.has(file.type)) {
    console.warn('[org-logo] rejected unsupported file type', file.type)
    return null
  }
  if (file.size > MAX_LOGO_BYTES) {
    console.warn('[org-logo] rejected file over size limit', file.size)
    return null
  }

  const ext = file.name.split('.').pop() ?? 'png'
  const path = `${organizationId}/logo-${Date.now()}.${ext}`

  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
  if (error) {
    console.error('[org-logo] upload failed', error)
    return null
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

import 'server-only'
import { createAdminClient } from '@/lib/database/supabase/admin'

/**
 * Signed URL helper for private buckets (documents, attachments,
 * meeting-artifacts). Never expose these buckets as public — always go
 * through a short-lived signed URL.
 */
export async function getSignedUrl(bucket: string, path: string, expiresInSeconds = 3600): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, expiresInSeconds)
  if (error || !data) {
    console.error(`[storage] failed to sign URL for ${bucket}/${path}`, error)
    return null
  }
  return data.signedUrl
}

/**
 * Uploads a file enforcing the `${organizationId}/...` path convention the
 * storage RLS policies expect (see supabase/migrations/20260101001100_storage.sql).
 */
export async function uploadFile(
  bucket: string,
  organizationId: string,
  file: File | Blob,
  filename: string
): Promise<{ path: string } | { error: string }> {
  const admin = createAdminClient()
  const path = `${organizationId}/${crypto.randomUUID()}-${filename}`

  const { error } = await admin.storage.from(bucket).upload(path, file)
  if (error) return { error: error.message }
  return { path }
}

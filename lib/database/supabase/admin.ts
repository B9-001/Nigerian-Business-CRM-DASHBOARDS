import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Service-role Supabase client. BYPASSES ROW LEVEL SECURITY.
 *
 * Only use this for:
 *   - background workers (webhook delivery, AI jobs, meeting sync)
 *   - system writes that must cross tenants are impossible here by
 *     construction — every call site MUST pass/filter organization_id itself
 *   - reading tables with no client policies (integration_credentials,
 *     platform_admins, audit_logs inserts)
 *
 * NEVER import this into a Client Component or anything that ships to the
 * browser — `server-only` will fail the build if that happens.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase service role configuration (SUPABASE_SERVICE_ROLE_KEY).')
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

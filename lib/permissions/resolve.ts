import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { PermissionKey } from './catalog'

/**
 * Resolves the full set of permission keys granted to a user: role defaults
 * plus per-user overrides. Two lightweight queries, safe to call once per
 * request layout render. The database RPC `has_permission` remains the
 * authoritative check for any individual write — this is for UI rendering.
 */
export async function resolveAllowedPermissions(
  supabase: SupabaseClient<Database>,
  role: string,
  userId: string
): Promise<Set<PermissionKey>> {
  const [{ data: rolePerms }, { data: overrides }] = await Promise.all([
    supabase.from('role_permissions').select('permission_key').eq('role', role),
    supabase.from('user_permission_overrides').select('permission_key, granted').eq('user_id', userId),
  ])

  const allowed = new Set<PermissionKey>((rolePerms ?? []).map((r) => r.permission_key as PermissionKey))

  for (const override of overrides ?? []) {
    if (override.granted) {
      allowed.add(override.permission_key as PermissionKey)
    } else {
      allowed.delete(override.permission_key as PermissionKey)
    }
  }

  return allowed
}

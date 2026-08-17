import { redirect } from 'next/navigation'
import { createClient } from '@/lib/database/supabase/server'
import type { Database } from '@/types/database'
import type { PermissionKey } from '@/lib/permissions/catalog'

export type Profile = Database['public']['Tables']['profiles']['Row']

export class ForbiddenError extends Error {
  constructor(permission: string) {
    super(`Missing permission: ${permission}`)
    this.name = 'ForbiddenError'
  }
}

/** Current authenticated user + profile, or null. No redirect. */
export async function getSession() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  return { user, profile: profile as Profile | null }
}

/** Require an authenticated user. Redirects to /login otherwise. */
export async function requireUser() {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

/** Require an authenticated user who belongs to an organization. */
export async function requireOrg() {
  const session = await requireUser()
  if (!session.profile?.organization_id) redirect('/onboarding')
  return session as { user: typeof session.user; profile: Profile & { organization_id: string } }
}

/**
 * Server-side permission check. Delegates to the same public.has_permission()
 * SQL function RLS policies use, so app-layer and database-layer authorization
 * can never drift apart. Throws ForbiddenError if the check fails.
 */
export async function requirePermission(permission: PermissionKey) {
  const session = await requireOrg()
  const supabase = await createClient()

  const { data: allowed, error } = await supabase.rpc('has_permission', { perm: permission })

  if (error || !allowed) {
    throw new ForbiddenError(permission)
  }

  return session
}

/** Non-throwing variant for conditional UI rendering. */
export async function can(permission: PermissionKey): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('has_permission', { perm: permission })
  return Boolean(data)
}

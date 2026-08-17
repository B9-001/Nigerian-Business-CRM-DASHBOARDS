import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/database/supabase/server'
import { resolveAllowedPermissions } from '@/lib/permissions/resolve'
import type { Database } from '@/types/database'
import type { PermissionKey } from '@/lib/permissions/catalog'

export type Profile = Database['public']['Tables']['profiles']['Row']

export class ForbiddenError extends Error {
  constructor(permission: string) {
    super(`Missing permission: ${permission}`)
    this.name = 'ForbiddenError'
  }
}

/**
 * Current authenticated user + profile, or null. No redirect.
 *
 * Wrapped in React's `cache()` so it only hits Supabase ONCE per request no
 * matter how many times it's called — the dashboard layout, a page, and any
 * nested Server Component can all call this (directly or via requireOrg/
 * requirePermission/can) and share a single getUser() + profiles round trip
 * instead of each paying for their own. This was previously the single
 * biggest source of perceived slowness (every page was making its own
 * redundant auth calls on top of the layout's).
 */
export const getSession = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  return { user, profile: profile as Profile | null }
})

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
 * Full set of permission keys granted to the current user (role defaults +
 * per-user overrides), computed once per request via resolveAllowedPermissions
 * and cached the same way getSession() is. requirePermission()/can() read
 * from this instead of each issuing their own has_permission() RPC call —
 * so checking 5 permissions across a page now costs the same 2 queries as
 * checking 1, instead of 5 separate round trips.
 */
export const getAllowedPermissions = cache(async (): Promise<Set<PermissionKey>> => {
  const { user, profile } = await requireOrg()
  const supabase = await createClient()
  return resolveAllowedPermissions(supabase, profile.role, user.id)
})

/**
 * Server-side permission check. Backed by the same role_permissions /
 * user_permission_overrides tables the database's public.has_permission()
 * RLS function reads, so app-layer and database-layer authorization can
 * never drift apart — RLS remains the non-bypassable enforcement layer
 * regardless of what this check decides. Throws ForbiddenError if denied.
 */
export async function requirePermission(permission: PermissionKey) {
  const session = await requireOrg()
  const allowed = await getAllowedPermissions()

  if (!allowed.has(permission)) {
    throw new ForbiddenError(permission)
  }

  return session
}

/** Non-throwing variant for conditional UI rendering. */
export async function can(permission: PermissionKey): Promise<boolean> {
  const allowed = await getAllowedPermissions()
  return allowed.has(permission)
}

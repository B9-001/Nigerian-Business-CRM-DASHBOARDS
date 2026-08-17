import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { requireUser } from './session'
import { createAdminClient } from '@/lib/database/supabase/admin'

/**
 * Platform-admin gate for the SaaS owner's cross-tenant admin area
 * (app/(dashboard)/admin/**). This is intentionally NOT the same thing as
 * an organization's OWNER role — platform_admins is a separate, global
 * table with zero client-facing RLS policies (see
 * 20260101001000_dashboard_search_platform_admin.sql), so only the
 * service-role client can check membership. Every page that calls this
 * must also audit-log any tenant data it reads (CLAUDE.md #63).
 *
 * Cached per-request (React cache()) the same way lib/auth/session.ts
 * caches getSession() — the admin layout and every nested admin page can
 * call this without each paying for its own round trip.
 */
export const requirePlatformAdmin = cache(async () => {
  const session = await requireUser()
  const admin = createAdminClient()

  const { data } = await admin
    .from('platform_admins')
    .select('user_id, admin_role')
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (!data) {
    redirect('/dashboard')
  }

  return { ...session, adminRole: data.admin_role as 'SUPER_ADMIN' | 'BILLING_ADMIN' | 'SUPPORT_ADMIN' }
})

/** Only super admins may manage other platform admins / critical platform config (#33). */
export async function requireSuperAdmin() {
  const session = await requirePlatformAdmin()
  if (session.adminRole !== 'SUPER_ADMIN') {
    redirect('/admin')
  }
  return session
}

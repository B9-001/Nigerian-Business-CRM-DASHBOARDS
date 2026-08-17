import 'server-only'
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
 */
export async function requirePlatformAdmin() {
  const session = await requireUser()
  const admin = createAdminClient()

  const { data } = await admin.from('platform_admins').select('user_id').eq('user_id', session.user.id).maybeSingle()

  if (!data) {
    redirect('/dashboard')
  }

  return session
}

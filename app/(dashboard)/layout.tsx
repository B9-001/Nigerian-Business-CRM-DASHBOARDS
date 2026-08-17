import { requireOrg } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { resolveAllowedPermissions } from '@/lib/permissions/resolve'
import { AppShell } from '@/components/layout/app-shell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireOrg()
  const supabase = await createClient()

  const [{ data: organization }, allowedPermissions, { count: unreadCount }] = await Promise.all([
    supabase.from('organizations').select('name').eq('id', profile.organization_id).single(),
    resolveAllowedPermissions(supabase, profile.role, user.id),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false),
  ])

  return (
    <AppShell
      organizationName={organization?.name ?? 'Your Organization'}
      userName={profile.full_name ?? profile.email}
      userEmail={profile.email}
      avatarUrl={profile.avatar_url}
      allowedPermissions={[...allowedPermissions]}
      unreadNotifications={unreadCount ?? 0}
    >
      {children}
    </AppShell>
  )
}

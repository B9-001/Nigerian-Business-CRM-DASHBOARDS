import { requireOrg, getAllowedPermissions } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { AppShell } from '@/components/layout/app-shell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireOrg()
  const supabase = await createClient()

  // getAllowedPermissions() is request-cached (React cache()) — any page
  // rendered inside this layout that also calls can()/requirePermission()
  // reuses this exact computation instead of re-querying.
  const [{ data: organization }, allowedPermissions, { count: unreadCount }] = await Promise.all([
    supabase.from('organizations').select('name, logo_url').eq('id', profile.organization_id).single(),
    getAllowedPermissions(),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false),
  ])

  return (
    <AppShell
      organizationName={organization?.name ?? 'Your Organization'}
      organizationLogoUrl={organization?.logo_url}
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

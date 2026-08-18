'use client'

import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import type { PermissionKey } from '@/lib/permissions/catalog'

interface AppShellProps {
  organizationName: string
  organizationLogoUrl?: string | null
  currentPlanId?: string | null
  userName: string
  userEmail: string
  avatarUrl?: string | null
  allowedPermissions: PermissionKey[]
  unreadNotifications: number
  children: React.ReactNode
}

export function AppShell({
  organizationName,
  organizationLogoUrl,
  currentPlanId,
  userName,
  userEmail,
  avatarUrl,
  allowedPermissions,
  unreadNotifications,
  children,
}: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const permissionSet = new Set(allowedPermissions)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        organizationName={organizationName}
        organizationLogoUrl={organizationLogoUrl}
        currentPlanId={currentPlanId}
        allowedPermissions={permissionSet}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      <div className="flex min-h-screen flex-1 flex-col overflow-x-hidden">
        <Topbar
          userName={userName}
          userEmail={userEmail}
          avatarUrl={avatarUrl}
          unreadNotifications={unreadNotifications}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  )
}

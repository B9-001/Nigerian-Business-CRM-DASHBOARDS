'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Menu, MessageSquare, Search } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { createClient } from '@/lib/database/supabase/client'

interface TopbarProps {
  userName: string
  userEmail: string
  avatarUrl?: string | null
  unreadNotifications?: number
  onOpenMobileNav?: () => void
}

export function Topbar({ userName, userEmail, avatarUrl, unreadNotifications = 0, onOpenMobileNav }: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface px-4 md:px-6">
      <button className="text-subtle md:hidden" onClick={onOpenMobileNav} aria-label="Open menu">
        <Menu size={20} />
      </button>

      <div className="hidden max-w-md flex-1 items-center gap-2 rounded-control border border-border bg-surface-muted px-3.5 py-2 md:flex">
        <Search size={16} className="text-subtle" />
        <input
          type="search"
          placeholder="Search employees, tasks, projects, customers…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-subtle"
          aria-label="Global search"
        />
        <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-subtle">⌘K</kbd>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          className="relative flex h-10 w-10 items-center justify-center rounded-control text-text-secondary hover:bg-surface-muted"
          aria-label="Messages"
        >
          <MessageSquare size={18} />
        </button>
        <button
          className="relative flex h-10 w-10 items-center justify-center rounded-control text-text-secondary hover:bg-surface-muted"
          aria-label="Notifications"
        >
          <Bell size={18} />
          {unreadNotifications > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          )}
        </button>

        <div className="relative ml-1">
          <button
            className="flex items-center gap-2 rounded-control p-1 pr-2 hover:bg-surface-muted"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Avatar name={userName} src={avatarUrl} size={32} />
            <span className="hidden text-sm font-medium text-foreground md:block">{userName}</span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-12 w-56 rounded-card border border-border bg-surface p-2 shadow-soft">
              <div className="border-b border-border px-2 pb-2">
                <p className="truncate text-sm font-medium text-foreground">{userName}</p>
                <p className="truncate text-xs text-subtle">{userEmail}</p>
              </div>
              <button
                className="mt-2 w-full rounded-control px-2 py-1.5 text-left text-sm text-danger hover:bg-danger/10"
                onClick={handleSignOut}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

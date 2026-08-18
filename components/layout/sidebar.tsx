'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, Sparkles, X } from 'lucide-react'
import { NAV_SECTIONS } from './nav-config'
import { cn } from '@/lib/utils'
import type { PermissionKey } from '@/lib/permissions/catalog'

interface SidebarProps {
  organizationName: string
  organizationLogoUrl?: string | null
  allowedPermissions: Set<PermissionKey>
  mobileOpen?: boolean
  onCloseMobile?: () => void
  /** Shown as the sidebar upgrade CTA target; omit or pass 'ENTERPRISE' to hide it. */
  currentPlanId?: string | null
}

export function Sidebar({
  organizationName,
  organizationLogoUrl,
  allowedPermissions,
  mobileOpen,
  onCloseMobile,
  currentPlanId,
}: SidebarProps) {
  const pathname = usePathname()

  const content = (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        {organizationLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={organizationLogoUrl} alt={organizationName} className="h-8 w-8 rounded-lg object-cover" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
            <Building2 size={16} />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{organizationName}</p>
          <p className="text-[11px] text-subtle">Business OS</p>
        </div>
        <button className="ml-auto text-subtle md:hidden" onClick={onCloseMobile} aria-label="Close menu">
          <X size={18} />
        </button>
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter((item) => !item.permission || allowedPermissions.has(item.permission))
          if (items.length === 0) return null

          return (
            <div key={section.title} className="mb-5">
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  const Icon = item.icon
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2.5 rounded-control px-3 py-2 text-sm font-medium transition-colors duration-200',
                          active
                            ? 'bg-primary-soft text-primary-dark'
                            : 'text-text-secondary hover:bg-surface-muted hover:text-foreground'
                        )}
                      >
                        <Icon size={17} className={active ? 'text-primary' : 'text-subtle'} />
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      {allowedPermissions.has('billing.manage') && currentPlanId && currentPlanId !== 'ENTERPRISE' && (
        <div className="p-3">
          <Link
            href="/settings/billing"
            className="block rounded-card bg-primary-dark p-4 text-white transition-colors hover:bg-primary"
          >
            <Sparkles size={18} className="text-white/80" />
            <p className="mt-2 text-sm font-semibold">Upgrade your plan</p>
            <p className="mt-0.5 text-xs text-white/70">Unlock more AI usage, team seats, and advanced features.</p>
            <span className="mt-3 inline-block rounded-control bg-white px-3 py-1.5 text-xs font-semibold text-primary-dark">
              View plans
            </span>
          </Link>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-border md:block">{content}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-[var(--overlay)]" onClick={onCloseMobile} />
          <aside className="absolute inset-y-0 left-0 w-72 shadow-lg">{content}</aside>
        </div>
      )}
    </>
  )
}

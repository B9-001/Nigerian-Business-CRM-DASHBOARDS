import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { requirePlatformAdmin } from '@/lib/auth/platform-admin'

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/organizations', label: 'Organizations' },
  { href: '/admin/subscriptions', label: 'Subscriptions' },
  { href: '/admin/plans', label: 'Plans' },
  { href: '/admin/transactions', label: 'Transactions' },
  { href: '/admin/refunds', label: 'Refunds' },
  { href: '/admin/webhooks', label: 'Webhook Events' },
  { href: '/admin/ai-usage', label: 'AI Usage' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin()

  return (
    <div>
      <div className="mb-5 flex items-center gap-2 rounded-control border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
        <ShieldAlert size={14} />
        Platform Admin — you are viewing cross-tenant data. Every view here is audit-logged.
      </div>

      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  )
}

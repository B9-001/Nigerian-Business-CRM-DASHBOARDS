import Link from 'next/link'
import { Building2, ShieldCheck, CreditCard, Plug, FileClock } from 'lucide-react'
import { requireOrg } from '@/lib/auth/session'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card } from '@/components/ui/card'

const LINKS = [
  { href: '/settings/organization', icon: Building2, title: 'Organization', description: 'Name, currency, timezone.' },
  { href: '/settings/roles', icon: ShieldCheck, title: 'Roles & Permissions', description: 'Role defaults and per-user overrides.' },
  { href: '/settings/integrations', icon: Plug, title: 'Integrations', description: 'Google Meet, Zoom, and more.' },
  { href: '/settings/billing', icon: CreditCard, title: 'Billing', description: 'Plan and usage limits.' },
  { href: '/settings/audit-logs', icon: FileClock, title: 'Audit Logs', description: 'Every sensitive action, tracked.' },
]

export default async function SettingsPage() {
  await requireOrg()

  return (
    <div>
      <PageHeader title="Settings" description="Configure your organization." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <link.icon size={20} className="text-primary" />
              <p className="mt-2 text-sm font-semibold text-foreground">{link.title}</p>
              <p className="text-xs text-muted-foreground">{link.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

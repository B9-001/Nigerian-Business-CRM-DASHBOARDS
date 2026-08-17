import Link from 'next/link'
import { Plus, Contact } from 'lucide-react'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { CustomerForm } from './customer-form'

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view = 'table' } = await searchParams
  const { profile } = await requirePermission(PERMISSIONS.CUSTOMERS_VIEW)
  const supabase = await createClient()

  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, email, phone, company, status, owner:profiles!owner_id(full_name, email)')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Every account your organization works with."
        actions={
          <div className="flex gap-2">
            <Link href="/crm/customers?view=table" className={navClass(view === 'table')}>
              Table
            </Link>
            <Link href="/crm/customers?view=cards" className={navClass(view === 'cards')}>
              Cards
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!customers || customers.length === 0 ? (
            <EmptyState icon={Contact} title="No customers yet" description="Add your first customer to start tracking relationships." />
          ) : view === 'cards' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {customers.map((c) => (
                <Link key={c.id} href={`/crm/customers/${c.id}`}>
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <p className="text-sm font-semibold text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.company ?? '—'}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <StatusBadge status={c.status} />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-card border border-border bg-surface">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-surface-muted text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Company</th>
                    <th className="px-4 py-3 font-medium">Owner</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {customers.map((c) => {
                    const owner = c.owner as unknown as { full_name: string | null; email: string } | null
                    return (
                      <tr key={c.id} className="hover:bg-surface-muted/60">
                        <td className="px-4 py-3">
                          <Link href={`/crm/customers/${c.id}`} className="font-medium text-foreground hover:text-primary">
                            {c.name}
                          </Link>
                          <p className="text-xs text-subtle">{c.email}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{c.company ?? '—'}</td>
                        <td className="px-4 py-3">
                          {owner && (
                            <div className="flex items-center gap-2">
                              <Avatar name={owner.full_name ?? owner.email} size={22} />
                              <span className="text-muted-foreground">{owner.full_name ?? owner.email}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={c.status} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <CustomerForm />
      </div>
    </div>
  )
}

function navClass(active: boolean) {
  return active
    ? 'rounded-control bg-primary-soft px-3 py-2 text-xs font-semibold text-primary-dark'
    : 'rounded-control border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-surface-muted'
}

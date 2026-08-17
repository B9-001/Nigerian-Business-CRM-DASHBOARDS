import Link from 'next/link'
import { LifeBuoy } from 'lucide-react'
import { requirePermission, can } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDateTime } from '@/lib/utils'
import { TicketForm } from './ticket-form'

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams
  const { profile } = await requirePermission(PERMISSIONS.SUPPORT_VIEW)
  const supabase = await createClient()
  const canManage = await can(PERMISSIONS.SUPPORT_MANAGE)

  let query = supabase
    .from('tickets')
    .select('id, subject, priority, status, updated_at, assignee:profiles!assigned_to(full_name, email), customer:customers(name)')
    .eq('organization_id', profile.organization_id)
    .order('updated_at', { ascending: false })

  if (status) query = query.eq('status', status)
  const { data: tickets } = await query

  const [{ data: customers }] = canManage
    ? await Promise.all([supabase.from('customers').select('id, name').eq('organization_id', profile.organization_id).order('name')])
    : [{ data: [] }]

  return (
    <div>
      <PageHeader title="Support" description="Customer support tickets and requests." />

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterLink label="All" href="/support" active={!status} />
        {['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'].map((s) => (
          <FilterLink key={s} label={s.replace('_', ' ')} href={`/support?status=${s}`} active={status === s} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!tickets || tickets.length === 0 ? (
            <EmptyState icon={LifeBuoy} title="No tickets" />
          ) : (
            <div className="overflow-hidden rounded-card border border-border bg-surface">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-surface-muted text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Subject</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Priority</th>
                    <th className="px-4 py-3 font-medium">Assignee</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tickets.map((t) => {
                    const assignee = t.assignee as unknown as { full_name: string | null; email: string } | null
                    const customer = t.customer as unknown as { name: string } | null
                    return (
                      <tr key={t.id} className="hover:bg-surface-muted/60">
                        <td className="px-4 py-3">
                          <Link href={`/support/${t.id}`} className="font-medium text-foreground hover:text-primary">
                            {t.subject}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{customer?.name ?? '—'}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={t.priority} />
                        </td>
                        <td className="px-4 py-3">
                          {assignee ? (
                            <div className="flex items-center gap-2">
                              <Avatar name={assignee.full_name ?? assignee.email} size={20} />
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={t.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-subtle">{formatDateTime(t.updated_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>New Ticket</CardTitle>
            </CardHeader>
            <CardContent>
              <TicketForm customers={customers ?? []} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'rounded-full bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary-dark'
          : 'rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-surface-muted'
      }
    >
      {label}
    </Link>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDateTime, formatNaira } from '@/lib/utils'
import { NoteForm } from './note-form'

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { profile } = await requirePermission(PERMISSIONS.CUSTOMERS_VIEW)
  const supabase = await createClient()

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, email, phone, company, source, status')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!customer) notFound()

  const [{ data: activities }, { data: deals }, { data: tickets }] = await Promise.all([
    supabase
      .from('crm_activities')
      .select('id, type, body, created_at')
      .eq('customer_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('deals').select('id, title, value_ngn, stage').eq('customer_id', id),
    supabase.from('tickets').select('id, subject, status').eq('customer_id', id),
  ])

  return (
    <div>
      <PageHeader title={customer.name} description={customer.company ?? undefined} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Email:</span> {customer.email ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Phone:</span> {customer.phone ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Source:</span> {customer.source ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Status:</span> <StatusBadge status={customer.status} />
            </p>
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Deals</h3>
            {deals && deals.length > 0 ? (
              <ul className="space-y-1.5 text-sm">
                {deals.map((d) => (
                  <li key={d.id} className="flex items-center justify-between">
                    <Link href="/crm/deals" className="text-foreground hover:text-primary">
                      {d.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">{formatNaira(d.value_ngn)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-subtle">No deals yet</p>
            )}
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Support Tickets</h3>
            {tickets && tickets.length > 0 ? (
              <ul className="space-y-1.5 text-sm">
                {tickets.map((t) => (
                  <li key={t.id} className="flex items-center justify-between">
                    <Link href={`/support/${t.id}`} className="text-foreground hover:text-primary">
                      {t.subject}
                    </Link>
                    <StatusBadge status={t.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-subtle">No tickets yet</p>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <NoteForm customerId={customer.id} />
            {activities && activities.length > 0 ? (
              <ul className="mt-4 space-y-3 border-t border-border pt-4">
                {activities.map((a) => (
                  <li key={a.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={a.type} />
                      <span className="text-xs text-subtle">{formatDateTime(a.created_at)}</span>
                    </div>
                    {a.body && <p className="mt-1 text-foreground">{a.body}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 border-t border-border pt-4">
                <EmptyState title="No activity yet" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

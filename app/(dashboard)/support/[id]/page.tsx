import { notFound } from 'next/navigation'
import { requirePermission, can } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDateTime } from '@/lib/utils'
import { TicketControls } from './ticket-controls'
import { ReplyForm } from './reply-form'
import { cn } from '@/lib/utils'

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { profile } = await requirePermission(PERMISSIONS.SUPPORT_VIEW)
  const supabase = await createClient()
  const canManage = await can(PERMISSIONS.SUPPORT_MANAGE)

  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, subject, description, status, priority, customer:customers(name)')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!ticket) notFound()

  const { data: messages } = await supabase
    .from('ticket_messages')
    .select('id, body, is_internal_note, created_at, author:profiles!author_id(full_name, email)')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true })

  const customer = ticket.customer as unknown as { name: string } | null

  return (
    <div>
      <PageHeader title={ticket.subject} description={customer ? `Customer: ${customer.name}` : undefined} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="whitespace-pre-wrap text-sm text-foreground">{ticket.description || 'No description.'}</p>
            {canManage ? (
              <TicketControls ticketId={ticket.id} status={ticket.status} priority={ticket.priority} />
            ) : (
              <p className="text-xs text-muted-foreground">Status: {ticket.status} · Priority: {ticket.priority}</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Conversation</CardTitle>
          </CardHeader>
          <CardContent>
            {messages && messages.length > 0 ? (
              <ul className="space-y-4">
                {messages.map((m) => {
                  const author = m.author as unknown as { full_name: string | null; email: string } | null
                  return (
                    <li key={m.id} className={cn('flex gap-3 rounded-control p-2.5', m.is_internal_note && 'bg-warning/10')}>
                      <Avatar name={author?.full_name ?? author?.email ?? '?'} size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-foreground">{author?.full_name ?? author?.email}</span>
                          {m.is_internal_note && <span className="text-[10px] font-semibold uppercase text-warning">Internal</span>}
                          <span className="text-xs text-subtle">{formatDateTime(m.created_at)}</span>
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{m.body}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <EmptyState title="No messages yet" />
            )}
            <ReplyForm ticketId={ticket.id} canManage={canManage} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

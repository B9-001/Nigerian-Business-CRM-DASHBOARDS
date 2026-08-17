import { Bell } from 'lucide-react'
import { requireUser } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDateTime, cn } from '@/lib/utils'
import { markNotificationReadAction, markAllNotificationsReadAction } from './actions'

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = 'all' } = await searchParams
  const { user } = await requireUser()
  const supabase = await createClient()

  let query = supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
  if (tab === 'unread') query = query.eq('is_read', false)

  const { data: notifications } = await query.limit(50)

  return (
    <div>
      <PageHeader
        title="Notifications"
        actions={
          <form action={markAllNotificationsReadAction}>
            <Button type="submit" variant="secondary" size="sm">
              Mark all as read
            </Button>
          </form>
        }
      />

      {!notifications || notifications.length === 0 ? (
        <EmptyState icon={Bell} title="You're all caught up" />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id} className={cn('flex items-start justify-between gap-3', !n.is_read && 'border-primary/40 bg-primary-soft/30')}>
              <div>
                <p className="text-sm font-medium text-foreground">{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-xs text-subtle">{formatDateTime(n.created_at)}</p>
              </div>
              {!n.is_read && (
                <form action={markNotificationReadAction.bind(null, n.id)}>
                  <button className="text-xs font-medium text-primary hover:text-primary-hover">Mark read</button>
                </form>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

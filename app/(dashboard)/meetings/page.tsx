import Link from 'next/link'
import { Video } from 'lucide-react'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDateTime } from '@/lib/utils'
import { MeetingForm } from './meeting-form'

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = 'upcoming' } = await searchParams
  const { profile } = await requirePermission(PERMISSIONS.MEETINGS_VIEW)
  const supabase = await createClient()

  const now = new Date().toISOString()
  let query = supabase
    .from('meetings')
    .select('id, title, provider, start_time, status, join_url')
    .eq('organization_id', profile.organization_id)

  query = tab === 'past' ? query.lt('start_time', now).order('start_time', { ascending: false }) : query.gte('start_time', now).order('start_time', { ascending: true })

  const [{ data: meetings }, { data: employees }, { data: projects }, { data: customers }] = await Promise.all([
    query,
    supabase.from('employees').select('id, first_name, last_name').eq('organization_id', profile.organization_id).order('first_name'),
    supabase.from('projects').select('id, name').eq('organization_id', profile.organization_id).order('name'),
    supabase.from('customers').select('id, name').eq('organization_id', profile.organization_id).order('name'),
  ])

  return (
    <div>
      <PageHeader title="Meetings" description="Schedule and join meetings without leaving the platform." />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 flex gap-2">
            <TabLink label="Upcoming" href="/meetings?tab=upcoming" active={tab !== 'past'} />
            <TabLink label="Past" href="/meetings?tab=past" active={tab === 'past'} />
          </div>

          {!meetings || meetings.length === 0 ? (
            <EmptyState icon={Video} title="No meetings" />
          ) : (
            <div className="space-y-3">
              {meetings.map((m) => (
                <Link key={m.id} href={`/meetings/${m.id}`}>
                  <Card className="transition-shadow hover:shadow-md">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{m.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(m.start_time)} · {m.provider.replace('_', ' ')}
                        </p>
                      </div>
                      <StatusBadge status={m.status} />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Schedule Meeting</CardTitle>
          </CardHeader>
          <CardContent>
            <MeetingForm employees={employees ?? []} projects={projects ?? []} customers={customers ?? []} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function TabLink({ label, href, active }: { label: string; href: string; active: boolean }) {
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

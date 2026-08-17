import { notFound } from 'next/navigation'
import { requirePermission, can } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDateTime } from '@/lib/utils'
import { CancelMeetingButton } from './cancel-button'

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { profile } = await requirePermission(PERMISSIONS.MEETINGS_VIEW)
  const supabase = await createClient()

  const { data: meeting } = await supabase
    .from('meetings')
    .select('id, title, description, agenda, provider, start_time, end_time, status, join_url, host_url')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!meeting) notFound()

  const [{ data: attendees }, { data: artifacts }, { data: actionItems }, canManage] = await Promise.all([
    supabase
      .from('meeting_attendees')
      .select('id, response_status, employee:employees(first_name, last_name)')
      .eq('meeting_id', id),
    supabase.from('meeting_artifacts').select('id, type, content, created_at').eq('meeting_id', id),
    supabase.from('meeting_action_items').select('id, description, due_date, task_id').eq('meeting_id', id),
    can(PERMISSIONS.MEETINGS_UPDATE),
  ])

  return (
    <div>
      <PageHeader
        title={meeting.title}
        description={`${formatDateTime(meeting.start_time)} · ${meeting.provider.replace('_', ' ')}`}
        actions={canManage && meeting.status === 'SCHEDULED' ? <CancelMeetingButton meetingId={meeting.id} /> : undefined}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <StatusBadge status={meeting.status} />
              {meeting.join_url ? (
                <a href={meeting.join_url} target="_blank" rel="noreferrer">
                  <Button size="sm">Join Meeting</Button>
                </a>
              ) : (
                meeting.provider !== 'OTHER' && (
                  <p className="text-xs text-warning">
                    No join link yet — connect {meeting.provider === 'GOOGLE_MEET' ? 'Google Meet' : 'Zoom'} in Settings → Integrations.
                  </p>
                )
              )}
            </div>

            {meeting.agenda && (
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Agenda</h3>
                <p className="whitespace-pre-wrap text-sm text-foreground">{meeting.agenda}</p>
              </div>
            )}
            {meeting.description && (
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Description</h3>
                <p className="whitespace-pre-wrap text-sm text-foreground">{meeting.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendees</CardTitle>
          </CardHeader>
          <CardContent>
            {attendees && attendees.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {attendees.map((a) => {
                  const employee = a.employee as unknown as { first_name: string; last_name: string } | null
                  return (
                    <li key={a.id} className="flex items-center justify-between">
                      <span className="text-foreground">{employee ? `${employee.first_name} ${employee.last_name}` : 'Unknown'}</span>
                      <StatusBadge status={a.response_status} />
                    </li>
                  )
                })}
              </ul>
            ) : (
              <EmptyState title="No attendees added" />
            )}
          </CardContent>
        </Card>
      </div>

      {(artifacts && artifacts.length > 0) || (actionItems && actionItems.length > 0) ? (
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {artifacts && artifacts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Transcript & AI Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {artifacts.map((a) => (
                  <div key={a.id}>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">{a.type.replace('_', ' ')}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{a.content}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {actionItems && actionItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Action Items</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {actionItems.map((item) => (
                    <li key={item.id} className="flex items-center justify-between">
                      <span className="text-foreground">{item.description}</span>
                      <StatusBadge status={item.task_id ? 'TASK CREATED' : 'PENDING'} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  )
}

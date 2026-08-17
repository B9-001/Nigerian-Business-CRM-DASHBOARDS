/**
 * Notifications worker — scans for meetings starting soon and sends
 * reminders (deduped by checking for an existing notification first). Run
 * as a standalone process: `npm run worker:notifications`.
 */
import { createAdminClient } from '@/lib/database/supabase/admin'
import { notifyMeetingReminder } from '@/lib/notifications/events'

const INTERVAL_MS = 5 * 60_000
const REMINDER_WINDOW_MINUTES = 15

async function sendMeetingReminders() {
  const admin = createAdminClient()
  const now = new Date()
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MINUTES * 60_000)

  const { data: meetings } = await admin
    .from('meetings')
    .select('id, organization_id, title, start_time')
    .eq('status', 'SCHEDULED')
    .gte('start_time', now.toISOString())
    .lte('start_time', windowEnd.toISOString())

  for (const meeting of meetings ?? []) {
    const { data: attendees } = await admin
      .from('meeting_attendees')
      .select('employee:employees(user_id)')
      .eq('meeting_id', meeting.id)

    for (const attendee of attendees ?? []) {
      const employee = attendee.employee as unknown as { user_id: string | null } | null
      if (!employee?.user_id) continue

      const { data: existing } = await admin
        .from('notifications')
        .select('id')
        .eq('user_id', employee.user_id)
        .eq('type', 'meeting_reminder')
        .contains('metadata', { meeting_id: meeting.id })
        .maybeSingle()

      if (existing) continue

      await notifyMeetingReminder(meeting.organization_id, employee.user_id, meeting.id, meeting.title, meeting.start_time)
    }
  }
}

function startWorker() {
  console.log('[worker:notifications] started, scanning every', INTERVAL_MS, 'ms')
  sendMeetingReminders()
  setInterval(sendMeetingReminders, INTERVAL_MS)
}

startWorker()

import 'server-only'
import { createNotification } from './create'

/** Called after a task's assigned_to changes to a real user. */
export async function notifyTaskAssigned(organizationId: string, assigneeUserId: string, taskId: string, taskTitle: string): Promise<void> {
  await createNotification({
    organizationId,
    userId: assigneeUserId,
    type: 'task_assigned',
    title: 'New task assigned to you',
    body: taskTitle,
    link: `/tasks/${taskId}`,
    metadata: { taskId },
  })
}

/** Called by workers/notifications for meetings starting soon. */
export async function notifyMeetingReminder(organizationId: string, userId: string, meetingId: string, meetingTitle: string, startTime: string): Promise<void> {
  await createNotification({
    organizationId,
    userId,
    type: 'meeting_reminder',
    title: `Meeting starting soon: ${meetingTitle}`,
    body: `Starts at ${new Date(startTime).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}`,
    link: `/meetings/${meetingId}`,
    metadata: { meeting_id: meetingId },
  })
}

/** Called when a user is @mentioned in a comment/message. */
export async function notifyMentioned(organizationId: string, userId: string, context: { title: string; link: string }): Promise<void> {
  await createNotification({
    organizationId,
    userId,
    type: 'mention',
    title: 'You were mentioned',
    body: context.title,
    link: context.link,
  })
}

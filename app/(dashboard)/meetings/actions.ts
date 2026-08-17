'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { logAuditEvent } from '@/lib/security/audit'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { getMeetingProvider, IntegrationNotConnectedError } from '@/lib/meetings'

export interface MeetingActionState {
  error?: string
  warning?: string
}

function nullableUuid(value?: string | null) {
  return value && value.length > 0 ? value : null
}

const meetingSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().or(z.literal('')),
  agenda: z.string().optional().or(z.literal('')),
  provider: z.enum(['GOOGLE_MEET', 'ZOOM', 'OTHER']),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().optional().or(z.literal('')),
  projectId: z.string().uuid().optional().or(z.literal('')),
  customerId: z.string().uuid().optional().or(z.literal('')),
  attendeeIds: z.array(z.string().uuid()).optional(),
})

export async function createMeetingAction(_prev: MeetingActionState, formData: FormData): Promise<MeetingActionState> {
  const { user, profile } = await requirePermission(PERMISSIONS.MEETINGS_CREATE)

  const parsed = meetingSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    agenda: formData.get('agenda'),
    provider: formData.get('provider') || 'OTHER',
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
    projectId: formData.get('projectId'),
    customerId: formData.get('customerId'),
    attendeeIds: formData.getAll('attendeeIds').map(String),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid meeting details' }
  }

  const supabase = await createClient()
  let joinUrl: string | null = null
  let hostUrl: string | null = null
  let providerMeetingId: string | null = null
  let warning: string | undefined

  if (parsed.data.provider === 'GOOGLE_MEET' || parsed.data.provider === 'ZOOM') {
    try {
      const meetingProvider = getMeetingProvider(parsed.data.provider)
      const created = await meetingProvider.createMeeting({
        organizationId: profile.organization_id,
        title: parsed.data.title,
        description: parsed.data.description || undefined,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime || undefined,
      })
      joinUrl = created.joinUrl
      hostUrl = created.hostUrl ?? null
      providerMeetingId = created.providerMeetingId
    } catch (err) {
      if (err instanceof IntegrationNotConnectedError) {
        warning = `${parsed.data.provider === 'GOOGLE_MEET' ? 'Google Meet' : 'Zoom'} isn't connected yet — the meeting was saved without an auto-generated link. Connect it in Settings → Integrations.`
      } else {
        warning = 'Could not auto-generate a meeting link. The meeting was saved anyway — you can add a link manually.'
        console.error('[meetings] provider createMeeting failed', err)
      }
    }
  }

  const { data: meeting, error } = await supabase
    .from('meetings')
    .insert({
      organization_id: profile.organization_id,
      created_by: user.id,
      provider: parsed.data.provider,
      provider_meeting_id: providerMeetingId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      agenda: parsed.data.agenda || null,
      start_time: new Date(parsed.data.startTime).toISOString(),
      end_time: parsed.data.endTime ? new Date(parsed.data.endTime).toISOString() : null,
      join_url: joinUrl,
      host_url: hostUrl,
      project_id: nullableUuid(parsed.data.projectId),
      customer_id: nullableUuid(parsed.data.customerId),
    })
    .select('id')
    .single()

  if (error || !meeting) {
    return { error: 'Could not create meeting. Please try again.' }
  }

  if (parsed.data.attendeeIds && parsed.data.attendeeIds.length > 0) {
    await supabase.from('meeting_attendees').insert(
      parsed.data.attendeeIds.map((employeeId) => ({
        organization_id: profile.organization_id,
        meeting_id: meeting.id,
        employee_id: employeeId,
      }))
    )
  }

  await logAuditEvent({
    organizationId: profile.organization_id,
    actorId: user.id,
    action: 'meeting.created',
    resourceType: 'meeting',
    resourceId: meeting.id,
  })

  revalidatePath('/meetings')
  redirect(`/meetings/${meeting.id}`)
}

export async function cancelMeetingAction(meetingId: string) {
  const { user, profile } = await requirePermission(PERMISSIONS.MEETINGS_UPDATE)
  const supabase = await createClient()

  const { error } = await supabase.from('meetings').update({ status: 'CANCELLED' }).eq('id', meetingId)
  if (error) return

  await logAuditEvent({
    organizationId: profile.organization_id,
    actorId: user.id,
    action: 'meeting.cancelled',
    resourceType: 'meeting',
    resourceId: meetingId,
  })

  revalidatePath('/meetings')
  revalidatePath(`/meetings/${meetingId}`)
}

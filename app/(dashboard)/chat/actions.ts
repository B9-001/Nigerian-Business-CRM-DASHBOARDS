'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePermission, requireOrg } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'

export interface ChatActionState {
  error?: string
}

const messageSchema = z.object({ channelId: z.string().uuid(), body: z.string().min(1) })

export async function sendMessageAction(formData: FormData) {
  const { user } = await requirePermission(PERMISSIONS.CHAT_USE)
  const parsed = messageSchema.safeParse({ channelId: formData.get('channelId'), body: formData.get('body') })
  if (!parsed.success) return

  const { profile } = await requireOrg()
  const supabase = await createClient()
  await supabase.from('messages').insert({
    organization_id: profile.organization_id,
    channel_id: parsed.data.channelId,
    author_id: user.id,
    body: parsed.data.body,
  })

  revalidatePath('/chat')
}

const channelSchema = z.object({
  name: z.string().min(1, 'Channel name is required'),
  type: z.enum(['GROUP', 'DEPARTMENT', 'PROJECT']),
  departmentId: z.string().uuid().optional().or(z.literal('')),
  projectId: z.string().uuid().optional().or(z.literal('')),
})

export async function createChannelAction(_prev: ChatActionState, formData: FormData): Promise<ChatActionState> {
  const { user, profile } = await requirePermission(PERMISSIONS.CHAT_USE)
  const parsed = channelSchema.safeParse({
    name: formData.get('name'),
    type: formData.get('type') || 'GROUP',
    departmentId: formData.get('departmentId'),
    projectId: formData.get('projectId'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid channel' }

  const supabase = await createClient()
  const { data: channel, error } = await supabase
    .from('channels')
    .insert({
      organization_id: profile.organization_id,
      type: parsed.data.type,
      name: parsed.data.name,
      department_id: parsed.data.departmentId || null,
      project_id: parsed.data.projectId || null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !channel) return { error: 'Could not create channel.' }

  await supabase.from('channel_members').insert({ channel_id: channel.id, organization_id: profile.organization_id, user_id: user.id })

  revalidatePath('/chat')
  return {}
}

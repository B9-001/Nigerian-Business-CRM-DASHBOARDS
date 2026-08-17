'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'

export async function markNotificationReadAction(notificationId: string) {
  const { user } = await requireUser()
  const supabase = await createClient()
  await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId).eq('user_id', user.id)
  revalidatePath('/notifications')
}

export async function markAllNotificationsReadAction() {
  const { user } = await requireUser()
  const supabase = await createClient()
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
  revalidatePath('/notifications')
}

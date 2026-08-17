import 'server-only'
import { createAdminClient } from '@/lib/database/supabase/admin'
import type { Json } from '@/types/database'

export interface CreateNotificationInput {
  organizationId: string
  userId: string
  type: string
  title: string
  body?: string
  link?: string
  metadata?: Record<string, unknown>
}

/**
 * Inserts a notification via the service-role client. RLS on `notifications`
 * only allows a user to SELECT/UPDATE their own rows — inserts always go
 * through the server (server actions, workers), never the browser client.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from('notifications').insert({
    organization_id: input.organizationId,
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
    metadata: (input.metadata ?? {}) as Json,
  })

  if (error) {
    console.error('[notifications] failed to create notification', error, input)
  }
}

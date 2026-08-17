'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { logAuditEvent } from '@/lib/security/audit'
import { PERMISSIONS } from '@/lib/permissions/catalog'

export interface SettingsActionState {
  error?: string
  success?: boolean
}

const orgSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  currency: z.string().min(1),
  timezone: z.string().min(1),
})

export async function updateOrganizationAction(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const { user, profile } = await requirePermission(PERMISSIONS.ORGANIZATION_UPDATE)
  const parsed = orgSchema.safeParse({
    name: formData.get('name'),
    currency: formData.get('currency'),
    timezone: formData.get('timezone'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid organization details' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('organizations')
    .update({ name: parsed.data.name, currency: parsed.data.currency, timezone: parsed.data.timezone })
    .eq('id', profile.organization_id)

  if (error) return { error: 'Could not update organization.' }

  await logAuditEvent({
    organizationId: profile.organization_id,
    actorId: user.id,
    action: 'organization.updated',
    resourceType: 'organization',
    resourceId: profile.organization_id,
  })

  revalidatePath('/settings/organization')
  return { success: true }
}

const overrideSchema = z.object({ userId: z.string().uuid(), permissionKey: z.string().min(1), granted: z.enum(['true', 'false']) })

export async function setPermissionOverrideAction(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const { user, profile } = await requirePermission(PERMISSIONS.SETTINGS_MANAGE)
  const parsed = overrideSchema.safeParse({
    userId: formData.get('userId'),
    permissionKey: formData.get('permissionKey'),
    granted: formData.get('granted'),
  })
  if (!parsed.success) return { error: 'Invalid override' }

  const supabase = await createClient()
  const { error } = await supabase.from('user_permission_overrides').upsert(
    {
      organization_id: profile.organization_id,
      user_id: parsed.data.userId,
      permission_key: parsed.data.permissionKey,
      granted: parsed.data.granted === 'true',
      created_by: user.id,
    },
    { onConflict: 'user_id,permission_key' }
  )

  if (error) return { error: 'Could not save override.' }

  await logAuditEvent({
    organizationId: profile.organization_id,
    actorId: user.id,
    action: 'permission.override_changed',
    resourceType: 'user_permission_override',
    resourceId: parsed.data.userId,
    metadata: { permission: parsed.data.permissionKey, granted: parsed.data.granted },
  })

  revalidatePath('/settings/roles')
  return { success: true }
}

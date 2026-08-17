'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePlatformAdmin } from '@/lib/auth/platform-admin'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { logAuditEvent } from '@/lib/security/audit'

export interface PlanActionState {
  error?: string
}

const schema = z.object({
  planId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().or(z.literal('')),
  priceNgnMonth: z.string().optional().or(z.literal('')),
  annualPriceNgn: z.string().optional().or(z.literal('')),
  maxUsers: z.string().optional().or(z.literal('')),
  maxProjects: z.string().optional().or(z.literal('')),
  maxStorageGb: z.string().optional().or(z.literal('')),
  maxAiRequestsMonth: z.string().optional().or(z.literal('')),
  isActive: z.string().optional(),
  isPublic: z.string().optional(),
})

function toNullableNumber(v?: string) {
  if (!v || v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function updatePlanAction(_prev: PlanActionState, formData: FormData): Promise<PlanActionState> {
  const { user } = await requirePlatformAdmin()

  const parsed = schema.safeParse({
    planId: formData.get('planId'),
    name: formData.get('name'),
    description: formData.get('description'),
    priceNgnMonth: formData.get('priceNgnMonth'),
    annualPriceNgn: formData.get('annualPriceNgn'),
    maxUsers: formData.get('maxUsers'),
    maxProjects: formData.get('maxProjects'),
    maxStorageGb: formData.get('maxStorageGb'),
    maxAiRequestsMonth: formData.get('maxAiRequestsMonth'),
    isActive: formData.get('isActive') ?? undefined,
    isPublic: formData.get('isPublic') ?? undefined,
  })

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid plan details' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('plans')
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      price_ngn_month: toNullableNumber(parsed.data.priceNgnMonth),
      annual_price_ngn: toNullableNumber(parsed.data.annualPriceNgn),
      max_users: toNullableNumber(parsed.data.maxUsers),
      max_projects: toNullableNumber(parsed.data.maxProjects),
      max_storage_gb: toNullableNumber(parsed.data.maxStorageGb),
      max_ai_requests_month: toNullableNumber(parsed.data.maxAiRequestsMonth),
      is_active: parsed.data.isActive === 'on',
      is_public: parsed.data.isPublic === 'on',
    })
    .eq('id', parsed.data.planId)

  if (error) return { error: 'Could not update plan.' }

  await logAuditEvent({
    organizationId: null, // plan changes are platform-level, not org-scoped
    actorId: user.id,
    action: 'platform_admin.plan_updated',
    resourceType: 'plan',
    resourceId: parsed.data.planId,
  })

  revalidatePath('/admin/plans')
  revalidatePath('/settings/billing')
  return {}
}

export async function togglePlanFeatureAction(planId: string, featureKey: string, enabled: boolean) {
  await requirePlatformAdmin()
  const admin = createAdminClient()
  await admin.from('plan_features').upsert({ plan_id: planId, feature_key: featureKey, enabled }, { onConflict: 'plan_id,feature_key' })
  revalidatePath('/admin/plans')
  revalidatePath('/settings/billing')
}

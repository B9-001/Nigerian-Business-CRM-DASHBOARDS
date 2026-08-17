'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { logAuditEvent } from '@/lib/security/audit'

const schema = z.object({
  organizationName: z.string().min(2, 'Organization name is required'),
})

export interface OnboardingState {
  error?: string
}

const DEFAULT_DEPARTMENTS = [
  'Management',
  'Human Resources',
  'Finance',
  'Marketing',
  'Sales',
  'Operations',
  'Customer Service',
  'IT',
]

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') +
    '-' +
    Math.random().toString(36).slice(2, 7)
  )
}

export async function createOrganizationAction(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const { user, profile } = await requireUser()

  if (profile?.organization_id) {
    redirect('/dashboard')
  }

  const parsed = schema.safeParse({ organizationName: formData.get('organizationName') })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid organization name' }
  }

  const supabase = await createClient()

  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .insert({ name: parsed.data.organizationName, slug: slugify(parsed.data.organizationName) })
    .select('id')
    .single()

  if (orgError || !organization) {
    return { error: 'Could not create organization. Please try again.' }
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ organization_id: organization.id, role: 'OWNER' })
    .eq('id', user.id)

  if (profileError) {
    return { error: 'Organization created, but we could not link your account. Contact support.' }
  }

  await supabase.from('departments').insert(
    DEFAULT_DEPARTMENTS.map((name) => ({ organization_id: organization.id, name }))
  )

  await logAuditEvent({
    organizationId: organization.id,
    actorId: user.id,
    action: 'organization.created',
    resourceType: 'organization',
    resourceId: organization.id,
  })

  redirect('/dashboard')
}

'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { logAuditEvent } from '@/lib/security/audit'
import { uploadOrganizationLogo } from '@/lib/storage/org-logo'

const schema = z.object({
  organizationName: z.string().min(2, 'Organization name is required'),
})

export interface OnboardingState {
  error?: string
}

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

  // Organization creation + linking the caller's profile to it + seeding
  // default departments happens atomically in one SECURITY DEFINER RPC
  // (public.create_organization_and_join). Doing this as separate
  // insert/update client calls doesn't work: the RLS SELECT policy on
  // `organizations` requires profile.organization_id to already match,
  // which can't be true until AFTER the profile update — PostgREST reports
  // that chicken-and-egg gap as a generic RLS violation on the insert
  // itself when asked to return the created row.
  const { data: organizationId, error } = await supabase.rpc('create_organization_and_join', {
    org_name: parsed.data.organizationName,
    org_slug: slugify(parsed.data.organizationName),
  })

  if (error || !organizationId) {
    return { error: 'Could not create organization. Please try again.' }
  }

  // Logo upload happens AFTER org creation, not before: the avatars bucket's
  // RLS policy keys off current_org_id(), which only resolves once the RPC
  // above has linked this user's profile to the new organization.
  const logoFile = formData.get('logo')
  if (logoFile instanceof File && logoFile.size > 0) {
    const logoUrl = await uploadOrganizationLogo(supabase, organizationId, logoFile)
    if (logoUrl) {
      await supabase.from('organizations').update({ logo_url: logoUrl }).eq('id', organizationId)
    }
  }

  await logAuditEvent({
    organizationId,
    actorId: user.id,
    action: 'organization.created',
    resourceType: 'organization',
    resourceId: organizationId,
  })

  redirect('/dashboard')
}

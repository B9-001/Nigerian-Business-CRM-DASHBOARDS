'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { logAuditEvent } from '@/lib/security/audit'
import { PERMISSIONS } from '@/lib/permissions/catalog'

export interface ProjectActionState {
  error?: string
}

function nullableUuid(value?: string | null) {
  return value && value.length > 0 ? value : null
}

const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional().or(z.literal('')),
  departmentId: z.string().uuid().optional().or(z.literal('')),
  startDate: z.string().optional().or(z.literal('')),
  deadline: z.string().optional().or(z.literal('')),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
})

export async function createProjectAction(_prev: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  const { user, profile } = await requirePermission(PERMISSIONS.PROJECTS_CREATE)

  const parsed = projectSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    departmentId: formData.get('departmentId'),
    startDate: formData.get('startDate'),
    deadline: formData.get('deadline'),
    priority: formData.get('priority') || 'MEDIUM',
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid project details' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .insert({
      organization_id: profile.organization_id,
      created_by: user.id,
      owner_id: user.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      department_id: nullableUuid(parsed.data.departmentId),
      start_date: parsed.data.startDate || null,
      deadline: parsed.data.deadline || null,
      priority: parsed.data.priority,
    })
    .select('id')
    .single()

  if (error || !data) return { error: 'Could not create project.' }

  await supabase.from('project_members').insert({ project_id: data.id, organization_id: profile.organization_id, user_id: user.id, role: 'OWNER' })

  await logAuditEvent({
    organizationId: profile.organization_id,
    actorId: user.id,
    action: 'project.created',
    resourceType: 'project',
    resourceId: data.id,
  })

  revalidatePath('/projects')
  redirect(`/projects/${data.id}`)
}

export async function updateProjectStatusAction(projectId: string, status: string) {
  const { user, profile } = await requirePermission(PERMISSIONS.PROJECTS_UPDATE)
  const supabase = await createClient()
  const { error } = await supabase.from('projects').update({ status }).eq('id', projectId)
  if (error) return

  await logAuditEvent({
    organizationId: profile.organization_id,
    actorId: user.id,
    action: 'project.status_changed',
    resourceType: 'project',
    resourceId: projectId,
    metadata: { status },
  })

  revalidatePath('/projects')
  revalidatePath(`/projects/${projectId}`)
}

export async function updateProjectProgressAction(projectId: string, progress: number) {
  const { profile } = await requirePermission(PERMISSIONS.PROJECTS_UPDATE)
  const supabase = await createClient()
  await supabase.from('projects').update({ progress }).eq('id', projectId).eq('organization_id', profile.organization_id)
  revalidatePath(`/projects/${projectId}`)
}

const memberSchema = z.object({ projectId: z.string().uuid(), userId: z.string().uuid() })

export async function addProjectMemberAction(_prev: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  const { profile } = await requirePermission(PERMISSIONS.PROJECTS_UPDATE)
  const parsed = memberSchema.safeParse({ projectId: formData.get('projectId'), userId: formData.get('userId') })
  if (!parsed.success) return { error: 'Select a team member' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('project_members')
    .insert({ project_id: parsed.data.projectId, organization_id: profile.organization_id, user_id: parsed.data.userId })

  if (error) return { error: 'Could not add member (already added?).' }

  revalidatePath(`/projects/${parsed.data.projectId}`)
  return {}
}

export async function removeProjectMemberAction(projectId: string, userId: string) {
  const { profile } = await requirePermission(PERMISSIONS.PROJECTS_UPDATE)
  const supabase = await createClient()
  await supabase.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId).eq('organization_id', profile.organization_id)
  revalidatePath(`/projects/${projectId}`)
}

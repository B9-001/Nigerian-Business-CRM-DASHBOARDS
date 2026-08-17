'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requirePermission, requireOrg } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { logAuditEvent } from '@/lib/security/audit'
import { PERMISSIONS } from '@/lib/permissions/catalog'

export interface TaskActionState {
  error?: string
}

function nullableUuid(value?: string | null) {
  return value && value.length > 0 ? value : null
}

const taskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().or(z.literal('')),
  projectId: z.string().uuid().optional().or(z.literal('')),
  departmentId: z.string().uuid().optional().or(z.literal('')),
  assignedTo: z.string().uuid().optional().or(z.literal('')),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  dueDate: z.string().optional().or(z.literal('')),
  estimatedHours: z.string().optional().or(z.literal('')),
  parentTaskId: z.string().uuid().optional().or(z.literal('')),
})

export async function createTaskAction(_prev: TaskActionState, formData: FormData): Promise<TaskActionState> {
  const { user, profile } = await requirePermission(PERMISSIONS.TASKS_CREATE)

  const parsed = taskSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    projectId: formData.get('projectId'),
    departmentId: formData.get('departmentId'),
    assignedTo: formData.get('assignedTo'),
    priority: formData.get('priority') || 'MEDIUM',
    dueDate: formData.get('dueDate'),
    estimatedHours: formData.get('estimatedHours'),
    parentTaskId: formData.get('parentTaskId'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid task details' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      organization_id: profile.organization_id,
      created_by: user.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      project_id: nullableUuid(parsed.data.projectId),
      department_id: nullableUuid(parsed.data.departmentId),
      assigned_to: nullableUuid(parsed.data.assignedTo),
      priority: parsed.data.priority,
      due_date: parsed.data.dueDate || null,
      estimated_hours: parsed.data.estimatedHours ? Number(parsed.data.estimatedHours) : null,
      parent_task_id: nullableUuid(parsed.data.parentTaskId),
    })
    .select('id')
    .single()

  if (error || !data) {
    return { error: 'Could not create task. Please try again.' }
  }

  await logAuditEvent({
    organizationId: profile.organization_id,
    actorId: user.id,
    action: 'task.created',
    resourceType: 'task',
    resourceId: data.id,
  })

  revalidatePath('/tasks')
  if (parsed.data.projectId) revalidatePath(`/projects/${parsed.data.projectId}`)

  if (formData.get('redirectToDetail')) {
    redirect(`/tasks/${data.id}`)
  }
  return {}
}

const updateSchema = taskSchema.extend({ taskId: z.string().uuid() })

export async function updateTaskAction(_prev: TaskActionState, formData: FormData): Promise<TaskActionState> {
  const { user, profile } = await requireOrg()

  const parsed = updateSchema.safeParse({
    taskId: formData.get('taskId'),
    title: formData.get('title'),
    description: formData.get('description'),
    projectId: formData.get('projectId'),
    departmentId: formData.get('departmentId'),
    assignedTo: formData.get('assignedTo'),
    priority: formData.get('priority') || 'MEDIUM',
    dueDate: formData.get('dueDate'),
    estimatedHours: formData.get('estimatedHours'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid task details' }
  }

  const supabase = await createClient()

  // Assignees may edit their own task even without tasks.update (matches RLS).
  const { data: existing } = await supabase.from('tasks').select('assigned_to').eq('id', parsed.data.taskId).single()
  if (existing?.assigned_to !== user.id) {
    await requirePermission(PERMISSIONS.TASKS_UPDATE)
  }

  const { error } = await supabase
    .from('tasks')
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      project_id: nullableUuid(parsed.data.projectId),
      department_id: nullableUuid(parsed.data.departmentId),
      assigned_to: nullableUuid(parsed.data.assignedTo),
      priority: parsed.data.priority,
      due_date: parsed.data.dueDate || null,
      estimated_hours: parsed.data.estimatedHours ? Number(parsed.data.estimatedHours) : null,
    })
    .eq('id', parsed.data.taskId)

  if (error) return { error: 'Could not update task.' }

  await logAuditEvent({
    organizationId: profile.organization_id!,
    actorId: user.id,
    action: 'task.updated',
    resourceType: 'task',
    resourceId: parsed.data.taskId,
  })

  revalidatePath('/tasks')
  revalidatePath(`/tasks/${parsed.data.taskId}`)
  return {}
}

export async function updateTaskStatusAction(taskId: string, status: string) {
  const { user, profile } = await requireOrg()
  const supabase = await createClient()

  const { data: existing } = await supabase.from('tasks').select('assigned_to').eq('id', taskId).single()
  if (existing?.assigned_to !== user.id) {
    await requirePermission(PERMISSIONS.TASKS_UPDATE)
  }

  const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId)
  if (error) return

  await logAuditEvent({
    organizationId: profile.organization_id!,
    actorId: user.id,
    action: 'task.status_changed',
    resourceType: 'task',
    resourceId: taskId,
    metadata: { status },
  })

  revalidatePath('/tasks')
  revalidatePath(`/tasks/${taskId}`)
}

export async function deleteTaskAction(taskId: string) {
  const { user, profile } = await requirePermission(PERMISSIONS.TASKS_DELETE)
  const supabase = await createClient()
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) return

  await logAuditEvent({
    organizationId: profile.organization_id,
    actorId: user.id,
    action: 'task.deleted',
    resourceType: 'task',
    resourceId: taskId,
  })

  revalidatePath('/tasks')
  redirect('/tasks')
}

const commentSchema = z.object({ taskId: z.string().uuid(), body: z.string().min(1) })

export async function addCommentAction(_prev: TaskActionState, formData: FormData): Promise<TaskActionState> {
  const { user, profile } = await requireOrg()
  const parsed = commentSchema.safeParse({ taskId: formData.get('taskId'), body: formData.get('body') })
  if (!parsed.success) return { error: 'Comment cannot be empty' }

  const supabase = await createClient()
  const { error } = await supabase.from('task_comments').insert({
    organization_id: profile.organization_id,
    task_id: parsed.data.taskId,
    author_id: user.id,
    body: parsed.data.body,
  })

  if (error) return { error: 'Could not post comment.' }

  revalidatePath(`/tasks/${parsed.data.taskId}`)
  return {}
}

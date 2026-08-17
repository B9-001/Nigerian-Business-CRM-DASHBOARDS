'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requirePermission, requireOrg } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { logAuditEvent } from '@/lib/security/audit'
import { PERMISSIONS } from '@/lib/permissions/catalog'

const employeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email(),
  phone: z.string().optional().or(z.literal('')),
  departmentId: z.string().uuid().optional().or(z.literal('')),
  teamId: z.string().uuid().optional().or(z.literal('')),
  jobTitle: z.string().optional().or(z.literal('')),
  managerId: z.string().uuid().optional().or(z.literal('')),
  joinDate: z.string().optional().or(z.literal('')),
})

export interface EmployeeActionState {
  error?: string
}

function nullableUuid(value?: string) {
  return value && value.length > 0 ? value : null
}

export async function createEmployeeAction(_prev: EmployeeActionState, formData: FormData): Promise<EmployeeActionState> {
  const { user, profile } = await requirePermission(PERMISSIONS.EMPLOYEES_CREATE)

  const parsed = employeeSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    departmentId: formData.get('departmentId'),
    teamId: formData.get('teamId'),
    jobTitle: formData.get('jobTitle'),
    managerId: formData.get('managerId'),
    joinDate: formData.get('joinDate'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid employee details' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employees')
    .insert({
      organization_id: profile.organization_id,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      department_id: nullableUuid(parsed.data.departmentId),
      team_id: nullableUuid(parsed.data.teamId),
      job_title: parsed.data.jobTitle || null,
      manager_id: nullableUuid(parsed.data.managerId),
      join_date: parsed.data.joinDate || null,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { error: 'Could not create employee. Please try again.' }
  }

  await logAuditEvent({
    organizationId: profile.organization_id,
    actorId: user.id,
    action: 'employee.created',
    resourceType: 'employee',
    resourceId: data.id,
  })

  revalidatePath('/employees')
  redirect(`/employees/${data.id}`)
}

const updateSchema = employeeSchema.extend({
  employeeId: z.string().uuid(),
  employmentStatus: z.enum(['ACTIVE', 'SUSPENDED', 'TERMINATED', 'ON_LEAVE']),
})

export async function updateEmployeeAction(_prev: EmployeeActionState, formData: FormData): Promise<EmployeeActionState> {
  const { user, profile } = await requirePermission(PERMISSIONS.EMPLOYEES_UPDATE)

  const parsed = updateSchema.safeParse({
    employeeId: formData.get('employeeId'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    departmentId: formData.get('departmentId'),
    teamId: formData.get('teamId'),
    jobTitle: formData.get('jobTitle'),
    managerId: formData.get('managerId'),
    joinDate: formData.get('joinDate'),
    employmentStatus: formData.get('employmentStatus'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid employee details' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('employees')
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      department_id: nullableUuid(parsed.data.departmentId),
      team_id: nullableUuid(parsed.data.teamId),
      job_title: parsed.data.jobTitle || null,
      manager_id: nullableUuid(parsed.data.managerId),
      join_date: parsed.data.joinDate || null,
      employment_status: parsed.data.employmentStatus,
    })
    .eq('id', parsed.data.employeeId)

  if (error) {
    return { error: 'Could not update employee.' }
  }

  await logAuditEvent({
    organizationId: profile.organization_id,
    actorId: user.id,
    action: 'employee.updated',
    resourceType: 'employee',
    resourceId: parsed.data.employeeId,
  })

  revalidatePath('/employees')
  revalidatePath(`/employees/${parsed.data.employeeId}`)
  return {}
}

export async function suspendEmployeeAction(employeeId: string) {
  const { user, profile } = await requirePermission(PERMISSIONS.EMPLOYEES_DELETE)
  const supabase = await createClient()

  const { error } = await supabase.from('employees').update({ employment_status: 'SUSPENDED' }).eq('id', employeeId)
  if (error) return

  await logAuditEvent({
    organizationId: profile.organization_id,
    actorId: user.id,
    action: 'employee.suspended',
    resourceType: 'employee',
    resourceId: employeeId,
  })

  revalidatePath('/employees')
}

export async function reactivateEmployeeAction(employeeId: string) {
  const { user, profile } = await requirePermission(PERMISSIONS.EMPLOYEES_UPDATE)
  const supabase = await createClient()

  const { error } = await supabase.from('employees').update({ employment_status: 'ACTIVE' }).eq('id', employeeId)
  if (error) return

  await logAuditEvent({
    organizationId: profile.organization_id,
    actorId: user.id,
    action: 'employee.reactivated',
    resourceType: 'employee',
    resourceId: employeeId,
  })

  revalidatePath('/employees')
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------
const departmentSchema = z.object({
  name: z.string().min(1, 'Department name is required'),
  description: z.string().optional().or(z.literal('')),
})

export async function createDepartmentAction(_prev: EmployeeActionState, formData: FormData): Promise<EmployeeActionState> {
  const { user, profile } = await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE)
  const parsed = departmentSchema.safeParse({ name: formData.get('name'), description: formData.get('description') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid department' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('departments')
    .insert({ organization_id: profile.organization_id, name: parsed.data.name, description: parsed.data.description || null })
    .select('id')
    .single()

  if (error || !data) return { error: 'Could not create department.' }

  await logAuditEvent({
    organizationId: profile.organization_id,
    actorId: user.id,
    action: 'department.created',
    resourceType: 'department',
    resourceId: data.id,
  })

  revalidatePath('/departments')
  return {}
}

export async function deleteDepartmentAction(departmentId: string) {
  const { user, profile } = await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE)
  const supabase = await createClient()
  const { error } = await supabase.from('departments').delete().eq('id', departmentId)
  if (error) return

  await logAuditEvent({
    organizationId: profile.organization_id,
    actorId: user.id,
    action: 'department.deleted',
    resourceType: 'department',
    resourceId: departmentId,
  })
  revalidatePath('/departments')
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------
const teamSchema = z.object({
  name: z.string().min(1, 'Team name is required'),
  departmentId: z.string().uuid().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
})

export async function createTeamAction(_prev: EmployeeActionState, formData: FormData): Promise<EmployeeActionState> {
  const { user, profile } = await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE)
  const parsed = teamSchema.safeParse({
    name: formData.get('name'),
    departmentId: formData.get('departmentId'),
    description: formData.get('description'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid team' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('teams')
    .insert({
      organization_id: profile.organization_id,
      name: parsed.data.name,
      department_id: nullableUuid(parsed.data.departmentId),
      description: parsed.data.description || null,
    })
    .select('id')
    .single()

  if (error || !data) return { error: 'Could not create team.' }

  await logAuditEvent({
    organizationId: profile.organization_id,
    actorId: user.id,
    action: 'team.created',
    resourceType: 'team',
    resourceId: data.id,
  })

  revalidatePath('/teams')
  return {}
}

export async function deleteTeamAction(teamId: string) {
  const { profile } = await requireOrg()
  await requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE)
  const supabase = await createClient()
  await supabase.from('teams').delete().eq('id', teamId).eq('organization_id', profile.organization_id)
  revalidatePath('/teams')
}

'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { logAuditEvent } from '@/lib/security/audit'
import { PERMISSIONS } from '@/lib/permissions/catalog'

export interface CrmActionState {
  error?: string
}

function nullableUuid(value?: string | null) {
  return value && value.length > 0 ? value : null
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------
const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  company: z.string().optional().or(z.literal('')),
  source: z.string().optional().or(z.literal('')),
})

export async function createCustomerAction(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  const { user, profile } = await requirePermission(PERMISSIONS.CUSTOMERS_CREATE)
  const parsed = customerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    company: formData.get('company'),
    source: formData.get('source'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid customer details' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .insert({
      organization_id: profile.organization_id,
      owner_id: user.id,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      company: parsed.data.company || null,
      source: parsed.data.source || null,
    })
    .select('id')
    .single()

  if (error || !data) return { error: 'Could not create customer.' }

  await logAuditEvent({ organizationId: profile.organization_id, actorId: user.id, action: 'customer.created', resourceType: 'customer', resourceId: data.id })
  revalidatePath('/crm/customers')
  return {}
}

const noteSchema = z.object({ customerId: z.string().uuid(), body: z.string().min(1) })

export async function addCustomerActivityAction(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  const { user, profile } = await requirePermission(PERMISSIONS.CUSTOMERS_VIEW)
  const parsed = noteSchema.safeParse({ customerId: formData.get('customerId'), body: formData.get('body') })
  if (!parsed.success) return { error: 'Note cannot be empty' }

  const supabase = await createClient()
  const { error } = await supabase.from('crm_activities').insert({
    organization_id: profile.organization_id,
    customer_id: parsed.data.customerId,
    type: 'NOTE',
    body: parsed.data.body,
    actor_id: user.id,
  })

  if (error) return { error: 'Could not save note.' }
  revalidatePath(`/crm/customers/${parsed.data.customerId}`)
  return {}
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------
const leadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  company: z.string().optional().or(z.literal('')),
  source: z.string().optional().or(z.literal('')),
})

export async function createLeadAction(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  const { user, profile } = await requirePermission(PERMISSIONS.CUSTOMERS_CREATE)
  const parsed = leadSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    company: formData.get('company'),
    source: formData.get('source'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid lead details' }

  const supabase = await createClient()
  const { error } = await supabase.from('leads').insert({
    organization_id: profile.organization_id,
    owner_id: user.id,
    name: parsed.data.name,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    company: parsed.data.company || null,
    source: parsed.data.source || null,
  })

  if (error) return { error: 'Could not create lead.' }
  revalidatePath('/crm/leads')
  return {}
}

export async function updateLeadStatusAction(leadId: string, status: string) {
  const { user, profile } = await requirePermission(PERMISSIONS.CUSTOMERS_UPDATE)
  const supabase = await createClient()
  const { error } = await supabase.from('leads').update({ status }).eq('id', leadId)
  if (error) return

  await logAuditEvent({ organizationId: profile.organization_id, actorId: user.id, action: 'lead.status_changed', resourceType: 'lead', resourceId: leadId, metadata: { status } })
  revalidatePath('/crm/leads')
}

export async function convertLeadAction(leadId: string) {
  const { user, profile } = await requirePermission(PERMISSIONS.CUSTOMERS_CREATE)
  const supabase = await createClient()

  const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single()
  if (!lead) return

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .insert({
      organization_id: profile.organization_id,
      owner_id: lead.owner_id ?? user.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      source: lead.source,
    })
    .select('id')
    .single()

  if (customerError || !customer) return

  await supabase.from('leads').update({ status: 'WON', converted_customer_id: customer.id }).eq('id', leadId)

  await logAuditEvent({
    organizationId: profile.organization_id,
    actorId: user.id,
    action: 'lead.converted',
    resourceType: 'lead',
    resourceId: leadId,
    metadata: { customerId: customer.id },
  })

  revalidatePath('/crm/leads')
  revalidatePath('/crm/customers')
}

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------
const dealSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  valueNgn: z.string().optional().or(z.literal('')),
  customerId: z.string().uuid().optional().or(z.literal('')),
  leadId: z.string().uuid().optional().or(z.literal('')),
  expectedCloseDate: z.string().optional().or(z.literal('')),
  probability: z.string().optional().or(z.literal('')),
})

export async function createDealAction(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  const { user, profile } = await requirePermission(PERMISSIONS.CUSTOMERS_CREATE)
  const parsed = dealSchema.safeParse({
    title: formData.get('title'),
    valueNgn: formData.get('valueNgn'),
    customerId: formData.get('customerId'),
    leadId: formData.get('leadId'),
    expectedCloseDate: formData.get('expectedCloseDate'),
    probability: formData.get('probability'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid deal details' }

  const supabase = await createClient()
  const { error } = await supabase.from('deals').insert({
    organization_id: profile.organization_id,
    owner_id: user.id,
    title: parsed.data.title,
    value_ngn: parsed.data.valueNgn ? Number(parsed.data.valueNgn) : 0,
    customer_id: nullableUuid(parsed.data.customerId),
    lead_id: nullableUuid(parsed.data.leadId),
    expected_close_date: parsed.data.expectedCloseDate || null,
    probability: parsed.data.probability ? Number(parsed.data.probability) : null,
  })

  if (error) return { error: 'Could not create deal.' }
  revalidatePath('/crm/deals')
  return {}
}

export async function updateDealStageAction(dealId: string, stage: string) {
  const { user, profile } = await requirePermission(PERMISSIONS.CUSTOMERS_UPDATE)
  const supabase = await createClient()
  const { error } = await supabase.from('deals').update({ stage }).eq('id', dealId)
  if (error) return

  await logAuditEvent({ organizationId: profile.organization_id, actorId: user.id, action: 'deal.stage_changed', resourceType: 'deal', resourceId: dealId, metadata: { stage } })
  revalidatePath('/crm/deals')
}

// ---------------------------------------------------------------------------
// Support tickets
// ---------------------------------------------------------------------------
const ticketSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  description: z.string().optional().or(z.literal('')),
  customerId: z.string().uuid().optional().or(z.literal('')),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  category: z.string().optional().or(z.literal('')),
})

export async function createTicketAction(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  const { user, profile } = await requirePermission(PERMISSIONS.SUPPORT_MANAGE)
  const parsed = ticketSchema.safeParse({
    subject: formData.get('subject'),
    description: formData.get('description'),
    customerId: formData.get('customerId'),
    priority: formData.get('priority') || 'MEDIUM',
    category: formData.get('category'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid ticket details' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tickets')
    .insert({
      organization_id: profile.organization_id,
      assigned_to: user.id,
      customer_id: nullableUuid(parsed.data.customerId),
      subject: parsed.data.subject,
      description: parsed.data.description || null,
      priority: parsed.data.priority,
      category: parsed.data.category || null,
    })
    .select('id')
    .single()

  if (error || !data) return { error: 'Could not create ticket.' }

  await logAuditEvent({ organizationId: profile.organization_id, actorId: user.id, action: 'ticket.created', resourceType: 'ticket', resourceId: data.id })
  revalidatePath('/support')
  return {}
}

export async function updateTicketAction(ticketId: string, fields: { status?: string; priority?: string; assigned_to?: string }) {
  const { user, profile } = await requirePermission(PERMISSIONS.SUPPORT_MANAGE)
  const supabase = await createClient()
  const { error } = await supabase.from('tickets').update(fields).eq('id', ticketId)
  if (error) return

  await logAuditEvent({ organizationId: profile.organization_id, actorId: user.id, action: 'ticket.updated', resourceType: 'ticket', resourceId: ticketId, metadata: fields })
  revalidatePath('/support')
  revalidatePath(`/support/${ticketId}`)
}

const ticketMessageSchema = z.object({ ticketId: z.string().uuid(), body: z.string().min(1), isInternalNote: z.string().optional() })

export async function addTicketMessageAction(_prev: CrmActionState, formData: FormData): Promise<CrmActionState> {
  const { user, profile } = await requirePermission(PERMISSIONS.SUPPORT_VIEW)
  const parsed = ticketMessageSchema.safeParse({
    ticketId: formData.get('ticketId'),
    body: formData.get('body'),
    isInternalNote: formData.get('isInternalNote') ?? undefined,
  })
  if (!parsed.success) return { error: 'Message cannot be empty' }

  const supabase = await createClient()
  const { error } = await supabase.from('ticket_messages').insert({
    organization_id: profile.organization_id,
    ticket_id: parsed.data.ticketId,
    author_id: user.id,
    body: parsed.data.body,
    is_internal_note: parsed.data.isInternalNote === 'on',
  })

  if (error) return { error: 'Could not send message.' }
  revalidatePath(`/support/${parsed.data.ticketId}`)
  return {}
}

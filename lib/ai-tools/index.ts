import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '@/types/database'
import type { AIToolSchema } from '@/lib/ai/providers/types'
import { PERMISSIONS, type PermissionKey } from '@/lib/permissions/catalog'

export interface ToolContext {
  supabase: SupabaseClient<Database>
  organizationId: string
  userId: string
  /** Permission check bound to the CURRENT request's session (see app/api/ai/chat/route.ts). */
  can: (permission: PermissionKey) => Promise<boolean>
}

export type ToolResult = { ok: true; data: unknown } | { ok: false; error: string }

interface ToolDefinition {
  schema: AIToolSchema
  permission: PermissionKey
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>
}

async function guarded(ctx: ToolContext, permission: PermissionKey, fn: () => Promise<ToolResult>): Promise<ToolResult> {
  if (!(await ctx.can(permission))) {
    return { ok: false, error: `Forbidden: you don't have the "${permission}" permission.` }
  }
  return fn()
}

const TOOLS: ToolDefinition[] = [
  {
    permission: PERMISSIONS.TASKS_VIEW,
    schema: {
      name: 'get_tasks',
      description: 'List tasks, optionally filtered by status, priority, or overdue.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'COMPLETED', 'CANCELLED'] },
          overdueOnly: { type: 'boolean' },
          limit: { type: 'number' },
        },
      },
    },
    async execute(args, ctx) {
      return guarded(ctx, PERMISSIONS.TASKS_VIEW, async () => {
        let query = ctx.supabase
          .from('tasks')
          .select('id, title, status, priority, due_date')
          .eq('organization_id', ctx.organizationId)
          .limit(typeof args.limit === 'number' ? args.limit : 20)

        if (typeof args.status === 'string') query = query.eq('status', args.status)
        if (args.overdueOnly) {
          query = query.lt('due_date', new Date().toISOString().slice(0, 10)).not('status', 'in', '("COMPLETED","CANCELLED")')
        }

        const { data, error } = await query
        if (error) return { ok: false, error: error.message }
        return { ok: true, data }
      })
    },
  },
  {
    permission: PERMISSIONS.TASKS_CREATE,
    schema: {
      name: 'create_task',
      description: "Create a task. Use this when the user asks to create/assign work, e.g. 'create a task for Sarah to finish the proposal on Friday'.",
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          assigneeEmail: { type: 'string', description: 'Email of the person to assign the task to, if known.' },
          dueDate: { type: 'string', description: 'YYYY-MM-DD' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
        },
        required: ['title'],
      },
    },
    async execute(args, ctx) {
      return guarded(ctx, PERMISSIONS.TASKS_CREATE, async () => {
        const parsed = z.object({ title: z.string().min(1), assigneeEmail: z.string().optional(), dueDate: z.string().optional(), priority: z.string().optional() }).safeParse(args)
        if (!parsed.success) return { ok: false, error: 'Invalid task arguments' }

        let assignedTo: string | null = null
        if (parsed.data.assigneeEmail) {
          const { data: person } = await ctx.supabase
            .from('profiles')
            .select('id')
            .eq('organization_id', ctx.organizationId)
            .eq('email', parsed.data.assigneeEmail)
            .maybeSingle()
          assignedTo = person?.id ?? null
        }

        const { data, error } = await ctx.supabase
          .from('tasks')
          .insert({
            organization_id: ctx.organizationId,
            created_by: ctx.userId,
            title: parsed.data.title,
            assigned_to: assignedTo,
            due_date: parsed.data.dueDate ?? null,
            priority: (parsed.data.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT') ?? 'MEDIUM',
          })
          .select('id, title')
          .single()

        if (error || !data) return { ok: false, error: error?.message ?? 'Could not create task' }
        return { ok: true, data }
      })
    },
  },
  {
    permission: PERMISSIONS.EMPLOYEES_VIEW,
    schema: {
      name: 'get_employees',
      description: 'Search/list employees by name or department.',
      parameters: { type: 'object', properties: { search: { type: 'string' } } },
    },
    async execute(args, ctx) {
      return guarded(ctx, PERMISSIONS.EMPLOYEES_VIEW, async () => {
        let query = ctx.supabase
          .from('employees')
          .select('id, first_name, last_name, job_title, employment_status')
          .eq('organization_id', ctx.organizationId)
          .limit(20)
        if (typeof args.search === 'string' && args.search) {
          query = query.or(`first_name.ilike.%${args.search}%,last_name.ilike.%${args.search}%`)
        }
        const { data, error } = await query
        if (error) return { ok: false, error: error.message }
        return { ok: true, data }
      })
    },
  },
  {
    permission: PERMISSIONS.PROJECTS_VIEW,
    schema: {
      name: 'get_projects',
      description: 'List projects, optionally filtered by status.',
      parameters: { type: 'object', properties: { status: { type: 'string' } } },
    },
    async execute(args, ctx) {
      return guarded(ctx, PERMISSIONS.PROJECTS_VIEW, async () => {
        let query = ctx.supabase.from('projects').select('id, name, status, progress, deadline').eq('organization_id', ctx.organizationId)
        if (typeof args.status === 'string') query = query.eq('status', args.status)
        const { data, error } = await query
        if (error) return { ok: false, error: error.message }
        return { ok: true, data }
      })
    },
  },
  {
    permission: PERMISSIONS.CUSTOMERS_VIEW,
    schema: {
      name: 'get_customers',
      description: 'List or search customers.',
      parameters: { type: 'object', properties: { search: { type: 'string' } } },
    },
    async execute(args, ctx) {
      return guarded(ctx, PERMISSIONS.CUSTOMERS_VIEW, async () => {
        let query = ctx.supabase.from('customers').select('id, name, company, status').eq('organization_id', ctx.organizationId).limit(20)
        if (typeof args.search === 'string' && args.search) query = query.ilike('name', `%${args.search}%`)
        const { data, error } = await query
        if (error) return { ok: false, error: error.message }
        return { ok: true, data }
      })
    },
  },
  {
    permission: PERMISSIONS.MEETINGS_VIEW,
    schema: {
      name: 'get_meetings',
      description: 'List upcoming or past meetings.',
      parameters: { type: 'object', properties: { when: { type: 'string', enum: ['upcoming', 'past'] } } },
    },
    async execute(args, ctx) {
      return guarded(ctx, PERMISSIONS.MEETINGS_VIEW, async () => {
        const now = new Date().toISOString()
        let query = ctx.supabase.from('meetings').select('id, title, start_time, status').eq('organization_id', ctx.organizationId)
        query = args.when === 'past' ? query.lt('start_time', now) : query.gte('start_time', now)
        const { data, error } = await query.order('start_time', { ascending: args.when !== 'past' }).limit(10)
        if (error) return { ok: false, error: error.message }
        return { ok: true, data }
      })
    },
  },
  {
    permission: PERMISSIONS.SUPPORT_VIEW,
    schema: {
      name: 'get_tickets',
      description: 'List open support tickets/customer complaints.',
      parameters: { type: 'object', properties: { status: { type: 'string' } } },
    },
    async execute(args, ctx) {
      return guarded(ctx, PERMISSIONS.SUPPORT_VIEW, async () => {
        let query = ctx.supabase.from('tickets').select('id, subject, status, priority').eq('organization_id', ctx.organizationId)
        query = typeof args.status === 'string' ? query.eq('status', args.status) : query.not('status', 'in', '("RESOLVED","CLOSED")')
        const { data, error } = await query.limit(20)
        if (error) return { ok: false, error: error.message }
        return { ok: true, data }
      })
    },
  },
]

export function getToolSchemas(): AIToolSchema[] {
  return TOOLS.map((t) => t.schema)
}

export async function executeTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const tool = TOOLS.find((t) => t.schema.name === name)
  if (!tool) return { ok: false, error: `Unknown tool: ${name}` }
  try {
    return await tool.execute(args, ctx)
  } catch (err) {
    console.error(`[ai-tools] ${name} threw`, err)
    return { ok: false, error: 'Tool execution failed' }
  }
}

import type { AITask } from './router'
import type { PermissionKey } from '@/lib/permissions/catalog'
import { PERMISSIONS } from '@/lib/permissions/catalog'

/**
 * The 8 AI agents (CLAUDE.md #51 "AI Agent Architecture"). Every agent
 * shares the same underlying provider router, tool system, and
 * authorization layer (lib/ai-tools) — an "agent" here is just a named
 * persona: a system-prompt focus, a default routing task (which model
 * tier it gets), which tools it's allowed to call, and which permission
 * gates access to it at all. This is intentionally NOT a separate
 * infrastructure stack per agent (CLAUDE.md #22 "do not duplicate AI
 * infrastructure") — see app/api/ai/chat/route.ts for how `agentType` is
 * threaded through routeModel()/AI_TOOLS.
 */
export type AgentType = 'EXECUTIVE' | 'RESEARCH' | 'TASK' | 'MEETING' | 'CRM' | 'SUPPORT' | 'KNOWLEDGE' | 'REPORT'

export interface AgentDefinition {
  type: AgentType
  label: string
  description: string
  systemPromptFocus: string
  routeTask: AITask
  /** Tool names this agent may call. `undefined` = every tool the AI_TOOLS registry exposes. */
  toolNames?: string[]
  permission: PermissionKey
}

export const AI_AGENTS: Record<AgentType, AgentDefinition> = {
  EXECUTIVE: {
    type: 'EXECUTIVE',
    label: 'Executive Assistant',
    description: 'General business questions across every module — tasks, projects, team, customers, meetings, tickets.',
    systemPromptFocus: 'You give concise, decision-useful answers for a business owner or manager looking across the whole organization.',
    routeTask: 'simple',
    permission: PERMISSIONS.AI_USE,
  },
  RESEARCH: {
    type: 'RESEARCH',
    label: 'Research Agent',
    description: 'Web research with cited sources — market, competitor, regulatory research.',
    systemPromptFocus:
      'You research using web search and clearly separate verified sources from your own analysis or inference. For a full cited report, direct the user to /ai/research (POST /api/ai/research) — that flow runs as a background job and calls the web-search-capable model directly; this chat persona is for quick research questions only.',
    routeTask: 'research',
    // No org-data tools — deliberate. Deep web research goes through the
    // dedicated /api/ai/research background-job flow (lib/ai/research.ts),
    // which calls the provider's web-search capability directly rather
    // than through the AI_TOOLS registry.
    toolNames: [],
    permission: PERMISSIONS.AI_RESEARCH,
  },
  TASK: {
    type: 'TASK',
    label: 'Task Assistant',
    description: 'Create, assign, and query tasks.',
    systemPromptFocus: 'You help manage tasks: creating, assigning, checking status, and finding overdue work.',
    routeTask: 'simple',
    toolNames: ['get_tasks', 'create_task'],
    permission: PERMISSIONS.AI_USE,
  },
  MEETING: {
    type: 'MEETING',
    label: 'Meeting Assistant',
    description: 'Meeting schedules, summaries, and action items.',
    systemPromptFocus: 'You help with meetings: what is scheduled, and summarizing outcomes/action items when a transcript is available.',
    routeTask: 'meeting_summary',
    toolNames: ['get_meetings'],
    permission: PERMISSIONS.AI_USE,
  },
  CRM: {
    type: 'CRM',
    label: 'CRM Agent',
    description: 'Customers, leads, and deals.',
    systemPromptFocus: 'You help with customer relationship management: finding customers, checking deal/lead status.',
    routeTask: 'simple',
    toolNames: ['get_customers'],
    permission: PERMISSIONS.AI_USE,
  },
  SUPPORT: {
    type: 'SUPPORT',
    label: 'Support Agent',
    description: 'Support tickets and customer complaints.',
    systemPromptFocus: 'You help triage and summarize support tickets.',
    routeTask: 'simple',
    toolNames: ['get_tickets'],
    permission: PERMISSIONS.AI_USE,
  },
  KNOWLEDGE: {
    type: 'KNOWLEDGE',
    label: 'Knowledge Agent',
    description: "Answers from the organization's uploaded documents.",
    systemPromptFocus:
      "You answer using the organization's uploaded company knowledge documents when relevant. If the knowledge base doesn't cover something, say so plainly.",
    routeTask: 'document',
    permission: PERMISSIONS.AI_USE,
  },
  REPORT: {
    type: 'REPORT',
    label: 'Report Agent',
    description: 'Summarizes business performance — task completion, sales, team activity.',
    systemPromptFocus: 'You generate concise business performance summaries grounded in real data from the available tools — never invented numbers.',
    routeTask: 'complex',
    toolNames: ['get_tasks', 'get_projects', 'get_customers', 'get_meetings', 'get_tickets', 'get_employees'],
    permission: PERMISSIONS.REPORTS_VIEW,
  },
}

export function getAgent(type: string | null | undefined): AgentDefinition {
  return AI_AGENTS[(type as AgentType) ?? 'EXECUTIVE'] ?? AI_AGENTS.EXECUTIVE
}

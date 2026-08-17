/**
 * Permission catalog — MUST stay in sync with
 * supabase/migrations/20260101000200_rbac.sql. The database is the source of
 * truth for enforcement (RLS calls public.has_permission()); this file is
 * the source of truth for the app-layer checks and for rendering permission
 * pickers in Settings.
 */
export const PERMISSIONS = {
  ORGANIZATION_VIEW: 'organization.view',
  ORGANIZATION_UPDATE: 'organization.update',
  SETTINGS_MANAGE: 'settings.manage',

  EMPLOYEES_VIEW: 'employees.view',
  EMPLOYEES_CREATE: 'employees.create',
  EMPLOYEES_UPDATE: 'employees.update',
  EMPLOYEES_DELETE: 'employees.delete',
  DEPARTMENTS_MANAGE: 'departments.manage',

  TASKS_VIEW: 'tasks.view',
  TASKS_CREATE: 'tasks.create',
  TASKS_ASSIGN: 'tasks.assign',
  TASKS_UPDATE: 'tasks.update',
  TASKS_DELETE: 'tasks.delete',

  PROJECTS_VIEW: 'projects.view',
  PROJECTS_CREATE: 'projects.create',
  PROJECTS_UPDATE: 'projects.update',
  PROJECTS_DELETE: 'projects.delete',

  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_CREATE: 'customers.create',
  CUSTOMERS_UPDATE: 'customers.update',
  CUSTOMERS_DELETE: 'customers.delete',

  SUPPORT_VIEW: 'support.view',
  SUPPORT_MANAGE: 'support.manage',

  MEETINGS_VIEW: 'meetings.view',
  MEETINGS_CREATE: 'meetings.create',
  MEETINGS_UPDATE: 'meetings.update',

  CHAT_USE: 'chat.use',

  AI_USE: 'ai.use',
  AI_RESEARCH: 'ai.research',
  AI_KNOWLEDGE_MANAGE: 'ai.knowledge.manage',

  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',

  INTEGRATIONS_MANAGE: 'integrations.manage',
  AUDIT_VIEW: 'audit.view',
  BILLING_MANAGE: 'billing.manage',
  ADMIN_PLATFORM: 'admin.platform',
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'STAFF', 'VIEWER'] as const
export type Role = (typeof ROLES)[number]

/**
 * Default role -> permission grants. Mirrors the `role_permissions` seed
 * data. Used for optimistic UI checks (e.g. hiding a button) — the
 * authoritative check always happens server-side via hasPermission().
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, PermissionKey[]> = {
  OWNER: Object.values(PERMISSIONS),
  ADMIN: Object.values(PERMISSIONS).filter((p) => p !== PERMISSIONS.ADMIN_PLATFORM),
  MANAGER: [
    PERMISSIONS.ORGANIZATION_VIEW,
    PERMISSIONS.EMPLOYEES_VIEW,
    PERMISSIONS.EMPLOYEES_CREATE,
    PERMISSIONS.EMPLOYEES_UPDATE,
    PERMISSIONS.DEPARTMENTS_MANAGE,
    PERMISSIONS.TASKS_VIEW,
    PERMISSIONS.TASKS_CREATE,
    PERMISSIONS.TASKS_ASSIGN,
    PERMISSIONS.TASKS_UPDATE,
    PERMISSIONS.TASKS_DELETE,
    PERMISSIONS.PROJECTS_VIEW,
    PERMISSIONS.PROJECTS_CREATE,
    PERMISSIONS.PROJECTS_UPDATE,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_UPDATE,
    PERMISSIONS.SUPPORT_VIEW,
    PERMISSIONS.SUPPORT_MANAGE,
    PERMISSIONS.MEETINGS_VIEW,
    PERMISSIONS.MEETINGS_CREATE,
    PERMISSIONS.MEETINGS_UPDATE,
    PERMISSIONS.CHAT_USE,
    PERMISSIONS.AI_USE,
    PERMISSIONS.AI_RESEARCH,
    PERMISSIONS.AI_KNOWLEDGE_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.INTEGRATIONS_MANAGE,
  ],
  STAFF: [
    PERMISSIONS.ORGANIZATION_VIEW,
    PERMISSIONS.EMPLOYEES_VIEW,
    PERMISSIONS.TASKS_VIEW,
    PERMISSIONS.TASKS_CREATE,
    PERMISSIONS.TASKS_UPDATE,
    PERMISSIONS.PROJECTS_VIEW,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_UPDATE,
    PERMISSIONS.SUPPORT_VIEW,
    PERMISSIONS.SUPPORT_MANAGE,
    PERMISSIONS.MEETINGS_VIEW,
    PERMISSIONS.MEETINGS_CREATE,
    PERMISSIONS.CHAT_USE,
    PERMISSIONS.AI_USE,
    PERMISSIONS.REPORTS_VIEW,
  ],
  VIEWER: [
    PERMISSIONS.ORGANIZATION_VIEW,
    PERMISSIONS.EMPLOYEES_VIEW,
    PERMISSIONS.TASKS_VIEW,
    PERMISSIONS.PROJECTS_VIEW,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.SUPPORT_VIEW,
    PERMISSIONS.MEETINGS_VIEW,
    PERMISSIONS.CHAT_USE,
    PERMISSIONS.REPORTS_VIEW,
  ],
}

export function roleHasPermissionByDefault(role: Role, permission: PermissionKey): boolean {
  return DEFAULT_ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

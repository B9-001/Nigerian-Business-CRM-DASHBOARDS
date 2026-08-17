import 'server-only'
import { createAdminClient } from '@/lib/database/supabase/admin'
import type { Json } from '@/types/database'

export interface AuditLogEntry {
  /** Null for platform-level actions that aren't scoped to a single organization (e.g. a platform admin editing a plan). */
  organizationId: string | null
  actorId: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  metadata?: Record<string, unknown>
  ipAddress?: string | null
}

/**
 * Writes an audit_logs row via the service-role client (clients cannot
 * insert audit_logs directly — see RLS in
 * 20260101000700_chat_notifications_audit.sql). Never pass secrets in
 * `metadata`.
 */
export async function logAuditEvent(entry: AuditLogEntry) {
  const admin = createAdminClient()

  const { error } = await admin.from('audit_logs').insert({
    organization_id: entry.organizationId,
    actor_id: entry.actorId,
    action: entry.action,
    resource_type: entry.resourceType,
    resource_id: entry.resourceId ?? null,
    metadata: (entry.metadata ?? {}) as Json,
    ip_address: entry.ipAddress ?? null,
  })

  if (error) {
    // Audit logging must never crash the primary request — log and move on.
    console.error('[audit] failed to write audit log', error, entry)
  }
}

import 'server-only'
import { createAdminClient } from '@/lib/database/supabase/admin'

export interface AuditLogEntry {
  organizationId: string
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
    metadata: entry.metadata ?? {},
    ip_address: entry.ipAddress ?? null,
  })

  if (error) {
    // Audit logging must never crash the primary request — log and move on.
    console.error('[audit] failed to write audit log', error, entry)
  }
}

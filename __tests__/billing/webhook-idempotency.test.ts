import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

/**
 * Verifies the actual database-level guarantee the webhook handler relies
 * on: `billing_events` has a UNIQUE(provider, idempotency_key) constraint,
 * so even if two webhook deliveries for the same event raced past the
 * handler's own "already processed?" check, the database itself refuses
 * a duplicate row (CLAUDE.md #35 — idempotency must be a real constraint,
 * not just application logic that can race).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const hasCredentials = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY)
const describeIfConfigured = hasCredentials ? describe : describe.skip

describeIfConfigured('billing_events idempotency', () => {
  it('rejects a second insert with the same (provider, idempotency_key)', async () => {
    const admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
    const idempotencyKey = `charge.success:test-ref-${Date.now()}`

    const first = await admin
      .from('billing_events')
      .insert({ provider: 'paystack', event_type: 'charge.success', idempotency_key: idempotencyKey, payload: { test: true } })

    expect(first.error).toBeNull()

    const second = await admin
      .from('billing_events')
      .insert({ provider: 'paystack', event_type: 'charge.success', idempotency_key: idempotencyKey, payload: { test: true } })

    // Postgres unique_violation
    expect(second.error).not.toBeNull()
    expect(second.error?.code).toBe('23505')

    // Cleanup
    await admin.from('billing_events').delete().eq('idempotency_key', idempotencyKey)
  })
})

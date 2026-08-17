import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient as createAnonClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Billing data is exactly the kind of thing that must NEVER leak across
 * tenants (#33 "Organization A must NEVER be able to access Organization
 * B subscriptions / invoices / transactions / billing customers / usage").
 * Same pattern as __tests__/tenant-isolation/rls.test.ts, extended to the
 * billing tables added for Paystack integration.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const hasCredentials = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY)
const describeIfConfigured = hasCredentials ? describe : describe.skip

describeIfConfigured('tenant isolation — billing tables', () => {
  const password = `Test-${Math.random().toString(36).slice(2)}!Aa1`
  const emailA = `rls-billing-a-${Date.now()}@example.com`
  const emailB = `rls-billing-b-${Date.now()}@example.com`

  let admin: SupabaseClient
  let clientA: SupabaseClient
  let clientB: SupabaseClient
  let userAId: string
  let userBId: string
  let orgAId: string

  beforeAll(async () => {
    admin = createServiceClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: createdA } = await admin.auth.admin.createUser({ email: emailA, password, email_confirm: true })
    const { data: createdB } = await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true })
    if (!createdA.user || !createdB.user) throw new Error('Failed to create test users')
    userAId = createdA.user.id
    userBId = createdB.user.id

    clientA = createAnonClient(SUPABASE_URL!, ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
    clientB = createAnonClient(SUPABASE_URL!, ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })

    const signInA = await clientA.auth.signInWithPassword({ email: emailA, password })
    const signInB = await clientB.auth.signInWithPassword({ email: emailB, password })
    if (signInA.error || signInB.error) throw new Error('Sign-in failed')

    const { data: orgAId_ } = await clientA.rpc('create_organization_and_join', {
      org_name: 'Billing RLS Test Org A',
      org_slug: `billing-rls-a-${Date.now()}`,
    })
    const { data: orgBId_ } = await clientB.rpc('create_organization_and_join', {
      org_name: 'Billing RLS Test Org B',
      org_slug: `billing-rls-b-${Date.now()}`,
    })
    if (!orgAId_ || !orgBId_) throw new Error('Failed to create test organizations')
    orgAId = orgAId_

    // create_organization_and_join already seeds a STARTER trialing
    // subscription for each org — no need to insert one manually.
    await admin.from('billing_transactions').insert({
      organization_id: orgAId,
      reference: `test-billing-rls-${Date.now()}`,
      amount: 25000,
      status: 'SUCCESS',
      plan_id: 'STARTER',
    })
  }, 30_000)

  afterAll(async () => {
    if (userAId) await admin.auth.admin.deleteUser(userAId).catch(() => undefined)
    if (userBId) await admin.auth.admin.deleteUser(userBId).catch(() => undefined)
  })

  it("user A can see their own organization's subscription", async () => {
    const { data } = await clientA.from('subscriptions').select('id').eq('organization_id', orgAId)
    expect(data).toHaveLength(1)
  })

  it("user B cannot see org A's subscription", async () => {
    const { data } = await clientB.from('subscriptions').select('id').eq('organization_id', orgAId)
    expect(data).toHaveLength(0)
  })

  it("user B cannot see org A's billing transactions", async () => {
    const { data } = await clientB.from('billing_transactions').select('id').eq('organization_id', orgAId)
    expect(data).toHaveLength(0)
  })

  it("user A can see their own organization's billing transactions (OWNER has billing.manage)", async () => {
    const { data } = await clientA.from('billing_transactions').select('id').eq('organization_id', orgAId)
    expect(data!.length).toBeGreaterThanOrEqual(1)
  })

  it('neither user can read billing_events (service-role only, no client policies)', async () => {
    const { data: dataA, error: errorA } = await clientA.from('billing_events').select('id').limit(1)
    const { data: dataB, error: errorB } = await clientB.from('billing_events').select('id').limit(1)
    // RLS with no policies means every row is filtered out (empty array),
    // not necessarily a query error — either way, no rows must be visible.
    expect(dataA ?? []).toHaveLength(0)
    expect(dataB ?? []).toHaveLength(0)
    expect(errorA).toBeNull()
    expect(errorB).toBeNull()
  })

  it('neither user can write to plans (platform admin / service-role only)', async () => {
    const { error } = await clientA.from('plans').update({ price_ngn_month: 1 }).eq('id', 'STARTER')
    // RLS blocks the update (no UPDATE policy exists), so 0 rows change —
    // verify the price was NOT actually changed.
    const { data: stillOriginal } = await admin.from('plans').select('price_ngn_month').eq('id', 'STARTER').single()
    expect(error).toBeNull()
    expect(stillOriginal?.price_ngn_month).toBe(25000)
  })
})

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient as createAnonClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * THE critical test for this whole product (CLAUDE.md #60/#67):
 * a user from Organization A must NEVER be able to read, update, or delete
 * Organization B's records. This hits the real Supabase project configured
 * in .env.local — that's intentional; RLS can only be verified against a
 * real Postgres instance, not mocked.
 *
 * Uses the service-role client to create two pre-confirmed throwaway users
 * (bypassing email confirmation, which would make this test flaky), then
 * signs in as each with the anon client to get RLS-scoped sessions.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const hasCredentials = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY)
const describeIfConfigured = hasCredentials ? describe : describe.skip

describeIfConfigured('tenant isolation (RLS)', () => {
  const password = `Test-${Math.random().toString(36).slice(2)}!Aa1`
  const emailA = `rls-test-a-${Date.now()}@example.com`
  const emailB = `rls-test-b-${Date.now()}@example.com`

  let admin: SupabaseClient
  let clientA: SupabaseClient
  let clientB: SupabaseClient
  let userAId: string
  let userBId: string
  let orgAId: string
  let taskId: string

  beforeAll(async () => {
    admin = createServiceClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: createdA, error: errA } = await admin.auth.admin.createUser({ email: emailA, password, email_confirm: true })
    const { data: createdB, error: errB } = await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true })
    if (errA || errB || !createdA.user || !createdB.user) throw new Error('Failed to create test users')

    userAId = createdA.user.id
    userBId = createdB.user.id

    clientA = createAnonClient(SUPABASE_URL!, ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
    clientB = createAnonClient(SUPABASE_URL!, ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })

    const signInA = await clientA.auth.signInWithPassword({ email: emailA, password })
    const signInB = await clientB.auth.signInWithPassword({ email: emailB, password })
    if (signInA.error || signInB.error) {
      throw new Error(`Sign-in failed: ${signInA.error?.message ?? ''} ${signInB.error?.message ?? ''}`)
    }
    if (!signInA.data.session || !signInB.data.session) {
      throw new Error('Sign-in succeeded but no session was returned')
    }

    // Each user creates their own organization and becomes its OWNER via
    // the same atomic RPC app/onboarding/actions.ts uses (see
    // supabase/migrations/20260101001300_create_organization_rpc.sql —
    // org creation + profile linking must happen in one SECURITY DEFINER
    // call; separate insert-then-update steps hit an RLS chicken-and-egg
    // gap because the org's SELECT policy depends on the profile update
    // that hasn't happened yet).
    const { data: orgAId_, error: orgAErr } = await clientA.rpc('create_organization_and_join', {
      org_name: 'RLS Test Org A',
      org_slug: `rls-test-a-${Date.now()}`,
    })
    const { data: orgBId_, error: orgBErr } = await clientB.rpc('create_organization_and_join', {
      org_name: 'RLS Test Org B',
      org_slug: `rls-test-b-${Date.now()}`,
    })
    if (!orgAId_ || !orgBId_) throw new Error(`Failed to create test organizations: ${orgAErr?.message ?? ''} ${orgBErr?.message ?? ''}`)
    orgAId = orgAId_

    const { data: task, error: taskErr } = await clientA.from('tasks').insert({ organization_id: orgAId, title: 'Org A private task' }).select('id').single()
    if (!task) throw new Error(`Failed to create test task as user A: ${taskErr?.message ?? ''}`)
    taskId = task.id
  }, 30_000)

  afterAll(async () => {
    if (userAId) await admin.auth.admin.deleteUser(userAId).catch(() => undefined)
    if (userBId) await admin.auth.admin.deleteUser(userBId).catch(() => undefined)
  })

  it("user A can see their own organization's task", async () => {
    const { data } = await clientA.from('tasks').select('id').eq('id', taskId)
    expect(data).toHaveLength(1)
  })

  it("user B (a different organization) cannot see user A's task", async () => {
    const { data } = await clientB.from('tasks').select('id').eq('id', taskId)
    expect(data).toHaveLength(0)
  })

  it("user B cannot update user A's task", async () => {
    const { data } = await clientB.from('tasks').update({ title: 'hacked' }).eq('id', taskId).select('id')
    expect(data).toHaveLength(0)

    const { data: stillOriginal } = await clientA.from('tasks').select('title').eq('id', taskId).single()
    expect(stillOriginal?.title).toBe('Org A private task')
  })

  it("user B cannot delete user A's task", async () => {
    const { data } = await clientB.from('tasks').delete().eq('id', taskId).select('id')
    expect(data).toHaveLength(0)

    const { data: stillExists } = await clientA.from('tasks').select('id').eq('id', taskId)
    expect(stillExists).toHaveLength(1)
  })

  it("user B cannot see user A's organization row", async () => {
    const { data } = await clientB.from('organizations').select('id').eq('id', orgAId)
    expect(data).toHaveLength(0)
  })
})

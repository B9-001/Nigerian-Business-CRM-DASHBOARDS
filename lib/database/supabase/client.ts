'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

/**
 * Browser-side Supabase client. Uses the public anon key only — RLS is the
 * only thing standing between this client and other tenants' data, so every
 * table it can reach MUST have tenant-isolation policies (see supabase/migrations).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

/**
 * Server-side Supabase client (Server Components, Server Actions, Route
 * Handlers). Runs as the authenticated user via their session cookie — RLS
 * applies exactly as it does in the browser. This is the client almost all
 * app code should use.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Called from a Server Component that can't set cookies — the
            // middleware refresh path handles session persistence instead.
          }
        },
      },
    }
  )
}

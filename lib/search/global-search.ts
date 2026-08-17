import 'server-only'
import { createClient } from '@/lib/database/supabase/server'
import { requireUser } from '@/lib/auth/session'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'

export interface SearchResult {
  resource_type: string
  resource_id: string
  title: string
  subtitle: string
  rank: number
}

/**
 * Global search — thin wrapper around the `global_search` Postgres RPC
 * (Postgres full-text search today; the call shape is stable so a dedicated
 * search service could replace the RPC internals later without touching
 * callers — CLAUDE.md #31).
 */
export async function globalSearch(query: string, limit = 20): Promise<SearchResult[]> {
  const { user } = await requireUser()

  const { allowed } = await checkRateLimit(`search:${user.id}`, RATE_LIMITS.SEARCH.limit, RATE_LIMITS.SEARCH.windowMs)
  if (!allowed) throw new Error('Rate limit exceeded')

  if (!query.trim()) return []

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('global_search', { search_query: query, result_limit: limit })
  if (error) {
    console.error('[search] global_search RPC failed', error)
    return []
  }
  return (data ?? []) as SearchResult[]
}

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/database/supabase/server'

/**
 * Handles Supabase auth redirects (email confirmation, magic link, OAuth).
 * Exchanges the `code` for a session, then routes the user into onboarding
 * or the dashboard depending on whether they belong to an organization yet.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}

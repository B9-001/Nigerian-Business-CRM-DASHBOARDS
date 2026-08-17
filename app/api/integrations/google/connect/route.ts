import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { PERMISSIONS } from '@/lib/permissions/catalog'

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/meetings.space.created',
  'https://www.googleapis.com/auth/meetings.space.readonly',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ')

/**
 * Starts the Google OAuth flow. `state` carries the organization id (base64
 * JSON) so the callback can attach tokens to the right tenant regardless of
 * which browser session completes the consent screen.
 */
export async function GET() {
  const { profile } = await requirePermission(PERMISSIONS.INTEGRATIONS_MANAGE)

  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'Google integration is not configured on this server.' }, { status: 501 })
  }

  const state = Buffer.from(JSON.stringify({ organizationId: profile.organization_id })).toString('base64url')

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('scope', GOOGLE_SCOPES)
  url.searchParams.set('state', state)

  return NextResponse.redirect(url.toString())
}

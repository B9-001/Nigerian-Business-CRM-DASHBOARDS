import { NextResponse, type NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { saveIntegrationTokens } from '@/lib/meetings/credentials'
import { logAuditEvent } from '@/lib/security/audit'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const settingsUrl = `${origin}/settings/integrations`

  if (!code || !state) {
    return NextResponse.redirect(`${settingsUrl}?zoom=error`)
  }

  let organizationId: string
  try {
    organizationId = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')).organizationId
  } catch {
    return NextResponse.redirect(`${settingsUrl}?zoom=error`)
  }

  const { user, profile } = await requireUser()
  if (!profile?.organization_id || profile.organization_id !== organizationId) {
    return NextResponse.redirect(`${settingsUrl}?zoom=error`)
  }

  const clientId = process.env.ZOOM_CLIENT_ID
  const clientSecret = process.env.ZOOM_CLIENT_SECRET
  const redirectUri = process.env.ZOOM_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(`${settingsUrl}?zoom=not_configured`)
  }

  try {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const tokenRes = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    })

    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`)
    const tokens = await tokenRes.json()

    await saveIntegrationTokens(organizationId, 'ZOOM', user.id, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
    })

    await logAuditEvent({
      organizationId,
      actorId: user.id,
      action: 'integration.connected',
      resourceType: 'integration',
      metadata: { provider: 'ZOOM' },
    })

    return NextResponse.redirect(`${settingsUrl}?zoom=connected`)
  } catch (err) {
    console.error('[integrations/zoom] callback failed', err)
    return NextResponse.redirect(`${settingsUrl}?zoom=error`)
  }
}

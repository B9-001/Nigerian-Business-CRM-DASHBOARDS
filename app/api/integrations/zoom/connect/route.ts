import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { PERMISSIONS } from '@/lib/permissions/catalog'

export async function GET() {
  const { profile } = await requirePermission(PERMISSIONS.INTEGRATIONS_MANAGE)

  const clientId = process.env.ZOOM_CLIENT_ID
  const redirectUri = process.env.ZOOM_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'Zoom integration is not configured on this server.' }, { status: 501 })
  }

  const state = Buffer.from(JSON.stringify({ organizationId: profile.organization_id })).toString('base64url')

  const url = new URL('https://zoom.us/oauth/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)

  return NextResponse.redirect(url.toString())
}

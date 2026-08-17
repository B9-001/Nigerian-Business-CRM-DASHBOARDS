import 'server-only'
import type { CreateMeetingInput, MeetingProvider, ProviderMeeting } from '../types'
import { IntegrationNotConnectedError } from '../types'
import { getIntegrationTokens, saveIntegrationTokens } from '../credentials'

/**
 * Google Meet REST API (v2 Spaces). Requires GOOGLE_CLIENT_ID/SECRET and an
 * organization to have connected Google via /api/integrations/google/connect.
 * Not live-tested in this environment (no configured Google Cloud project) —
 * the request/response shapes follow Google's documented v2 Meet API.
 */
export class GoogleMeetProvider implements MeetingProvider {
  readonly name = 'GOOGLE_MEET' as const

  private async getAccessToken(organizationId: string): Promise<string> {
    const tokens = await getIntegrationTokens(organizationId, 'GOOGLE')
    if (!tokens) throw new IntegrationNotConnectedError('Google')

    if (tokens.expires_at && tokens.expires_at < Date.now() + 60_000 && tokens.refresh_token) {
      const refreshed = await this.refreshAccessToken(tokens.refresh_token)
      await saveIntegrationTokens(organizationId, 'GOOGLE', 'system', {
        ...tokens,
        access_token: refreshed.access_token,
        expires_at: Date.now() + refreshed.expires_in * 1000,
      })
      return refreshed.access_token
    }

    return tokens.access_token
  }

  private async refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    if (!res.ok) throw new Error(`Failed to refresh Google token: ${res.status}`)
    return res.json()
  }

  async createMeeting(input: CreateMeetingInput): Promise<ProviderMeeting> {
    const accessToken = await this.getAccessToken(input.organizationId)

    const res = await fetch('https://meet.googleapis.com/v2/spaces', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    if (!res.ok) throw new Error(`Google Meet space creation failed: ${res.status} ${await res.text()}`)
    const space = await res.json()

    return {
      providerMeetingId: space.name, // e.g. "spaces/abc123"
      joinUrl: space.meetingUri,
      hostUrl: space.meetingUri,
    }
  }

  async getMeeting(organizationId: string, providerMeetingId: string): Promise<ProviderMeeting | null> {
    const accessToken = await this.getAccessToken(organizationId)
    const res = await fetch(`https://meet.googleapis.com/v2/${providerMeetingId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Google Meet lookup failed: ${res.status}`)
    const space = await res.json()
    return { providerMeetingId: space.name, joinUrl: space.meetingUri, hostUrl: space.meetingUri }
  }

  async cancelMeeting(organizationId: string, providerMeetingId: string): Promise<void> {
    const accessToken = await this.getAccessToken(organizationId)
    // Google Meet spaces don't have a hard "cancel" — ending the active
    // conference is the closest equivalent; a scheduled space simply stops
    // being referenced. Best-effort no-op if the endpoint isn't available.
    await fetch(`https://meet.googleapis.com/v2/${providerMeetingId}:endActiveConference`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => undefined)
  }

  async listParticipants(organizationId: string, providerMeetingId: string): Promise<{ name?: string; email?: string }[]> {
    const accessToken = await this.getAccessToken(organizationId)
    const res = await fetch(`https://meet.googleapis.com/v2/${providerMeetingId}/conferenceRecords`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.participants ?? []).map((p: { displayName?: string; email?: string }) => ({ name: p.displayName, email: p.email }))
  }
}

export const googleMeetProvider = new GoogleMeetProvider()

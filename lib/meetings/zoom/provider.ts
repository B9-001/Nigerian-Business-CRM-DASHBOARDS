import 'server-only'
import type { CreateMeetingInput, MeetingProvider, ProviderMeeting } from '../types'
import { IntegrationNotConnectedError } from '../types'
import { getIntegrationTokens, saveIntegrationTokens } from '../credentials'

/**
 * Zoom REST API v2. Requires ZOOM_CLIENT_ID/SECRET and an organization to
 * have connected Zoom via /api/integrations/zoom/connect. Not live-tested
 * in this environment (no configured Zoom app) — shapes follow Zoom's
 * documented Meetings API.
 */
export class ZoomProvider implements MeetingProvider {
  readonly name = 'ZOOM' as const

  private async getAccessToken(organizationId: string): Promise<string> {
    const tokens = await getIntegrationTokens(organizationId, 'ZOOM')
    if (!tokens) throw new IntegrationNotConnectedError('Zoom')

    if (tokens.expires_at && tokens.expires_at < Date.now() + 60_000 && tokens.refresh_token) {
      const refreshed = await this.refreshAccessToken(tokens.refresh_token)
      await saveIntegrationTokens(organizationId, 'ZOOM', 'system', {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        expires_at: Date.now() + refreshed.expires_in * 1000,
      })
      return refreshed.access_token
    }

    return tokens.access_token
  }

  private async refreshAccessToken(
    refreshToken: string
  ): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
    const basicAuth = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString('base64')
    const res = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    })
    if (!res.ok) throw new Error(`Failed to refresh Zoom token: ${res.status}`)
    return res.json()
  }

  async createMeeting(input: CreateMeetingInput): Promise<ProviderMeeting> {
    const accessToken = await this.getAccessToken(input.organizationId)

    const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: input.title,
        agenda: input.description ?? '',
        type: 2, // scheduled meeting
        start_time: input.startTime,
        duration: input.endTime
          ? Math.max(15, Math.round((new Date(input.endTime).getTime() - new Date(input.startTime).getTime()) / 60000))
          : 30,
        settings: { join_before_host: false, waiting_room: true },
      }),
    })

    if (!res.ok) throw new Error(`Zoom meeting creation failed: ${res.status} ${await res.text()}`)
    const meeting = await res.json()

    return { providerMeetingId: String(meeting.id), joinUrl: meeting.join_url, hostUrl: meeting.start_url }
  }

  async getMeeting(organizationId: string, providerMeetingId: string): Promise<ProviderMeeting | null> {
    const accessToken = await this.getAccessToken(organizationId)
    const res = await fetch(`https://api.zoom.us/v2/meetings/${providerMeetingId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Zoom meeting lookup failed: ${res.status}`)
    const meeting = await res.json()
    return { providerMeetingId: String(meeting.id), joinUrl: meeting.join_url, hostUrl: meeting.start_url }
  }

  async cancelMeeting(organizationId: string, providerMeetingId: string): Promise<void> {
    const accessToken = await this.getAccessToken(organizationId)
    await fetch(`https://api.zoom.us/v2/meetings/${providerMeetingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  }

  async listParticipants(organizationId: string, providerMeetingId: string): Promise<{ name?: string; email?: string }[]> {
    const accessToken = await this.getAccessToken(organizationId)
    const res = await fetch(`https://api.zoom.us/v2/past_meetings/${providerMeetingId}/participants`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.participants ?? []).map((p: { name?: string; user_email?: string }) => ({ name: p.name, email: p.user_email }))
  }
}

export const zoomProvider = new ZoomProvider()

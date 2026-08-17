/**
 * Shared interface every meeting provider (Google Meet, Zoom) implements.
 * Keeping the app's meeting logic against this interface — rather than
 * calling Google/Zoom SDKs directly from routes — is what lets us add more
 * providers later without touching call sites (CLAUDE.md #12-13, #22).
 */
export interface CreateMeetingInput {
  organizationId: string
  title: string
  description?: string
  startTime: string
  endTime?: string
  attendeeEmails?: string[]
}

export interface ProviderMeeting {
  providerMeetingId: string
  joinUrl: string
  hostUrl?: string
}

export interface MeetingProvider {
  readonly name: 'GOOGLE_MEET' | 'ZOOM'
  createMeeting(input: CreateMeetingInput): Promise<ProviderMeeting>
  getMeeting(organizationId: string, providerMeetingId: string): Promise<ProviderMeeting | null>
  cancelMeeting(organizationId: string, providerMeetingId: string): Promise<void>
  listParticipants(organizationId: string, providerMeetingId: string): Promise<{ name?: string; email?: string }[]>
}

export class IntegrationNotConnectedError extends Error {
  constructor(provider: string) {
    super(`${provider} is not connected for this organization. Connect it in Settings → Integrations.`)
    this.name = 'IntegrationNotConnectedError'
  }
}

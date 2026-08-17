import 'server-only'
import type { MeetingProvider } from './types'
import { googleMeetProvider } from './google/provider'
import { zoomProvider } from './zoom/provider'

export * from './types'

export function getMeetingProvider(provider: 'GOOGLE_MEET' | 'ZOOM'): MeetingProvider {
  return provider === 'GOOGLE_MEET' ? googleMeetProvider : zoomProvider
}

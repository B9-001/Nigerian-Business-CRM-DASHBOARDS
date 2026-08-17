'use client'

import { useTransition } from 'react'
import { cancelMeetingAction } from '../actions'
import { Button } from '@/components/ui/button'

export function CancelMeetingButton({ meetingId }: { meetingId: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (confirm('Cancel this meeting?')) startTransition(() => cancelMeetingAction(meetingId))
      }}
    >
      {pending ? 'Cancelling…' : 'Cancel Meeting'}
    </Button>
  )
}

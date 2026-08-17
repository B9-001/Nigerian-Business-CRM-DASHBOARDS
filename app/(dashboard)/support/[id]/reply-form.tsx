'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { addTicketMessageAction, type CrmActionState } from '../../crm/actions'
import { Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const initialState: CrmActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Sending…' : 'Send'}
    </Button>
  )
}

export function ReplyForm({ ticketId, canManage }: { ticketId: string; canManage: boolean }) {
  const [, formAction] = useFormState(addTicketMessageAction, initialState)

  return (
    <form action={formAction} className="mt-4 space-y-2 border-t border-border pt-4">
      <input type="hidden" name="ticketId" value={ticketId} />
      <Textarea name="body" rows={3} placeholder="Write a reply…" required />
      <div className="flex items-center justify-between">
        {canManage ? (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" name="isInternalNote" className="rounded border-border" /> Internal note (not visible to customer)
          </label>
        ) : (
          <span />
        )}
        <SubmitButton />
      </div>
    </form>
  )
}

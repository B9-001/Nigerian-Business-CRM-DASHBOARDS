'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { addCustomerActivityAction, type CrmActionState } from '../../actions'
import { Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const initialState: CrmActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Saving…' : 'Add Note'}
    </Button>
  )
}

export function NoteForm({ customerId }: { customerId: string }) {
  const [, formAction] = useFormState(addCustomerActivityAction, initialState)

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="customerId" value={customerId} />
      <Textarea name="body" rows={2} placeholder="Add a note…" required />
      <SubmitButton />
    </form>
  )
}

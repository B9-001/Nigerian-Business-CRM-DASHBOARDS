'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { createChannelAction, type ChatActionState } from './actions'
import { Field, Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const initialState: ChatActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" className="w-full" disabled={pending}>
      {pending ? 'Creating…' : 'Create Channel'}
    </Button>
  )
}

export function ChannelForm() {
  const [state, formAction] = useFormState(createChannelAction, initialState)

  return (
    <form action={formAction} className="space-y-2 border-t border-border p-3">
      <Field label="New channel" htmlFor="name">
        <Input id="name" name="name" placeholder="#channel-name" required />
      </Field>
      <input type="hidden" name="type" value="GROUP" />
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
      <SubmitButton />
    </form>
  )
}

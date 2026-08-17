'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { createLeadAction, type CrmActionState } from '../actions'
import { Field, Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const initialState: CrmActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Adding…' : 'Add Lead'}
    </Button>
  )
}

export function LeadForm() {
  const [state, formAction] = useFormState(createLeadAction, initialState)

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required />
      </Field>
      <Field label="Company" htmlFor="company">
        <Input id="company" name="company" />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" />
      </Field>
      <Field label="Source" htmlFor="source">
        <Input id="source" name="source" placeholder="e.g. Website" />
      </Field>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <SubmitButton />
    </form>
  )
}

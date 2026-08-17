'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { createTicketAction, type CrmActionState } from '../crm/actions'
import { Field, Input, Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const initialState: CrmActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Creating…' : 'Create Ticket'}
    </Button>
  )
}

export function TicketForm({ customers }: { customers: { id: string; name: string }[] }) {
  const [state, formAction] = useFormState(createTicketAction, initialState)

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Subject" htmlFor="subject">
        <Input id="subject" name="subject" required />
      </Field>
      <Field label="Description" htmlFor="description">
        <Textarea id="description" name="description" rows={3} />
      </Field>
      <Field label="Customer" htmlFor="customerId">
        <select
          id="customerId"
          name="customerId"
          className="h-11 w-full rounded-control border border-border bg-surface px-3.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">None</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Priority" htmlFor="priority">
        <select
          id="priority"
          name="priority"
          defaultValue="MEDIUM"
          className="h-11 w-full rounded-control border border-border bg-surface px-3.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
      </Field>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <SubmitButton />
    </form>
  )
}

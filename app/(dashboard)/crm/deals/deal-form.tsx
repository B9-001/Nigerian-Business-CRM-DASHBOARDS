'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { createDealAction, type CrmActionState } from '../actions'
import { Field, Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const initialState: CrmActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Adding…' : 'Add Deal'}
    </Button>
  )
}

export function DealForm({ customers, leads }: { customers: { id: string; name: string }[]; leads: { id: string; name: string }[] }) {
  const [state, formAction] = useFormState(createDealAction, initialState)

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Title" htmlFor="title">
        <Input id="title" name="title" required />
      </Field>
      <Field label="Value (NGN)" htmlFor="valueNgn">
        <Input id="valueNgn" name="valueNgn" type="number" min="0" step="1000" />
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
      <Field label="Lead" htmlFor="leadId">
        <select
          id="leadId"
          name="leadId"
          className="h-11 w-full rounded-control border border-border bg-surface px-3.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">None</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Expected close date" htmlFor="expectedCloseDate">
        <Input id="expectedCloseDate" name="expectedCloseDate" type="date" />
      </Field>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <SubmitButton />
    </form>
  )
}

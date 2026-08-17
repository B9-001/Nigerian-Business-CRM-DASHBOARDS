'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { createTeamAction, type EmployeeActionState } from '../employees/actions'
import { Field, Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const initialState: EmployeeActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Creating…' : 'Create Team'}
    </Button>
  )
}

export function TeamForm({ departments }: { departments: { id: string; name: string }[] }) {
  const [state, formAction] = useFormState(createTeamAction, initialState)

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required placeholder="e.g. Growth Squad" />
      </Field>
      <Field label="Department" htmlFor="departmentId">
        <select
          id="departmentId"
          name="departmentId"
          className="h-11 w-full rounded-control border border-border bg-surface px-3.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">None</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </Field>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <SubmitButton />
    </form>
  )
}

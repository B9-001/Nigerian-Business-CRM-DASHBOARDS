'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { createDepartmentAction, type EmployeeActionState } from '../employees/actions'
import { Field, Input, Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const initialState: EmployeeActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Creating…' : 'Create Department'}
    </Button>
  )
}

export function DepartmentForm() {
  const [state, formAction] = useFormState(createDepartmentAction, initialState)

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required placeholder="e.g. Marketing" />
      </Field>
      <Field label="Description" htmlFor="description">
        <Textarea id="description" name="description" rows={2} />
      </Field>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <SubmitButton />
    </form>
  )
}

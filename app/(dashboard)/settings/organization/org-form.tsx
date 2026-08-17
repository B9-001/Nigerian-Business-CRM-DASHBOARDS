'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { updateOrganizationAction, type SettingsActionState } from '../actions'
import { Field, Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const initialState: SettingsActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save changes'}
    </Button>
  )
}

export function OrgForm({ organization }: { organization: { name: string; currency: string; timezone: string } }) {
  const [state, formAction] = useFormState(updateOrganizationAction, initialState)

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <Field label="Organization name" htmlFor="name">
        <Input id="name" name="name" required defaultValue={organization.name} />
      </Field>
      <Field label="Currency" htmlFor="currency">
        <Input id="currency" name="currency" defaultValue={organization.currency} />
      </Field>
      <Field label="Timezone" htmlFor="timezone">
        <Input id="timezone" name="timezone" defaultValue={organization.timezone} />
      </Field>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.success && <p className="text-sm text-success">Saved.</p>}
      <SubmitButton />
    </form>
  )
}

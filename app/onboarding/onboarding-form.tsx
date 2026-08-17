'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { createOrganizationAction, type OnboardingState } from './actions'
import { Field, Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const initialState: OnboardingState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Creating workspace…' : 'Create workspace'}
    </Button>
  )
}

export function OnboardingForm() {
  const [state, formAction] = useFormState(createOrganizationAction, initialState)

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <Field label="Organization name" htmlFor="organizationName">
        <Input id="organizationName" name="organizationName" required placeholder="e.g. Zenith Traders Ltd" />
      </Field>

      {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}

      <SubmitButton />
    </form>
  )
}

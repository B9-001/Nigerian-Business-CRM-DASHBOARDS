'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { signUpAction, type AuthActionState } from '../actions'
import { Field, Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const initialState: AuthActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Creating account…' : 'Create account'}
    </Button>
  )
}

export function SignupForm() {
  const [state, formAction] = useFormState(signUpAction, initialState)

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <Field label="Full name" htmlFor="fullName">
        <Input id="fullName" name="fullName" type="text" required autoComplete="name" placeholder="Amina Yusuf" />
      </Field>
      <Field label="Email address" htmlFor="email">
        <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@company.com" />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 8 characters.">
        <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="••••••••" />
      </Field>

      {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}

      <SubmitButton />
    </form>
  )
}

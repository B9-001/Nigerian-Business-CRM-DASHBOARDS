'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { signInAction, type AuthActionState } from '../actions'
import { Field } from '@/components/ui/input'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const initialState: AuthActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Signing in…' : 'Sign in'}
    </Button>
  )
}

export function LoginForm() {
  const [state, formAction] = useFormState(signInAction, initialState)

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <Field label="Email address" htmlFor="email">
        <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@company.com" />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" required autoComplete="current-password" placeholder="••••••••" />
      </Field>

      {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}

      <SubmitButton />
    </form>
  )
}

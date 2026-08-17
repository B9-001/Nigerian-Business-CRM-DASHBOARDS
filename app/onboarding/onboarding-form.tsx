'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { createOrganizationAction, type OnboardingState } from './actions'
import { Field, Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'

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
  const [preview, setPreview] = useState<string | null>(null)
  const [name, setName] = useState('')

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Organization logo (optional)</label>
        <div className="flex items-center gap-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Logo preview" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <Avatar name={name || '?'} size={48} />
          )}
          <input
            id="logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) setPreview(URL.createObjectURL(file))
            }}
            className="block text-xs text-muted-foreground file:mr-3 file:rounded-control file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-foreground hover:file:bg-surface-muted"
          />
        </div>
      </div>

      <Field label="Organization name" htmlFor="organizationName">
        <Input
          id="organizationName"
          name="organizationName"
          required
          placeholder="e.g. Zenith Traders Ltd"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}

      <SubmitButton />
    </form>
  )
}

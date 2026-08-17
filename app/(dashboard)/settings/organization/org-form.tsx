'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { updateOrganizationAction, type SettingsActionState } from '../actions'
import { Field, Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'

const initialState: SettingsActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save changes'}
    </Button>
  )
}

export function OrgForm({ organization }: { organization: { name: string; currency: string; timezone: string; logo_url: string | null } }) {
  const [state, formAction] = useFormState(updateOrganizationAction, initialState)
  const [preview, setPreview] = useState<string | null>(organization.logo_url)

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Organization logo</label>
        <div className="flex items-center gap-4">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Organization logo" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <Avatar name={organization.name} size={64} />
          )}
          <div>
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
            <p className="mt-1 text-xs text-subtle">PNG, JPEG, WebP or SVG. Square images look best.</p>
          </div>
        </div>
      </div>

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

'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { updatePlanAction, togglePlanFeatureAction, type PlanActionState } from './actions'
import { Field, Input, Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const initialState: PlanActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Saving…' : 'Save changes'}
    </Button>
  )
}

interface Plan {
  id: string
  name: string
  description: string | null
  price_ngn_month: number | null
  annual_price_ngn: number | null
  max_users: number | null
  max_projects: number | null
  max_storage_gb: number | null
  max_ai_requests_month: number | null
  is_active: boolean
  is_public: boolean
}

export function PlanForm({ plan, features }: { plan: Plan; features: { feature_key: string; enabled: boolean }[] }) {
  const [state, formAction] = useFormState(updatePlanAction, initialState)

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="planId" value={plan.id} />
      <Field label="Name" htmlFor={`name-${plan.id}`}>
        <Input id={`name-${plan.id}`} name="name" defaultValue={plan.name} required />
      </Field>
      <Field label="Description" htmlFor={`description-${plan.id}`}>
        <Textarea id={`description-${plan.id}`} name="description" defaultValue={plan.description ?? ''} rows={2} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Monthly price (₦)" htmlFor={`priceNgnMonth-${plan.id}`}>
          <Input id={`priceNgnMonth-${plan.id}`} name="priceNgnMonth" type="number" defaultValue={plan.price_ngn_month ?? ''} placeholder="Blank = contact sales" />
        </Field>
        <Field label="Annual price (₦)" htmlFor={`annualPriceNgn-${plan.id}`}>
          <Input id={`annualPriceNgn-${plan.id}`} name="annualPriceNgn" type="number" defaultValue={plan.annual_price_ngn ?? ''} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Max users" htmlFor={`maxUsers-${plan.id}`}>
          <Input id={`maxUsers-${plan.id}`} name="maxUsers" type="number" defaultValue={plan.max_users ?? ''} placeholder="Blank = unlimited" />
        </Field>
        <Field label="Max projects" htmlFor={`maxProjects-${plan.id}`}>
          <Input id={`maxProjects-${plan.id}`} name="maxProjects" type="number" defaultValue={plan.max_projects ?? ''} placeholder="Blank = unlimited" />
        </Field>
        <Field label="Max storage (GB)" htmlFor={`maxStorageGb-${plan.id}`}>
          <Input id={`maxStorageGb-${plan.id}`} name="maxStorageGb" type="number" defaultValue={plan.max_storage_gb ?? ''} placeholder="Blank = unlimited" />
        </Field>
        <Field label="Max AI requests/mo" htmlFor={`maxAiRequestsMonth-${plan.id}`}>
          <Input id={`maxAiRequestsMonth-${plan.id}`} name="maxAiRequestsMonth" type="number" defaultValue={plan.max_ai_requests_month ?? ''} placeholder="Blank = unlimited" />
        </Field>
      </div>

      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="isActive" defaultChecked={plan.is_active} /> Active
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="isPublic" defaultChecked={plan.is_public} /> Public (shown to organizations)
        </label>
      </div>

      <div className="border-t border-border pt-3">
        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Feature access</p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {features.map((f) => (
            <label key={f.feature_key} className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                defaultChecked={f.enabled}
                onChange={(e) => togglePlanFeatureAction(plan.id, f.feature_key, e.target.checked)}
              />
              {f.feature_key.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
      </div>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <SubmitButton />
    </form>
  )
}

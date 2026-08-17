'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { createMeetingAction, type MeetingActionState } from './actions'
import { Field, Input, Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const initialState: MeetingActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Scheduling…' : 'Schedule Meeting'}
    </Button>
  )
}

export function MeetingForm({
  employees,
  projects,
  customers,
}: {
  employees: { id: string; first_name: string; last_name: string }[]
  projects: { id: string; name: string }[]
  customers: { id: string; name: string }[]
}) {
  const [state, formAction] = useFormState(createMeetingAction, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Title" htmlFor="title">
        <Input id="title" name="title" required placeholder="e.g. Marketing Strategy" />
      </Field>
      <Field label="Description" htmlFor="description">
        <Textarea id="description" name="description" rows={2} />
      </Field>
      <Field label="Agenda" htmlFor="agenda">
        <Textarea id="agenda" name="agenda" rows={2} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Start time" htmlFor="startTime">
          <Input id="startTime" name="startTime" type="datetime-local" required />
        </Field>
        <Field label="End time" htmlFor="endTime">
          <Input id="endTime" name="endTime" type="datetime-local" />
        </Field>
      </div>

      <Field label="Provider" htmlFor="provider">
        <select
          id="provider"
          name="provider"
          defaultValue="OTHER"
          className="h-11 w-full rounded-control border border-border bg-surface px-3.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="GOOGLE_MEET">Google Meet</option>
          <option value="ZOOM">Zoom</option>
          <option value="OTHER">Other / manual link</option>
        </select>
      </Field>

      <Field
        label="Already have a meeting link?"
        htmlFor="manualJoinUrl"
        hint="Paste an existing Zoom or Google Meet link and we'll use it as-is — no need to connect an integration. Leave blank to auto-generate one via Google Meet/Zoom above (requires that integration to be connected in Settings → Integrations)."
      >
        <Input id="manualJoinUrl" name="manualJoinUrl" type="url" placeholder="https://meet.google.com/abc-defg-hij or https://zoom.us/j/…" />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Project" htmlFor="projectId">
          <select
            id="projectId"
            name="projectId"
            className="h-11 w-full rounded-control border border-border bg-surface px-3.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
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
      </div>

      <Field label="Attendees" htmlFor="attendeeIds">
        <select
          id="attendeeIds"
          name="attendeeIds"
          multiple
          size={Math.min(6, Math.max(3, employees.length))}
          className="w-full rounded-control border border-border bg-surface px-3.5 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.first_name} {e.last_name}
            </option>
          ))}
        </select>
      </Field>

      {state.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  )
}

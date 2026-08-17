'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { createProjectAction, type ProjectActionState } from './actions'
import { Field, Input, Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const initialState: ProjectActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create Project'}
    </Button>
  )
}

export function ProjectForm({ departments }: { departments: { id: string; name: string }[] }) {
  const [state, formAction] = useFormState(createProjectAction, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Project name" htmlFor="name">
        <Input id="name" name="name" required placeholder="e.g. Website Redesign" />
      </Field>
      <Field label="Description" htmlFor="description">
        <Textarea id="description" name="description" rows={3} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <Field label="Priority" htmlFor="priority">
          <select
            id="priority"
            name="priority"
            defaultValue="MEDIUM"
            className="h-11 w-full rounded-control border border-border bg-surface px-3.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Start date" htmlFor="startDate">
          <Input id="startDate" name="startDate" type="date" />
        </Field>
        <Field label="Deadline" htmlFor="deadline">
          <Input id="deadline" name="deadline" type="date" />
        </Field>
      </div>

      {state.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  )
}

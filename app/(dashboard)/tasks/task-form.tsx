'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { createTaskAction, type TaskActionState } from './actions'
import { Field, Input, Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Option {
  id: string
  name?: string
  full_name?: string | null
  email?: string
}

const initialState: TaskActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create Task'}
    </Button>
  )
}

export function TaskForm({
  projects,
  departments,
  members,
  defaultProjectId,
  parentTaskId,
}: {
  projects: Option[]
  departments: Option[]
  members: Option[]
  defaultProjectId?: string
  parentTaskId?: string
}) {
  const [state, formAction] = useFormState(createTaskAction, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="redirectToDetail" value="1" />
      {parentTaskId && <input type="hidden" name="parentTaskId" value={parentTaskId} />}

      <Field label="Title" htmlFor="title">
        <Input id="title" name="title" required placeholder="e.g. Finalize Q3 marketing plan" />
      </Field>
      <Field label="Description" htmlFor="description">
        <Textarea id="description" name="description" rows={3} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Project" htmlFor="projectId">
          <select
            id="projectId"
            name="projectId"
            defaultValue={defaultProjectId ?? ''}
            className="h-11 w-full rounded-control border border-border bg-surface px-3.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Department" htmlFor="departmentId">
          <select
            id="departmentId"
            name="departmentId"
            className="h-11 w-full rounded-control border border-border bg-surface px-3.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">No department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Assignee" htmlFor="assignedTo">
          <select
            id="assignedTo"
            name="assignedTo"
            className="h-11 w-full rounded-control border border-border bg-surface px-3.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name ?? m.email}
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
        <Field label="Due date" htmlFor="dueDate">
          <Input id="dueDate" name="dueDate" type="date" />
        </Field>
        <Field label="Estimated hours" htmlFor="estimatedHours">
          <Input id="estimatedHours" name="estimatedHours" type="number" step="0.5" min="0" />
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

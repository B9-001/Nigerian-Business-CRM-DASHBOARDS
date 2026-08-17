'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { createEmployeeAction, updateEmployeeAction, type EmployeeActionState } from './actions'
import { Field, Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Option {
  id: string
  name?: string
  first_name?: string
  last_name?: string
}

interface EmployeeFormProps {
  departments: Option[]
  teams: Option[]
  employees: Option[]
  initial?: {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string | null
    department_id: string | null
    team_id: string | null
    job_title: string | null
    manager_id: string | null
    join_date: string | null
    employment_status: string
  }
}

const initialState: EmployeeActionState = {}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : label}
    </Button>
  )
}

export function EmployeeForm({ departments, teams, employees, initial }: EmployeeFormProps) {
  const action = initial ? updateEmployeeAction : createEmployeeAction
  const [state, formAction] = useFormState(action, initialState)

  return (
    <form action={formAction} className="space-y-4">
      {initial && <input type="hidden" name="employeeId" value={initial.id} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName">
          <Input id="firstName" name="firstName" required defaultValue={initial?.first_name} />
        </Field>
        <Field label="Last name" htmlFor="lastName">
          <Input id="lastName" name="lastName" required defaultValue={initial?.last_name} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" required defaultValue={initial?.email} />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" placeholder="+234…" defaultValue={initial?.phone ?? ''} />
        </Field>
      </div>

      <Field label="Job title" htmlFor="jobTitle">
        <Input id="jobTitle" name="jobTitle" placeholder="e.g. Operations Manager" defaultValue={initial?.job_title ?? ''} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Department" htmlFor="departmentId">
          <select
            id="departmentId"
            name="departmentId"
            defaultValue={initial?.department_id ?? ''}
            className="h-11 w-full rounded-control border border-border bg-surface px-3.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Unassigned</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Team" htmlFor="teamId">
          <select
            id="teamId"
            name="teamId"
            defaultValue={initial?.team_id ?? ''}
            className="h-11 w-full rounded-control border border-border bg-surface px-3.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Unassigned</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Manager" htmlFor="managerId">
          <select
            id="managerId"
            name="managerId"
            defaultValue={initial?.manager_id ?? ''}
            className="h-11 w-full rounded-control border border-border bg-surface px-3.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">None</option>
            {employees
              .filter((e) => e.id !== initial?.id)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.first_name} {e.last_name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Join date" htmlFor="joinDate">
          <Input id="joinDate" name="joinDate" type="date" defaultValue={initial?.join_date ?? ''} />
        </Field>
      </div>

      {initial && (
        <Field label="Employment status" htmlFor="employmentStatus">
          <select
            id="employmentStatus"
            name="employmentStatus"
            defaultValue={initial.employment_status}
            className="h-11 w-full rounded-control border border-border bg-surface px-3.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ACTIVE">Active</option>
            <option value="ON_LEAVE">On leave</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="TERMINATED">Terminated</option>
          </select>
        </Field>
      )}

      {state.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}

      <SubmitButton label={initial ? 'Save changes' : 'Add Employee'} />
    </form>
  )
}

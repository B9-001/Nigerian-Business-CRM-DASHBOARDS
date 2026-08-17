'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { addProjectMemberAction, type ProjectActionState } from '../actions'
import { Button } from '@/components/ui/button'

const initialState: ProjectActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Adding…' : 'Add'}
    </Button>
  )
}

export function AddMemberForm({
  projectId,
  candidates,
}: {
  projectId: string
  candidates: { id: string; full_name: string | null; email: string }[]
}) {
  const [state, formAction] = useFormState(addProjectMemberAction, initialState)

  if (candidates.length === 0) return null

  return (
    <form action={formAction} className="mt-3 flex items-center gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <select
        name="userId"
        required
        className="h-9 flex-1 rounded-control border border-border bg-surface px-2.5 text-sm focus:border-primary focus:outline-none"
      >
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.full_name ?? c.email}
          </option>
        ))}
      </select>
      <SubmitButton />
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  )
}

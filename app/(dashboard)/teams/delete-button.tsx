'use client'

import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteTeamAction } from '../employees/actions'

export function DeleteTeamButton({ teamId }: { teamId: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      className="shrink-0 rounded-control p-1.5 text-subtle hover:bg-danger/10 hover:text-danger disabled:opacity-50"
      disabled={pending}
      aria-label="Delete team"
      onClick={() => {
        if (confirm('Delete this team?')) {
          startTransition(() => deleteTeamAction(teamId))
        }
      }}
    >
      <Trash2 size={15} />
    </button>
  )
}

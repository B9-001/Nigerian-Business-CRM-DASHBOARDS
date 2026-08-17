'use client'

import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteDepartmentAction } from '../employees/actions'

export function DeleteDepartmentButton({ departmentId }: { departmentId: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      className="shrink-0 rounded-control p-1.5 text-subtle hover:bg-danger/10 hover:text-danger disabled:opacity-50"
      disabled={pending}
      aria-label="Delete department"
      onClick={() => {
        if (confirm('Delete this department? Employees will become unassigned.')) {
          startTransition(() => deleteDepartmentAction(departmentId))
        }
      }}
    >
      <Trash2 size={15} />
    </button>
  )
}

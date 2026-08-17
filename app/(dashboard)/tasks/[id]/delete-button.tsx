'use client'

import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteTaskAction } from '../actions'
import { Button } from '@/components/ui/button'

export function DeleteTaskButton({ taskId }: { taskId: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (confirm('Delete this task? This cannot be undone.')) {
          startTransition(() => deleteTaskAction(taskId))
        }
      }}
    >
      <Trash2 size={14} /> {pending ? 'Deleting…' : 'Delete'}
    </Button>
  )
}

'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { addCommentAction, type TaskActionState } from '../actions'
import { Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const initialState: TaskActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Posting…' : 'Post comment'}
    </Button>
  )
}

export function CommentForm({ taskId }: { taskId: string }) {
  const [, formAction] = useFormState(addCommentAction, initialState)

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="taskId" value={taskId} />
      <Textarea name="body" rows={2} placeholder="Write a comment…" required />
      <SubmitButton />
    </form>
  )
}

'use client'

import { useTransition } from 'react'
import { suspendEmployeeAction } from '../actions'
import { Button } from '@/components/ui/button'

export function SuspendButton({ employeeId }: { employeeId: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="destructive"
      size="sm"
      className="w-full"
      disabled={pending}
      onClick={() => {
        if (confirm('Suspend this employee? They will no longer be treated as active.')) {
          startTransition(() => suspendEmployeeAction(employeeId))
        }
      }}
    >
      {pending ? 'Suspending…' : 'Suspend Employee'}
    </Button>
  )
}

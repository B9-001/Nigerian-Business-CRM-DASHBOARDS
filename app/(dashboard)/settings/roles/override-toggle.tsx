'use client'

import { useTransition } from 'react'
import { setPermissionOverrideAction } from '../actions'

export function OverrideToggle({ userId, permissionKey, current }: { userId: string; permissionKey: string; current: 'granted' | 'revoked' | 'default' }) {
  const [pending, startTransition] = useTransition()

  function set(granted: boolean) {
    const fd = new FormData()
    fd.set('userId', userId)
    fd.set('permissionKey', permissionKey)
    fd.set('granted', String(granted))
    startTransition(() => {
      void setPermissionOverrideAction({}, fd)
    })
  }

  return (
    <div className="flex gap-1">
      <button
        disabled={pending}
        onClick={() => set(true)}
        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${current === 'granted' ? 'bg-success/15 text-success' : 'text-subtle hover:bg-surface-muted'}`}
      >
        Grant
      </button>
      <button
        disabled={pending}
        onClick={() => set(false)}
        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${current === 'revoked' ? 'bg-danger/15 text-danger' : 'text-subtle hover:bg-surface-muted'}`}
      >
        Revoke
      </button>
    </div>
  )
}

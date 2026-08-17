'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/database/supabase/client'
import { sendMessageAction } from './actions'
import { Avatar } from '@/components/ui/avatar'
import { formatDateTime } from '@/lib/utils'

interface Message {
  id: string
  body: string
  created_at: string
  author_id: string | null
  author_name: string
}

export function MessageList({ channelId, initialMessages, currentUserId }: { channelId: string; initialMessages: Message[]; currentUserId: string }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages(initialMessages)
  }, [channelId, initialMessages])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`room:${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const row = payload.new as { id: string; body: string; created_at: string; author_id: string | null }
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, { ...row, author_name: 'Someone' }]))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [channelId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex h-[calc(100vh-220px)] flex-col">
      <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((m) => (
          <div key={m.id} className="flex gap-2.5">
            <Avatar name={m.author_name} size={28} />
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-foreground">{m.author_id === currentUserId ? 'You' : m.author_name}</span>
                <span className="text-xs text-subtle">{formatDateTime(m.created_at)}</span>
              </div>
              <p className="text-sm text-muted-foreground">{m.body}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        action={async (formData) => {
          await sendMessageAction(formData)
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <input type="hidden" name="channelId" value={channelId} />
        <input
          name="body"
          placeholder="Message…"
          required
          autoComplete="off"
          className="h-11 flex-1 rounded-control border border-border bg-surface px-3.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button type="submit" className="h-11 rounded-control bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover">
          Send
        </button>
      </form>
    </div>
  )
}

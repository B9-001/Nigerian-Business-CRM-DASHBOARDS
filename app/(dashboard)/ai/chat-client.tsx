'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'What tasks are overdue?',
  'Who is on the team?',
  'What meetings do I have coming up?',
  'Show me our open support tickets',
]

export function AIChatClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text: string) {
    if (!text.trim() || loading) return
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.error ?? 'Something went wrong.' }])
      } else {
        setConversationId(data.conversationId)
        setMessages((prev) => [...prev, { role: 'assistant', content: data.message }])
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Network error — please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col rounded-card border border-border bg-surface">
      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Sparkles size={22} />
          </div>
          <p className="text-sm text-muted-foreground">Ask anything about your business — tasks, projects, customers, meetings.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-surface-muted"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-5">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-control px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === 'user' ? 'bg-primary text-white' : 'bg-surface-muted text-foreground'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && <div className="text-xs text-subtle">AI is thinking…</div>}
          <div ref={bottomRef} />
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about your business…"
          className="h-11 flex-1 rounded-control border border-border bg-surface px-3.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Button type="submit" size="icon" disabled={loading}>
          <Send size={16} />
        </Button>
      </form>
    </div>
  )
}

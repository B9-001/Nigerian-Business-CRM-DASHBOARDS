'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'

/**
 * Compact AI-entry-point widget for the dashboard (reference image's "AI
 * Assistant" card — glossy orb + inline "Ask me anything" input). Submitting
 * hands the question off to the full AI workspace at /ai rather than trying
 * to hold a whole chat thread in a small dashboard tile.
 */
export function AIAssistantWidget() {
  const [value, setValue] = useState('')
  const router = useRouter()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const q = value.trim()
    router.push(q ? `/ai?q=${encodeURIComponent(q)}` : '/ai')
  }

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <div
          className="h-8 w-8 shrink-0 rounded-full"
          style={{
            background: 'radial-gradient(circle at 30% 30%, #4ADE80, var(--primary) 55%, var(--primary-dark) 100%)',
            boxShadow: '0 0 16px rgba(8, 116, 67, 0.45)',
          }}
          aria-hidden
        />
        <p className="text-sm font-semibold text-foreground">AI Assistant</p>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">Ask about tasks, projects, customers, meetings — grounded in your real data.</p>

      <form onSubmit={submit} className="mt-4 flex items-center gap-2 rounded-control border border-border bg-surface-muted px-2 py-1.5">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask me anything…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-subtle"
        />
        <button
          type="submit"
          aria-label="Ask AI Assistant"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white hover:bg-primary-hover"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  )
}

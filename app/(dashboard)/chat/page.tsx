import Link from 'next/link'
import { Hash } from 'lucide-react'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { MessageList } from './message-list'
import { ChannelForm } from './channel-form'

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ channel?: string }> }) {
  const { channel: channelParam } = await searchParams
  const { user, profile } = await requirePermission(PERMISSIONS.CHAT_USE)
  const supabase = await createClient()

  const { data: channels } = await supabase
    .from('channels')
    .select('id, name, type')
    .eq('organization_id', profile.organization_id)
    .order('created_at')

  const activeChannelId = channelParam ?? channels?.[0]?.id

  let messages: { id: string; body: string; created_at: string; author_id: string | null; author_name: string }[] = []
  if (activeChannelId) {
    const { data } = await supabase
      .from('messages')
      .select('id, body, created_at, author_id, author:profiles!author_id(full_name, email)')
      .eq('channel_id', activeChannelId)
      .order('created_at', { ascending: true })
      .limit(100)

    messages = (data ?? []).map((m) => {
      const author = m.author as unknown as { full_name: string | null; email: string } | null
      return { id: m.id, body: m.body, created_at: m.created_at, author_id: m.author_id, author_name: author?.full_name ?? author?.email ?? 'Unknown' }
    })
  }

  return (
    <div>
      <PageHeader title="Chat" description="Internal team communication." />

      <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-card border border-border bg-surface md:grid-cols-4">
        <div className="border-b border-border md:col-span-1 md:border-b-0 md:border-r">
          <div className="p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Channels</p>
            {channels && channels.length > 0 ? (
              <ul className="space-y-0.5">
                {channels.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/chat?channel=${c.id}`}
                      className={`flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-sm ${
                        c.id === activeChannelId ? 'bg-primary-soft text-primary-dark font-medium' : 'text-muted-foreground hover:bg-surface-muted'
                      }`}
                    >
                      <Hash size={14} /> {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-subtle">No channels yet</p>
            )}
          </div>
          <ChannelForm />
        </div>

        <div className="md:col-span-3">
          {activeChannelId ? (
            <MessageList channelId={activeChannelId} initialMessages={messages} currentUserId={user.id} />
          ) : (
            <EmptyState title="No channel selected" description="Create a channel to start chatting." className="m-6" />
          )}
        </div>
      </div>
    </div>
  )
}

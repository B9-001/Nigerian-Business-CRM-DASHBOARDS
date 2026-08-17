import { requirePermission } from '@/lib/auth/session'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { AIChatClient } from './chat-client'

export default async function AIPage() {
  await requirePermission(PERMISSIONS.AI_USE)

  return (
    <div>
      <PageHeader title="AI Assistant" description="Organization-aware AI, grounded in your real data." />
      <AIChatClient />
    </div>
  )
}

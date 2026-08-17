import { BookOpen } from 'lucide-react'
import { requirePermission, can } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDateTime } from '@/lib/utils'
import { UploadForm } from './upload-form'

export default async function KnowledgePage() {
  const { profile } = await requirePermission(PERMISSIONS.AI_USE)
  const supabase = await createClient()
  const canManage = await can(PERMISSIONS.AI_KNOWLEDGE_MANAGE)

  const { data: documents } = await supabase
    .from('documents')
    .select('id, title, status, mime_type, created_at')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <PageHeader title="Company Knowledge" description="Documents the AI can search when answering questions." />

      {canManage && <UploadForm organizationId={profile.organization_id} />}

      <div className="mt-5">
        {!documents || documents.length === 0 ? (
          <EmptyState icon={BookOpen} title="No documents yet" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => (
              <Card key={doc.id}>
                <p className="truncate text-sm font-medium text-foreground">{doc.title}</p>
                <p className="text-xs text-subtle">{formatDateTime(doc.created_at)}</p>
                <div className="mt-2">
                  <StatusBadge status={doc.status} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

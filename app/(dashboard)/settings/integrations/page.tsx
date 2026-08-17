import { Plug } from 'lucide-react'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const PROVIDERS = [
  { key: 'GOOGLE', label: 'Google Meet', description: 'Auto-generate join links and pull transcripts.', connectHref: '/api/integrations/google/connect' },
  { key: 'ZOOM', label: 'Zoom', description: 'Create Zoom meetings from the Meetings page.', connectHref: '/api/integrations/zoom/connect' },
]

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; zoom?: string }>
}) {
  const { google, zoom } = await searchParams
  await requirePermission(PERMISSIONS.INTEGRATIONS_MANAGE)
  const supabase = await createClient()

  const { data: connected } = await supabase.rpc('list_connected_integrations')
  const connectedProviders = new Set((connected ?? []).map((c: { provider: string }) => c.provider))

  return (
    <div>
      <PageHeader title="Integrations" description="Connect external services to your organization." />

      {(google || zoom) && (
        <div className="mb-4 rounded-control border border-border bg-surface-muted p-3 text-sm">
          {google === 'connected' && 'Google Meet connected successfully.'}
          {google === 'error' && 'Could not connect Google Meet — please try again.'}
          {google === 'not_configured' && 'Google integration is not configured on this server yet.'}
          {zoom === 'connected' && 'Zoom connected successfully.'}
          {zoom === 'error' && 'Could not connect Zoom — please try again.'}
          {zoom === 'not_configured' && 'Zoom integration is not configured on this server yet.'}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PROVIDERS.map((p) => {
          const isConnected = connectedProviders.has(p.key)
          return (
            <Card key={p.key}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <Plug size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{p.label}</p>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  </div>
                </div>
                <Badge tone={isConnected ? 'success' : 'default'}>{isConnected ? 'Connected' : 'Not connected'}</Badge>
              </div>
              {!isConnected && (
                <a
                  href={p.connectHref}
                  className="mt-3 inline-block rounded-control bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover"
                >
                  Connect
                </a>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

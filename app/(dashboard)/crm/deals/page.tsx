import { Handshake } from 'lucide-react'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { formatNaira } from '@/lib/utils'
import { DealCard } from './deal-card'
import { DealForm } from './deal-form'

const STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']

export default async function DealsPage() {
  const { profile } = await requirePermission(PERMISSIONS.CUSTOMERS_VIEW)
  const supabase = await createClient()

  const [{ data: deals }, { data: customers }, { data: leads }] = await Promise.all([
    supabase
      .from('deals')
      .select('id, title, value_ngn, stage, owner:profiles!owner_id(full_name, email)')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false }),
    supabase.from('customers').select('id, name').eq('organization_id', profile.organization_id).order('name'),
    supabase.from('leads').select('id, name').eq('organization_id', profile.organization_id).order('name'),
  ])

  return (
    <div>
      <PageHeader title="Deals" description="Track deal value through your pipeline." />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
        <div className="xl:col-span-3">
          {!deals || deals.length === 0 ? (
            <EmptyState icon={Handshake} title="No deals yet" />
          ) : (
            <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-2">
              {STAGES.map((stage) => {
                const stageDeals = deals.filter((d) => d.stage === stage)
                const total = stageDeals.reduce((sum, d) => sum + Number(d.value_ngn), 0)
                return (
                  <div key={stage} className="w-64 shrink-0 rounded-card bg-surface-muted p-3">
                    <div className="mb-1 flex items-center justify-between px-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{stage}</span>
                      <span className="text-xs text-subtle">{stageDeals.length}</span>
                    </div>
                    <p className="mb-3 px-1 text-xs font-medium text-primary">{formatNaira(total)}</p>
                    <div className="space-y-2.5">
                      {stageDeals.map((deal) => (
                        <DealCard key={deal.id} deal={deal as unknown as Parameters<typeof DealCard>[0]['deal']} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add Deal</CardTitle>
          </CardHeader>
          <CardContent>
            <DealForm customers={customers ?? []} leads={leads ?? []} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

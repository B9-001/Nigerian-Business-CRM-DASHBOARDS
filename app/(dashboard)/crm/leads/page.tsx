import { UserPlus } from 'lucide-react'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { LeadCard } from './lead-card'
import { LeadForm } from './lead-form'

const STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']

export default async function LeadsPage() {
  const { profile } = await requirePermission(PERMISSIONS.CUSTOMERS_VIEW)
  const supabase = await createClient()

  const { data: leads } = await supabase
    .from('leads')
    .select('id, name, company, status, owner:profiles!owner_id(full_name, email)')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <PageHeader title="Leads" description="Your sales pipeline, from first contact to won." />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
        <div className="xl:col-span-3">
          {!leads || leads.length === 0 ? (
            <EmptyState icon={UserPlus} title="No leads yet" />
          ) : (
            <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-2">
              {STAGES.map((stage) => {
                const stageLeads = leads.filter((l) => l.status === stage)
                return (
                  <div key={stage} className="w-64 shrink-0 rounded-card bg-surface-muted p-3">
                    <div className="mb-3 flex items-center justify-between px-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{stage}</span>
                      <span className="text-xs text-subtle">{stageLeads.length}</span>
                    </div>
                    <div className="space-y-2.5">
                      {stageLeads.map((lead) => (
                        <LeadCard key={lead.id} lead={lead as unknown as Parameters<typeof LeadCard>[0]['lead']} />
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
            <CardTitle>Add Lead</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

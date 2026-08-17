import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatNaira } from '@/lib/utils'

export default async function BillingPage() {
  const { profile } = await requirePermission(PERMISSIONS.BILLING_MANAGE)
  const supabase = await createClient()

  const [{ data: organization }, { data: plans }] = await Promise.all([
    supabase.from('organizations').select('plan').eq('id', profile.organization_id).single(),
    supabase.from('plans').select('*').order('price_ngn_month', { ascending: true, nullsFirst: false }),
  ])

  return (
    <div>
      <PageHeader title="Billing" description="Your subscription plan and usage limits." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(plans ?? []).map((plan) => {
          const isCurrent = plan.id === organization?.plan
          return (
            <Card key={plan.id} className={isCurrent ? 'border-primary ring-1 ring-primary' : undefined}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">
                  {plan.price_ngn_month != null ? formatNaira(plan.price_ngn_month) : 'Custom'}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <li>{plan.max_users ?? 'Unlimited'} users</li>
                  <li>{plan.max_storage_gb ?? 'Unlimited'} GB storage</li>
                  <li>{plan.max_ai_requests_month ?? 'Unlimited'} AI requests/mo</li>
                  <li>{plan.max_projects ?? 'Unlimited'} projects</li>
                </ul>
                <Button className="mt-4 w-full" variant={isCurrent ? 'secondary' : 'primary'} disabled={isCurrent}>
                  {isCurrent ? 'Current Plan' : 'Upgrade'}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

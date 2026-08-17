import { requirePlatformAdmin } from '@/lib/auth/platform-admin'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { PlanForm } from './plan-form'

const ALL_FEATURE_KEYS = [
  'crm', 'tasks', 'projects', 'calendar', 'meetings', 'reports',
  'google_meet', 'zoom', 'ai_assistant', 'ai_research', 'advanced_analytics', 'automation', 'api_access',
]

export default async function AdminPlansPage() {
  await requirePlatformAdmin()
  const admin = createAdminClient()

  const [{ data: plans }, { data: features }] = await Promise.all([
    admin.from('plans').select('*').order('price_ngn_month', { ascending: true, nullsFirst: false }),
    admin.from('plan_features').select('plan_id, feature_key, enabled'),
  ])

  return (
    <div>
      <PageHeader title="Plans" description="Create and manage SaaS pricing plans. Changes apply immediately across the platform." />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {(plans ?? []).map((plan) => {
          const planFeatures = ALL_FEATURE_KEYS.map((key) => {
            const existing = (features ?? []).find((f) => f.plan_id === plan.id && f.feature_key === key)
            return { feature_key: key, enabled: existing?.enabled ?? false }
          })

          return (
            <Card key={plan.id}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <PlanForm plan={plan} features={planFeatures} />
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

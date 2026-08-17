import { requirePermission, can } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { TaskCompletionChart, SalesChart } from './report-charts'
import { ExportButton } from './export-button'

const COMING_SOON = ['Employee productivity', 'Project performance', 'Customer activity', 'Support', 'AI usage', 'Meeting activity']

export default async function ReportsPage() {
  const { profile } = await requirePermission(PERMISSIONS.REPORTS_VIEW)
  const supabase = await createClient()
  const canExport = await can(PERMISSIONS.REPORTS_EXPORT)

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: completedTasks }, { data: deals }] = await Promise.all([
    supabase
      .from('tasks')
      .select('completed_at')
      .eq('organization_id', profile.organization_id)
      .eq('status', 'COMPLETED')
      .gte('completed_at', thirtyDaysAgo),
    supabase.from('deals').select('stage, value_ngn, updated_at').eq('organization_id', profile.organization_id).in('stage', ['WON', 'LOST']),
  ])

  const byDate = new Map<string, number>()
  for (const t of completedTasks ?? []) {
    if (!t.completed_at) continue
    const day = t.completed_at.slice(0, 10)
    byDate.set(day, (byDate.get(day) ?? 0) + 1)
  }
  const taskData = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, completed]) => ({ date: date.slice(5), completed }))

  const byMonth = new Map<string, { won: number; lost: number }>()
  for (const d of deals ?? []) {
    const month = d.updated_at.slice(0, 7)
    const entry = byMonth.get(month) ?? { won: 0, lost: 0 }
    if (d.stage === 'WON') entry.won += Number(d.value_ngn)
    else entry.lost += Number(d.value_ngn)
    byMonth.set(month, entry)
  }
  const salesData = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }))

  return (
    <div>
      <PageHeader title="Reports" description="Understand how your organization is performing." />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Task Completion (last 30 days)</CardTitle>
            {canExport && <ExportButton filename="task-completion.csv" rows={taskData} />}
          </CardHeader>
          <CardContent>
            <TaskCompletionChart data={taskData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales (Won vs Lost)</CardTitle>
            {canExport && <ExportButton filename="sales.csv" rows={salesData} />}
          </CardHeader>
          <CardContent>
            <SalesChart data={salesData} />
          </CardContent>
        </Card>

        {COMING_SOON.map((title) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-subtle">Coming soon.</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

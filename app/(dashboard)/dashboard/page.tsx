import Link from 'next/link'
import {
  FolderKanban,
  ListTodo,
  Users,
  LifeBuoy,
  Video,
  Plus,
  UserPlus,
  CalendarPlus,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { requireOrg } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { MetricCard } from '@/components/dashboard/metric-card'
import { DonutGauge } from '@/components/dashboard/donut-gauge'
import { AIAssistantWidget } from '@/components/dashboard/ai-assistant-widget'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDateTime, formatNaira } from '@/lib/utils'

export default async function DashboardPage() {
  const { profile } = await requireOrg()
  const supabase = await createClient()

  const [{ data: summary }, { data: upcomingMeetings }, { data: recentTasks }, { data: recentActivity }] =
    await Promise.all([
      supabase.rpc('dashboard_summary'),
      supabase
        .from('meetings')
        .select('id, title, provider, start_time, join_url')
        .eq('status', 'SCHEDULED')
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(4),
      supabase
        .from('tasks')
        .select('id, title, status, priority, due_date, assigned_to, assignee:profiles!assigned_to(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('task_activity')
        .select('id, action, metadata, created_at, task:tasks!task_id(title)')
        .order('created_at', { ascending: false })
        .limit(6),
    ])

  const s = (summary ?? {}) as Record<string, number>
  const firstName = (profile.full_name ?? profile.email).split(' ')[0]

  const totalTaskWork = (s.tasks_open ?? 0) + (s.tasks_completed ?? 0)
  const overallProgress = totalTaskWork > 0 ? ((s.tasks_completed ?? 0) / totalTaskWork) * 100 : 0

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Good day, ${firstName}. Here's what's happening across your organization.`}
        actions={
          <Link
            href="/tasks"
            className="inline-flex h-10 items-center gap-1.5 rounded-control border border-border bg-surface px-4 text-sm font-semibold text-foreground hover:bg-surface-muted"
          >
            <Plus size={16} /> New task
          </Link>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
        <MetricCard label="Active Projects" value={s.projects_active ?? 0} icon={FolderKanban} emphasis hint="in progress" />
        <MetricCard label="Open Tasks" value={s.tasks_open ?? 0} icon={ListTodo} hint={`${s.tasks_overdue ?? 0} overdue`} />
        <MetricCard label="Team Members" value={s.employees_active ?? 0} icon={Users} hint={`${s.departments_total ?? 0} departments`} />
        <MetricCard label="Open Tickets" value={s.tickets_open ?? 0} icon={LifeBuoy} hint={`${s.tickets_urgent ?? 0} urgent`} />
        <MetricCard
          label="Pipeline Value"
          value={formatNaira(s.deals_pipeline_value_ngn ?? 0)}
          icon={Video}
          hint={`${s.leads_open ?? 0} open leads`}
        />
      </div>

      {/* Middle grid */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Tasks</CardTitle>
            <Link href="/tasks" className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover">
              View all <ArrowRight size={12} />
            </Link>
          </CardHeader>
          <CardContent>
            {recentTasks && recentTasks.length > 0 ? (
              <ul className="divide-y divide-border">
                {recentTasks.map((task) => {
                  const assignee = task.assignee as { full_name: string | null; email: string } | null
                  return (
                    <li key={task.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {assignee ? assignee.full_name ?? assignee.email : 'Unassigned'}
                          {task.due_date ? ` · Due ${formatDateTime(task.due_date)}` : ''}
                        </p>
                      </div>
                      <StatusBadge status={task.status} />
                    </li>
                  )
                })}
              </ul>
            ) : (
              <EmptyState icon={ListTodo} title="No tasks yet" description="Create your first task to get your team moving." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Meetings</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingMeetings && upcomingMeetings.length > 0 ? (
              <ul className="space-y-3">
                {upcomingMeetings.map((meeting) => (
                  <li key={meeting.id} className="rounded-control border border-border p-3">
                    <p className="truncate text-sm font-medium text-foreground">{meeting.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDateTime(meeting.start_time)} · {meeting.provider.replace('_', ' ')}
                    </p>
                    {meeting.join_url && (
                      <a href={meeting.join_url} target="_blank" rel="noreferrer">
                        <Button size="sm" className="mt-2 w-full">
                          Join Meeting
                        </Button>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={Video} title="No meetings scheduled" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom grid */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2.5">
            <QuickAction href="/tasks" icon={Plus} label="Create Task" />
            <QuickAction href="/crm/customers" icon={UserPlus} label="Add Customer" />
            <QuickAction href="/meetings" icon={CalendarPlus} label="Schedule Meeting" />
            <QuickAction href="/ai/research" icon={Sparkles} label="Start AI Research" />
          </CardContent>
        </Card>

        <Card className="flex items-center justify-center">
          <CardContent>
            <DonutGauge value={overallProgress} label="Overall Task Progress" sublabel={`${s.tasks_completed ?? 0} of ${totalTaskWork} tasks`} />
          </CardContent>
        </Card>

        <AIAssistantWidget />
      </div>

      {/* Recent Activity + AI Insights */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity && recentActivity.length > 0 ? (
              <ul className="space-y-3">
                {recentActivity.map((item) => {
                  const taskTitle = (item.task as { title: string } | null)?.title ?? 'a task'
                  return (
                    <li key={item.id} className="flex items-start gap-3">
                      <Avatar name="Activity" size={28} />
                      <div className="min-w-0 text-sm">
                        <span className="text-foreground">
                          {item.action === 'status_changed' ? 'Status changed on' : 'Reassigned'} <strong>{taskTitle}</strong>
                        </span>
                        <p className="text-xs text-muted-foreground">{formatDateTime(item.created_at)}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <EmptyState title="No recent activity" description="Activity across tasks and projects will show up here." />
            )}
          </CardContent>
        </Card>

        <Card className="border-primary-soft bg-primary-soft/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary" /> AI Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {(s.tasks_overdue ?? 0) > 0
                ? `You have ${s.tasks_overdue} overdue task${s.tasks_overdue === 1 ? '' : 's'} across the organization. `
                : 'No overdue tasks right now — nice work. '}
              {(s.tickets_urgent ?? 0) > 0 ? `${s.tickets_urgent} support ticket(s) are marked urgent.` : ''}
            </p>
            <p className="mt-2 text-xs text-subtle">AI-generated insight based on current organization data — not a guarantee.</p>
            <Link href="/ai" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover">
              Ask the AI Assistant <ArrowRight size={12} />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: typeof Plus; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-start gap-2 rounded-control border border-border p-3 text-left transition-colors hover:border-primary hover:bg-primary-soft/40"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon size={16} />
      </span>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </Link>
  )
}

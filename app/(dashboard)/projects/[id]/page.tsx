import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Plus, Sparkles, X } from 'lucide-react'
import { requirePermission, can } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate } from '@/lib/utils'
import { ProjectStatusSelect } from './status-select'
import { AddMemberForm } from './add-member-form'
import { removeProjectMemberAction } from '../actions'

const TABS = ['overview', 'tasks', 'timeline', 'files', 'meetings', 'team', 'ai'] as const

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab = 'overview' } = await searchParams
  const { profile } = await requirePermission(PERMISSIONS.PROJECTS_VIEW)
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, description, status, priority, progress, start_date, deadline, owner:profiles!owner_id(full_name, email)')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!project) notFound()

  const canManage = await can(PERMISSIONS.PROJECTS_UPDATE)
  const owner = project.owner as { full_name: string | null; email: string } | null
  const activeTab = (TABS as readonly string[]).includes(tab) ? tab : 'overview'

  return (
    <div>
      <PageHeader
        title={project.name}
        description={`Owner: ${owner?.full_name ?? owner?.email ?? 'Unassigned'}`}
        actions={
          <Link
            href={`/tasks/new?projectId=${project.id}`}
            className="inline-flex h-10 items-center gap-1.5 rounded-control bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            <Plus size={16} /> Add Task
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-card border border-border bg-surface p-4">
        {canManage ? <ProjectStatusSelect projectId={project.id} status={project.status} /> : <StatusBadge status={project.status} />}
        <StatusBadge status={project.priority} />
        <span className="text-xs text-muted-foreground">
          {project.start_date ? formatDate(project.start_date) : '—'} → {project.deadline ? formatDate(project.deadline) : 'No deadline'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${project.progress}%` }} />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{project.progress}%</span>
        </div>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/projects/${project.id}?tab=${t}`}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium capitalize ${
              activeTab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      {activeTab === 'overview' && (
        <Card>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-foreground">{project.description || 'No description provided.'}</p>
          </CardContent>
        </Card>
      )}

      {activeTab === 'tasks' && <ProjectTasksTab organizationId={profile.organization_id} projectId={project.id} />}
      {activeTab === 'timeline' && <ProjectTimelineTab organizationId={profile.organization_id} projectId={project.id} />}
      {activeTab === 'files' && <ProjectFilesTab organizationId={profile.organization_id} projectId={project.id} />}
      {activeTab === 'meetings' && <ProjectMeetingsTab organizationId={profile.organization_id} projectId={project.id} />}
      {activeTab === 'team' && (
        <ProjectTeamTab organizationId={profile.organization_id} projectId={project.id} canManage={canManage} />
      )}
      {activeTab === 'ai' && (
        <Card className="border-primary-soft bg-primary-soft/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary" /> AI Project Assistant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Ask the AI assistant to summarize this project, identify risks, find overdue work, or generate a status report.
            </p>
            <Link
              href={`/ai?context=project:${project.id}`}
              className="mt-3 inline-block text-xs font-semibold text-primary hover:text-primary-hover"
            >
              Open in AI Assistant →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

async function ProjectTasksTab({ organizationId, projectId }: { organizationId: string; projectId: string }) {
  const supabase = await createClient()
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, status, priority, due_date, assignee:profiles!assigned_to(full_name, email)')
    .eq('organization_id', organizationId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (!tasks || tasks.length === 0) return <EmptyState title="No tasks yet" description="Add a task to get started." />

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {tasks.map((task) => {
            const assignee = task.assignee as unknown as { full_name: string | null; email: string } | null
            return (
              <li key={task.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <Link href={`/tasks/${task.id}`} className="truncate text-sm font-medium text-foreground hover:text-primary">
                    {task.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">{assignee ? assignee.full_name ?? assignee.email : 'Unassigned'}</p>
                </div>
                <StatusBadge status={task.status} />
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

async function ProjectTimelineTab({ organizationId, projectId }: { organizationId: string; projectId: string }) {
  const supabase = await createClient()
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, due_date, status')
    .eq('organization_id', organizationId)
    .eq('project_id', projectId)
    .not('due_date', 'is', null)
    .order('due_date', { ascending: true })

  if (!tasks || tasks.length === 0) return <EmptyState title="Nothing scheduled" description="Tasks with due dates will appear here chronologically." />

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <span className="text-foreground">{task.title}</span>
              <span className="flex items-center gap-3">
                <span className="text-muted-foreground">{formatDate(task.due_date!)}</span>
                <StatusBadge status={task.status} />
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

async function ProjectFilesTab({ organizationId, projectId }: { organizationId: string; projectId: string }) {
  const supabase = await createClient()
  const { data: files } = await supabase
    .from('project_files')
    .select('id, file_name, created_at')
    .eq('organization_id', organizationId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (!files || files.length === 0) return <EmptyState title="No files yet" />

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {files.map((f) => (
            <li key={f.id} className="p-4 text-sm text-foreground">
              {f.file_name}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

async function ProjectMeetingsTab({ organizationId, projectId }: { organizationId: string; projectId: string }) {
  const supabase = await createClient()
  const { data: meetings } = await supabase
    .from('meetings')
    .select('id, title, start_time, status')
    .eq('organization_id', organizationId)
    .eq('project_id', projectId)
    .order('start_time', { ascending: false })

  if (!meetings || meetings.length === 0) return <EmptyState title="No meetings linked to this project" />

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {meetings.map((m) => (
            <li key={m.id} className="flex items-center justify-between p-4 text-sm">
              <span className="text-foreground">{m.title}</span>
              <span className="flex items-center gap-3 text-muted-foreground">
                {formatDate(m.start_time)}
                <StatusBadge status={m.status} />
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

async function ProjectTeamTab({
  organizationId,
  projectId,
  canManage,
}: {
  organizationId: string
  projectId: string
  canManage: boolean
}) {
  const supabase = await createClient()
  const [{ data: members }, { data: allProfiles }] = await Promise.all([
    supabase
      .from('project_members')
      .select('user_id, role, profile:profiles!user_id(full_name, email)')
      .eq('organization_id', organizationId)
      .eq('project_id', projectId),
    supabase.from('profiles').select('id, full_name, email').eq('organization_id', organizationId),
  ])

  const memberIds = new Set((members ?? []).map((m) => m.user_id))
  const candidates = (allProfiles ?? []).filter((p) => !memberIds.has(p.id))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team members</CardTitle>
      </CardHeader>
      <CardContent>
        {members && members.length > 0 ? (
          <ul className="space-y-2">
            {members.map((m) => {
              const p = m.profile as unknown as { full_name: string | null; email: string } | null
              return (
                <li key={m.user_id} className="flex items-center justify-between gap-3 rounded-control border border-border p-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={p?.full_name ?? p?.email ?? '?'} size={30} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{p?.full_name ?? p?.email}</p>
                      <p className="text-xs text-subtle">{m.role}</p>
                    </div>
                  </div>
                  {canManage && (
                    <form action={removeProjectMemberAction.bind(null, projectId, m.user_id)}>
                      <button className="rounded-control p-1.5 text-subtle hover:bg-danger/10 hover:text-danger" aria-label="Remove member">
                        <X size={15} />
                      </button>
                    </form>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState title="No team members yet" />
        )}

        {canManage && <AddMemberForm projectId={projectId} candidates={candidates ?? []} />}
      </CardContent>
    </Card>
  )
}

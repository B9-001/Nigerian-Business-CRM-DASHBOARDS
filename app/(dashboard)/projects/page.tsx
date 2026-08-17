import Link from 'next/link'
import { Plus, FolderKanban } from 'lucide-react'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate } from '@/lib/utils'

export default async function ProjectsPage() {
  const { profile } = await requirePermission(PERMISSIONS.PROJECTS_VIEW)
  const supabase = await createClient()

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, status, priority, progress, deadline, owner:profiles!owner_id(full_name, email)')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Track initiatives from planning to completion."
        actions={
          <Link
            href="/projects/new"
            className="inline-flex h-10 items-center gap-1.5 rounded-control bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            <Plus size={16} /> New Project
          </Link>
        }
      />

      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const owner = project.owner as { full_name: string | null; email: string } | null
            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{project.name}</p>
                    <StatusBadge status={project.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Owner: {owner?.full_name ?? owner?.email ?? 'Unassigned'}</p>

                  <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-xs text-subtle">
                      <span>Progress</span>
                      <span>{project.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${project.progress}%` }} />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-subtle">
                    <StatusBadge status={project.priority} />
                    <span>{project.deadline ? `Due ${formatDate(project.deadline)}` : 'No deadline'}</span>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      ) : (
        <EmptyState icon={FolderKanban} title="No projects yet" description="Create your first project to start tracking work." />
      )}
    </div>
  )
}

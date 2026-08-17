import { Search } from 'lucide-react'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDateTime } from '@/lib/utils'
import { ResearchForm } from './research-client'

export default async function ResearchPage() {
  const { user, profile } = await requirePermission(PERMISSIONS.AI_RESEARCH)
  const supabase = await createClient()

  const { data: jobs } = await supabase
    .from('ai_research_jobs')
    .select('id, query, status, created_at, error')
    .eq('organization_id', profile.organization_id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const jobIds = (jobs ?? []).map((j) => j.id)
  const { data: reports } = jobIds.length
    ? await supabase.from('ai_research_reports').select('id, research_job_id, title, summary, sources, content').in('research_job_id', jobIds)
    : { data: [] }

  return (
    <div>
      <PageHeader title="Business Research" description="AI-powered web research with cited sources." />

      <Card className="mb-5">
        <CardContent>
          <ResearchForm />
          <p className="mt-2 text-xs text-subtle">
            Research runs as a background job. If it doesn&apos;t appear immediately, refresh in a moment.
          </p>
        </CardContent>
      </Card>

      {!jobs || jobs.length === 0 ? (
        <EmptyState icon={Search} title="No research yet" description="Ask a question above to generate your first report." />
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            const report = reports?.find((r) => r.research_job_id === job.id)
            return (
              <Card key={job.id}>
                <CardHeader>
                  <CardTitle>{job.query}</CardTitle>
                  <StatusBadge status={job.status} />
                </CardHeader>
                <CardContent>
                  <p className="mb-2 text-xs text-subtle">{formatDateTime(job.created_at)}</p>
                  {job.status === 'FAILED' && <p className="text-sm text-danger">{job.error}</p>}
                  {report && (
                    <>
                      <div>
                        <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">AI Summary</h4>
                        <p className="whitespace-pre-wrap text-sm text-foreground">{report.content}</p>
                      </div>
                      {Array.isArray(report.sources) && report.sources.length > 0 && (
                        <div className="mt-3 border-t border-border pt-3">
                          <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Sources</h4>
                          <ul className="space-y-1">
                            {(report.sources as { url: string; title: string }[]).map((s, i) => (
                              <li key={i}>
                                <a href={s.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                                  {s.title || s.url}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <p className="mt-3 text-xs italic text-subtle">
                        AI-generated analysis. Verify against the linked sources before treating this as fact.
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Meetings worker — summarizes transcripts into AI_SUMMARY artifacts and
 * meeting_action_items, then idempotently converts action items into real
 * tasks. Run as a standalone process: `npm run worker:meetings`.
 */
import { Worker } from 'bullmq'
import Redis from 'ioredis'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { openAIProvider } from '@/lib/ai/providers/openai'
import { AIProviderNotConfiguredError } from '@/lib/ai/providers/types'

interface ActionItem {
  description: string
  assigneeHint?: string
  dueDateHint?: string
}

async function summarizeTranscript(meetingArtifactId: string) {
  const admin = createAdminClient()
  const { data: artifact } = await admin.from('meeting_artifacts').select('*').eq('id', meetingArtifactId).single()
  if (!artifact || artifact.type !== 'TRANSCRIPT' || !artifact.content) return

  let summary = ''
  let actionItems: ActionItem[] = []

  try {
    const completion = await openAIProvider.complete([
      {
        role: 'system',
        content:
          'Summarize this meeting transcript. Respond as JSON: {"summary": string, "decisions": string[], "actionItems": [{"description": string, "assigneeHint": string, "dueDateHint": string}]}. Only include real action items explicitly discussed.',
      },
      { role: 'user', content: artifact.content },
    ])

    const parsed = JSON.parse(completion.content)
    summary = parsed.summary ?? ''
    actionItems = parsed.actionItems ?? []
  } catch (err) {
    if (err instanceof AIProviderNotConfiguredError) {
      console.warn('[worker:meetings] AI not configured — skipping summarization')
      return
    }
    console.error('[worker:meetings] summarization failed', err)
    return
  }

  await admin.from('meeting_artifacts').upsert(
    {
      organization_id: artifact.organization_id,
      meeting_id: artifact.meeting_id,
      type: 'AI_SUMMARY',
      content: summary,
      idempotency_key: `summary:${artifact.idempotency_key}`,
      processed_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id,idempotency_key', ignoreDuplicates: true }
  )

  for (const item of actionItems) {
    let employeeId: string | null = null
    if (item.assigneeHint) {
      const { data: employee } = await admin
        .from('employees')
        .select('id')
        .eq('organization_id', artifact.organization_id)
        .or(`first_name.ilike.%${item.assigneeHint}%,last_name.ilike.%${item.assigneeHint}%`)
        .maybeSingle()
      employeeId = employee?.id ?? null
    }

    await admin.from('meeting_action_items').insert({
      organization_id: artifact.organization_id,
      meeting_id: artifact.meeting_id,
      meeting_artifact_id: artifact.id,
      description: item.description,
      assignee_employee_id: employeeId,
      due_date: item.dueDateHint ?? null,
    })
  }

  await convertPendingActionItemsToTasks(artifact.meeting_id)
}

/** Idempotent: only converts action items where task_id is still null. */
async function convertPendingActionItemsToTasks(meetingId: string) {
  const admin = createAdminClient()
  const { data: pending } = await admin
    .from('meeting_action_items')
    .select('id, organization_id, description, due_date, assignee_employee_id')
    .eq('meeting_id', meetingId)
    .is('task_id', null)

  for (const item of pending ?? []) {
    const { data: employee } = item.assignee_employee_id
      ? await admin.from('employees').select('user_id').eq('id', item.assignee_employee_id).single()
      : { data: null }

    const { data: task } = await admin
      .from('tasks')
      .insert({ organization_id: item.organization_id, title: item.description, due_date: item.due_date, assigned_to: employee?.user_id ?? null })
      .select('id')
      .single()

    if (task) {
      await admin.from('meeting_action_items').update({ task_id: task.id }).eq('id', item.id)
    }
  }
}

function startWorker() {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    console.warn('[worker:meetings] REDIS_URL not set — worker is not running.')
    return
  }

  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null })
  const worker = new Worker(
    'meeting-summary',
    async (job) => summarizeTranscript(job.data.meetingArtifactId),
    { connection, prefix: process.env.QUEUE_PREFIX ?? 'nbos' }
  )

  worker.on('failed', (job, err) => console.error(`[worker:meetings] job ${job?.id} failed`, err))
  console.log('[worker:meetings] started')
}

startWorker()

export { summarizeTranscript }

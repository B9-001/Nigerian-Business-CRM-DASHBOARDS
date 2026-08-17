import { NextResponse, type NextRequest } from 'next/server'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'

/**
 * Pulls meeting artifacts (transcript/recording) for a completed meeting and
 * idempotently converts any pending meeting_action_items into real tasks.
 * Intended to be called by workers/meetings once a provider webhook reports
 * the meeting ended — also callable by an org member with meetings.update
 * for manual "check for transcript" retries.
 *
 * Idempotency: meeting_artifacts has a unique(organization_id, idempotency_key)
 * constraint, and action items only convert to tasks once (task_id is null
 * check) — see supabase/migrations/20260101000600_meetings.sql.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { profile } = await requirePermission(PERMISSIONS.MEETINGS_UPDATE)
    const supabase = await createClient()

    const { data: meeting } = await supabase
      .from('meetings')
      .select('id, status')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single()

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Full transcript retrieval from Google/Zoom + AI summarization is
    // implemented in workers/meetings (background job) — this endpoint just
    // idempotently promotes any action items that already have a
    // transcript-derived record but haven't become tasks yet.
    const { data: pendingItems } = await supabase
      .from('meeting_action_items')
      .select('id, description, due_date, assignee_employee_id')
      .eq('meeting_id', id)
      .is('task_id', null)

    let created = 0
    for (const item of pendingItems ?? []) {
      const { data: employee } = item.assignee_employee_id
        ? await supabase.from('employees').select('user_id').eq('id', item.assignee_employee_id).single()
        : { data: null }

      const { data: task } = await supabase
        .from('tasks')
        .insert({
          organization_id: profile.organization_id,
          title: item.description,
          due_date: item.due_date,
          assigned_to: employee?.user_id ?? null,
        })
        .select('id')
        .single()

      if (task) {
        await supabase.from('meeting_action_items').update({ task_id: task.id }).eq('id', item.id)
        created += 1
      }
    }

    return NextResponse.json({ ok: true, tasksCreated: created })
  } catch (err) {
    console.error('[meetings/sync] failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

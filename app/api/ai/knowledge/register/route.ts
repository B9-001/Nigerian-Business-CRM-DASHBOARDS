import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'

const schema = z.object({
  title: z.string().min(1),
  filePath: z.string().min(1),
  mimeType: z.string().optional(),
  fileSize: z.number().optional(),
})

/**
 * Registers a document that was just uploaded client-side to the `documents`
 * Storage bucket. Actual text extraction/chunking/embedding happens in
 * workers/ai (background job) — this just creates the PENDING DB row it
 * will pick up.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, profile } = await requirePermission(PERMISSIONS.AI_KNOWLEDGE_MANAGE)
    const body = await request.json().catch(() => null)
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('documents')
      .insert({
        organization_id: profile.organization_id,
        uploaded_by: user.id,
        title: parsed.data.title,
        file_path: parsed.data.filePath,
        mime_type: parsed.data.mimeType ?? null,
        file_size: parsed.data.fileSize ?? null,
        status: 'PENDING',
      })
      .select('id')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Could not register document' }, { status: 500 })
    }

    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (err) {
    console.error('[ai/knowledge/register] failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

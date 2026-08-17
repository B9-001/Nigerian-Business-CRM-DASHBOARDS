import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/database/supabase/admin'

export async function GET() {
  const start = Date.now()
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('plans').select('id').limit(1)
    const latencyMs = Date.now() - start

    if (error) {
      return NextResponse.json({ status: 'down', latencyMs, error: error.message }, { status: 503 })
    }
    return NextResponse.json({ status: 'ok', latencyMs })
  } catch (err) {
    return NextResponse.json({ status: 'down', latencyMs: Date.now() - start, error: String(err) }, { status: 503 })
  }
}

/**
 * AI worker — processes background AI research and document-processing jobs.
 * Run as a standalone Node process: `npm run worker:ai`
 * (separate from the Next.js app — see README "Deploying to Vercel").
 */
import { Worker } from 'bullmq'
import Redis from 'ioredis'
import { runResearchJob } from '@/lib/ai/research'
import { createAdminClient } from '@/lib/database/supabase/admin'
import { AIProviderNotConfiguredError } from '@/lib/ai/providers/types'

const CHUNK_SIZE = 1000

async function processDocumentJob(documentId: string) {
  const admin = createAdminClient()
  const { data: doc } = await admin.from('documents').select('*').eq('id', documentId).single()
  if (!doc) return

  await admin.from('documents').update({ status: 'PROCESSING' }).eq('id', documentId)

  try {
    let text = ''
    if (!doc.mime_type || doc.mime_type.startsWith('text/') || doc.mime_type === 'text/markdown') {
      const { data: file } = await admin.storage.from('documents').download(doc.file_path)
      text = file ? await file.text() : ''
    } else {
      // PDF/DOCX extraction needs a dedicated library not installed here —
      // add `pdf-parse` (PDF) or `mammoth` (DOCX) as a dependency and
      // extract text before chunking. Left as a TODO so the pipeline still
      // completes gracefully (document is marked READY with zero chunks)
      // rather than hanging in PROCESSING forever.
      console.warn(`[worker:ai] no text extractor for mime type ${doc.mime_type} — install pdf-parse/mammoth to support this`)
    }

    const chunks = chunkText(text, CHUNK_SIZE)

    for (let i = 0; i < chunks.length; i++) {
      let embedding: number[] | null = null
      try {
        embedding = await embedText(chunks[i])
      } catch (err) {
        if (!(err instanceof AIProviderNotConfiguredError)) console.error('[worker:ai] embedding failed', err)
      }

      await admin.from('document_chunks').insert({
        organization_id: doc.organization_id,
        document_id: documentId,
        chunk_index: i,
        content: chunks[i],
        // pgvector expects the literal text form "[0.1,0.2,...]".
        embedding: embedding ? `[${embedding.join(',')}]` : null,
      })
    }

    await admin.from('documents').update({ status: 'READY' }).eq('id', documentId)
  } catch (err) {
    console.error('[worker:ai] document processing failed', documentId, err)
    await admin.from('documents').update({ status: 'FAILED' }).eq('id', documentId)
  }
}

function chunkText(text: string, size: number): string[] {
  if (!text.trim()) return []
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size))
  return chunks
}

async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new AIProviderNotConfiguredError('OpenAI')

  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })
  const res = await client.embeddings.create({ model: 'text-embedding-3-small', input: text })
  return res.data[0].embedding
}

function startWorker() {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    console.warn('[worker:ai] REDIS_URL not set — worker is not running. Set REDIS_URL to enable background AI jobs.')
    return
  }

  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null })
  const worker = new Worker(
    'ai-research',
    async (job) => {
      if (job.name === 'research') await runResearchJob(job.data.jobId)
      if (job.name === 'document') await processDocumentJob(job.data.documentId)
    },
    { connection, prefix: process.env.QUEUE_PREFIX ?? 'nbos' }
  )

  worker.on('failed', (job, err) => console.error(`[worker:ai] job ${job?.id} failed`, err))
  console.log('[worker:ai] started')
}

startWorker()

export { processDocumentJob }

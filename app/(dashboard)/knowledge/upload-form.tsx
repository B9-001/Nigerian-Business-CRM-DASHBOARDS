'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/database/supabase/client'

export function UploadForm({ organizationId }: { organizationId: string }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function handleUpload() {
    const file = inputRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)

    try {
      const supabase = createClient()
      const path = `${organizationId}/${crypto.randomUUID()}-${file.name}`

      const { error: uploadError } = await supabase.storage.from('documents').upload(path, file)
      if (uploadError) throw uploadError

      const res = await fetch('/api/ai/knowledge/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: file.name, filePath: path, mimeType: file.type, fileSize: file.size }),
      })

      if (!res.ok) throw new Error('Could not register document')

      if (inputRef.current) inputRef.current.value = ''
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-control border border-dashed border-border p-4 text-center">
      <input ref={inputRef} type="file" accept=".pdf,.docx,.xlsx,.txt,.md" className="hidden" id="file-upload" onChange={handleUpload} />
      <label htmlFor="file-upload">
        <Button type="button" variant="secondary" disabled={uploading} onClick={() => inputRef.current?.click()}>
          <Upload size={15} /> {uploading ? 'Uploading…' : 'Upload document'}
        </Button>
      </label>
      <p className="mt-2 text-xs text-subtle">PDF, DOCX, XLSX, TXT, Markdown</p>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  )
}

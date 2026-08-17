'use client'

import { Download } from 'lucide-react'

export function ExportButton({ filename, rows }: { filename: string; rows: Record<string, unknown>[] }) {
  function download() {
    if (rows.length === 0) return
    const headers = Object.keys(rows[0])
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button onClick={download} className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover">
      <Download size={13} /> Export CSV
    </button>
  )
}

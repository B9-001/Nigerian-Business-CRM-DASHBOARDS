'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PrintButton() {
  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()}>
      <Download size={14} /> Download PDF
    </Button>
  )
}

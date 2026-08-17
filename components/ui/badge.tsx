import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

export type BadgeTone = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'

const toneClasses: Record<BadgeTone, string> = {
  default: 'bg-surface-muted text-muted-foreground',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
  primary: 'bg-primary-soft text-primary-dark',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

export function Badge({ className, tone = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className
      )}
      {...props}
    />
  )
}

const STATUS_TONE: Record<string, BadgeTone> = {
  TODO: 'default',
  IN_PROGRESS: 'info',
  BLOCKED: 'danger',
  IN_REVIEW: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'default',
  PLANNING: 'default',
  ACTIVE: 'success',
  ON_HOLD: 'warning',
  OPEN: 'info',
  WAITING: 'warning',
  RESOLVED: 'success',
  CLOSED: 'default',
  NEW: 'info',
  CONTACTED: 'info',
  QUALIFIED: 'primary',
  PROPOSAL: 'warning',
  NEGOTIATION: 'warning',
  WON: 'success',
  LOST: 'danger',
  SCHEDULED: 'info',
  URGENT: 'danger',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'default',
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = STATUS_TONE[status] ?? 'default'
  return (
    <Badge tone={tone} className={className}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {status.replace(/_/g, ' ')}
    </Badge>
  )
}

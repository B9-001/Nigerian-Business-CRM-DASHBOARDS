import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: string | number
  change?: { value: string; direction: 'up' | 'down' }
  icon?: LucideIcon
  emphasis?: boolean
  hint?: string
}

export function MetricCard({ label, value, change, icon: Icon, emphasis, hint }: MetricCardProps) {
  return (
    <div
      className={cn(
        'rounded-card p-5 shadow-soft',
        emphasis ? 'bg-primary text-white' : 'border border-border bg-surface text-foreground'
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn('text-sm font-medium', emphasis ? 'text-white/80' : 'text-muted-foreground')}>{label}</span>
        {Icon && (
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full',
              emphasis ? 'bg-white/15 text-white' : 'bg-primary-soft text-primary'
            )}
          >
            <Icon size={16} />
          </span>
        )}
      </div>
      <div className="mt-3 text-[32px] font-bold leading-none">{value}</div>
      {(change || hint) && (
        <div className={cn('mt-2 text-xs', emphasis ? 'text-white/75' : 'text-muted-foreground')}>
          {change && (
            <span className={cn('font-semibold', !emphasis && (change.direction === 'up' ? 'text-success' : 'text-danger'))}>
              {change.direction === 'up' ? '↑' : '↓'} {change.value}
            </span>
          )}
          {hint && <span className={change ? 'ml-1.5' : ''}>{hint}</span>}
        </div>
      )}
    </div>
  )
}

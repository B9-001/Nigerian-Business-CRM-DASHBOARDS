import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: string | number
  change?: { value: string; direction: 'up' | 'down' }
  icon?: LucideIcon
  emphasis?: boolean
  hint?: string
}

/**
 * KPI card — icon badge + large value + a colored trend pill (not just
 * colored text), matching the compact, icon-forward metric-card pattern
 * from the dashboard reference. Brand color stays deep green (DESIGN.md);
 * only the layout/pattern was adopted from the reference, not its blue palette.
 */
export function MetricCard({ label, value, change, icon: Icon, emphasis, hint }: MetricCardProps) {
  return (
    <div
      className={cn(
        'rounded-card p-5 shadow-soft transition-shadow hover:shadow-md',
        emphasis ? 'bg-primary text-white' : 'border border-border bg-surface text-foreground'
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn('text-sm font-medium', emphasis ? 'text-white/80' : 'text-muted-foreground')}>{label}</span>
        {Icon && (
          <span
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full',
              emphasis ? 'bg-white/15 text-white' : 'bg-primary-soft text-primary'
            )}
          >
            <Icon size={16} />
          </span>
        )}
      </div>

      <div className="mt-3 text-[30px] font-bold leading-none tabular-nums">{value}</div>

      {(change || hint) && (
        <div className="mt-3 flex items-center gap-1.5">
          {change && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                emphasis
                  ? 'bg-white/15 text-white'
                  : change.direction === 'up'
                    ? 'bg-success/10 text-success'
                    : 'bg-danger/10 text-danger'
              )}
            >
              {change.direction === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {change.value}
            </span>
          )}
          {hint && <span className={cn('text-xs', emphasis ? 'text-white/75' : 'text-subtle')}>{hint}</span>}
        </div>
      )}
    </div>
  )
}

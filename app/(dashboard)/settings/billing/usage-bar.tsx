export function UsageBar({ label, current, limit, unit = '' }: { label: string; current: number; limit: number | null; unit?: string }) {
  const pct = limit ? Math.min(100, Math.round((current / limit) * 100)) : 0
  const nearLimit = limit != null && current / limit >= 0.9

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">
          {current.toLocaleString()}
          {unit} / {limit != null ? `${limit.toLocaleString()}${unit}` : 'Unlimited'}
        </span>
      </div>
      {limit != null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div className={`h-full rounded-full ${nearLimit ? 'bg-danger' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

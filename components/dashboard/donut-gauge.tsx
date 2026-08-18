'use client'

import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'

interface DonutGaugeProps {
  /** 0-100 */
  value: number
  label: string
  sublabel?: string
  size?: number
}

/**
 * Circular percentage gauge (DESIGN.md #13 "Project Progress" / the
 * reference's "Repeat Customer Rate" widget) — a donut arc with the
 * percentage centered inside it. Brand green, not the reference's blue.
 */
export function DonutGauge({ value, label, sublabel, size = 140 }: DonutGaugeProps) {
  const clamped = Math.max(0, Math.min(100, value))
  const data = [{ value: clamped, fill: 'var(--primary)' }]

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <RadialBarChart
          width={size}
          height={size}
          cx="50%"
          cy="50%"
          innerRadius="72%"
          outerRadius="100%"
          barSize={10}
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background={{ fill: 'var(--surface-muted)' }} dataKey="value" cornerRadius={999} />
        </RadialBarChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-foreground">{Math.round(clamped)}%</span>
        </div>
      </div>
      <p className="mt-1 text-sm font-medium text-foreground">{label}</p>
      {sublabel && <p className="text-xs text-subtle">{sublabel}</p>}
    </div>
  )
}

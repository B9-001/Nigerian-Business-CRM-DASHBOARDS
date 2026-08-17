import Image from 'next/image'
import { cn, initials } from '@/lib/utils'

interface AvatarProps {
  name: string
  src?: string | null
  size?: number
  className?: string
}

const PALETTE = ['#087443', '#3678D4', '#D99A17', '#66716D', '#045A34']

function colorFor(name: string) {
  const idx = name.charCodeAt(0) % PALETTE.length
  return PALETTE[idx]
}

export function Avatar({ name, src, size = 36, className }: AvatarProps) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className={cn('rounded-full object-cover', className)}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className={cn('flex items-center justify-center rounded-full font-semibold text-white', className)}
      style={{ width: size, height: size, backgroundColor: colorFor(name), fontSize: size * 0.4 }}
      aria-label={name}
      title={name}
    >
      {initials(name) || '?'}
    </div>
  )
}

export function AvatarGroup({ names, max = 4 }: { names: string[]; max?: number }) {
  const visible = names.slice(0, max)
  const overflow = names.length - visible.length

  return (
    <div className="flex -space-x-2">
      {visible.map((name, i) => (
        <Avatar key={`${name}-${i}`} name={name} size={28} className="ring-2 ring-surface" />
      ))}
      {overflow > 0 && (
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-muted text-[11px] font-semibold text-muted-foreground ring-2 ring-surface"
          aria-label={`+${overflow} more`}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}

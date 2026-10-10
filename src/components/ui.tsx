import type { ReactNode } from 'react'

// The Hub's seal mark: 畳 (tatami) in a hanko-red square.
export function SealMark({ className = 'h-7 w-7 text-base' }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[5px] bg-hanko font-brush leading-none text-text shadow-[0_4px_12px_-4px_rgba(214,63,37,0.8)] ${className}`}
      aria-hidden="true"
    >
      畳
    </span>
  )
}

const STATUS_STYLES: Record<string, string> = {
  live: 'bg-sage/15 text-sage ring-sage/30',
  active: 'bg-sage/15 text-sage ring-sage/30',
  paid: 'bg-sage/15 text-sage ring-sage/30',
  draft: 'bg-amber/15 text-amber ring-amber/30',
  trial: 'bg-amber/15 text-amber ring-amber/30',
  due: 'bg-amber/15 text-amber ring-amber/30',
  paused: 'bg-hanko/15 text-hanko-text ring-hanko/30',
  overdue: 'bg-hanko/15 text-hanko-text ring-hanko/30',
  left: 'bg-raised text-muted ring-line',
}

// Colored status pill with a leading dot -- replaces bare grey status text.
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const style = STATUS_STYLES[status] ?? 'bg-raised text-muted ring-line'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ring-1 ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label ?? status}
    </span>
  )
}

export function PageTitle({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold uppercase tracking-wide text-text">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

// Compact KPI tile with a colored accent bar on the left.
export function StatTile({
  label,
  value,
  accent = 'bg-straw',
  hint,
}: {
  label: string
  value: ReactNode
  accent?: string
  hint?: string
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-line bg-panel p-4 pl-5 transition-colors hover:border-straw/30">
      <span className={`absolute inset-y-0 left-0 w-1 ${accent}`} />
      <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold text-text">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

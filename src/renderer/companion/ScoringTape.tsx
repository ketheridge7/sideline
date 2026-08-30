import type { JSX } from 'react'
import type { TapeEvent } from '@shared/types'
import { formatDelta } from '../shared/format'

const clock = (at: number): string => {
  if (!at) return '—'
  return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const kindBadge = (event: TapeEvent): { label: string; className: string } => {
  switch (event.kind) {
    case 'score':
      return {
        label: event.delta != null ? formatDelta(event.delta) : event.detail,
        className: (event.delta ?? 0) < 0 ? 'text-air' : 'text-lime'
      }
    case 'injury':
      return { label: 'Inj', className: 'text-air' }
    case 'add':
    case 'add_drop':
      return { label: 'Waiver', className: 'text-air' }
    case 'trade':
      return { label: 'Trade', className: 'text-lime' }
    case 'drop':
      return { label: 'Drop', className: 'text-muted' }
    case 'status':
      return { label: event.detail, className: 'text-muted' }
    default: {
      const _never: never = event.kind
      return _never
    }
  }
}

export const ScoringTape = ({ events }: { events: TapeEvent[] }): JSX.Element => {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-l border-line bg-card">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="font-cond text-[11px] font-bold uppercase tracking-[0.2em]">Scoring tape</h2>
        <span className="font-cond text-[10px] font-bold uppercase tracking-[0.16em] text-lime">Live</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {events.length === 0 ? (
          <p className="px-3 py-6 text-xs leading-relaxed text-muted">
            Tape is quiet. Transactions and point ticks land here — nothing is invented.
          </p>
        ) : (
          events.map((event) => {
            const badge = kindBadge(event)
            return (
              <div key={event.id} className="border-b border-line px-3 py-2">
                <div className="flex items-baseline gap-2 text-[10px] uppercase tracking-wide text-muted">
                  <span>{clock(event.at)}</span>
                  {event.leagueName ? <span className="truncate">{event.leagueName}</span> : null}
                </div>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{event.player}</span>
                  <span className={`shrink-0 font-cond text-sm font-bold uppercase tabular-nums ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>
                {event.kind === 'injury' ? (
                  <div className="text-[11px] uppercase tracking-wide text-air">{event.detail}</div>
                ) : event.kind !== 'score' ? (
                  <div className="text-[11px] text-muted">{event.detail}</div>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}

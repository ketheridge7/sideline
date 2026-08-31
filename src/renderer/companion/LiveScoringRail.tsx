import type { JSX } from 'react'
import type { TapeEvent } from '@shared/types'
import { formatDelta } from '../shared/format'

const clock = (at: number): string => {
  if (!at) return '—'
  return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const pipClass = (event: TapeEvent): string => {
  if (event.kind === 'score') return (event.delta ?? 0) < 0 ? 'bg-air' : 'bg-lime'
  if (event.kind === 'injury') return 'bg-air'
  if (event.kind === 'add' || event.kind === 'add_drop' || event.kind === 'trade') return 'bg-lime'
  return 'bg-muted'
}

const deltaClass = (event: TapeEvent): string => {
  if (event.kind === 'score') return (event.delta ?? 0) < 0 ? 'text-air' : 'text-lime'
  if (event.kind === 'injury') return 'text-air'
  if (event.kind === 'add' || event.kind === 'add_drop' || event.kind === 'trade') return 'text-lime'
  return 'text-muted'
}

const deltaLabel = (event: TapeEvent): string => {
  switch (event.kind) {
    case 'score':
      return event.delta != null ? formatDelta(event.delta) : event.detail
    case 'injury':
      return 'Inj'
    case 'add':
    case 'add_drop':
      return 'Waiver'
    case 'trade':
      return 'Trade'
    case 'drop':
      return 'Drop'
    case 'status':
      return event.detail
    default: {
      const _never: never = event.kind
      return _never
    }
  }
}

const lastToken = (value: string): string => {
  const parts = value.trim().split(/\s+/)
  return parts[0] || value
}

export const LiveScoringRail = ({
  events,
  onOpenBoard
}: {
  events: TapeEvent[]
  onOpenBoard: () => void
}): JSX.Element => {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-card">
      <div className="border-b border-line px-3 py-2">
        <h2 className="font-cond text-[11px] font-bold uppercase tracking-[0.2em]">Live scoring</h2>
        <div className="mt-0.5 font-cond text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
          All leagues
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {events.length === 0 ? (
          <p className="px-3 py-6 text-xs text-muted">Tape is quiet until the next tick.</p>
        ) : (
          events.map((event) => (
            <div key={event.id} className="flex items-start gap-2 border-b border-line px-3 py-2">
              <div className="w-10 shrink-0 font-cond text-[10px] uppercase tracking-wide text-muted">
                <div>{clock(event.at)}</div>
                {event.period ? <div>{event.period}</div> : null}
              </div>
              <span className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 ${pipClass(event)}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold uppercase">{lastToken(event.player)}</div>
                <div className="truncate text-[11px] text-muted">{event.leagueName}</div>
              </div>
              <span className={`shrink-0 font-cond text-sm font-bold tabular-nums ${deltaClass(event)}`}>
                {deltaLabel(event)}
              </span>
            </div>
          ))
        )}
      </div>
      <button
        type="button"
        onClick={onOpenBoard}
        className="cursor-pointer border-t border-line px-3 py-2 text-left font-cond text-[11px] font-bold uppercase tracking-[0.16em] text-you hover:text-text"
      >
        View full play-by-play →
      </button>
    </aside>
  )
}

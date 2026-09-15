import type { JSX } from 'react'
import type { TapeEvent } from '@shared/types'
import { formatDelta } from '../shared/format'

const kindBadge = (event: TapeEvent): { label: string; className: string } => {
  switch (event.kind) {
    case 'score':
      return {
        label: event.delta != null ? formatDelta(event.delta) : event.detail,
        className: (event.delta ?? 0) < 0 ? 'text-air' : 'text-lime'
      }
    case 'injury':
      return { label: '—', className: 'text-muted' }
    case 'add':
    case 'add_drop':
      return { label: 'Waiver', className: 'text-lime' }
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

const rowDetail = (event: TapeEvent): string | null => {
  switch (event.kind) {
    case 'score':
      return event.detail || null
    case 'injury':
      return event.detail || null
    case 'add':
    case 'add_drop':
    case 'trade':
    case 'drop':
    case 'status':
      return event.detail || null
    default: {
      const _never: never = event.kind
      return _never
    }
  }
}

export const ScoringTape = ({ events }: { events: TapeEvent[] }): JSX.Element => {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-l border-line bg-card" data-scoring-tape="selected">
      <div className="border-b border-line px-3 py-2">
        <h2 className="font-cond text-[11px] font-bold uppercase tracking-[0.2em]">Scoring tape</h2>
        <div className="mt-0.5 font-cond text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
          This matchup
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {events.length === 0 ? (
          <p className="px-3 py-6 text-xs leading-relaxed text-muted">
            Tape is quiet. Transactions and point ticks for this matchup land here — nothing is invented.
          </p>
        ) : (
          events.map((event) => {
            const badge = kindBadge(event)
            const scoreDelta = event.kind === 'score' && event.delta != null
            const detail = rowDetail(event)
            return (
              <div key={event.id} className="border-b border-line px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="min-w-0 truncate text-[13px] font-medium">{event.player}</span>
                      {event.kind === 'injury' ? (
                        <span className="shrink-0 bg-air/15 px-1 py-px font-cond text-[10px] font-bold uppercase tracking-wide text-air">
                          INJ
                        </span>
                      ) : null}
                    </div>
                    {detail && event.kind !== 'status' ? (
                      <div className="mt-0.5 text-[11px] text-muted">{detail}</div>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 font-cond text-sm font-bold uppercase tabular-nums ${badge.className}`}
                    data-tape-delta={scoreDelta ? event.delta : undefined}
                    data-score-tick={scoreDelta ? 'delta' : undefined}
                    data-score-tick-kind={
                      scoreDelta ? ((event.delta ?? 0) < 0 ? 'down' : 'up') : undefined
                    }
                  >
                    {badge.label}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}

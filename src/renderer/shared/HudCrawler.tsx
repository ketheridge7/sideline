import type { JSX } from 'react'
import type { TapeEvent } from '@shared/types'
import { formatDelta } from './format'

const eventTone = (event: TapeEvent): string => {
  switch (event.kind) {
    case 'score':
      return (event.delta ?? 0) < 0 ? 'text-air' : 'text-lime'
    case 'injury':
    case 'drop':
      return 'text-air'
    case 'trade':
    case 'add':
    case 'add_drop':
      return 'text-lime'
    case 'status':
      return 'text-muted'
    default: {
      const _never: never = event.kind
      return _never
    }
  }
}

const eventLabel = (event: TapeEvent): string => {
  switch (event.kind) {
    case 'score':
      return event.delta != null ? formatDelta(event.delta) : event.detail
    case 'injury':
      return event.detail
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

export const TapeItem = ({ event }: { event: TapeEvent }): JSX.Element => {
  const tone = eventTone(event)
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className={`shrink-0 font-cond text-[10px] font-bold uppercase tracking-[0.16em] ${tone}`}>
        {eventLabel(event)}
      </span>
      <span className="min-w-0 truncate font-medium">{event.player}</span>
      {event.kind === 'score' ? (
        <span className="truncate text-muted">{event.detail}</span>
      ) : (
        <span className="truncate text-muted">{event.leagueName}</span>
      )}
    </div>
  )
}

export const HudCrawler = ({ events }: { events: TapeEvent[] }): JSX.Element => {
  if (events.length === 0) {
    return <div className="h-full w-full" />
  }
  const loop = [...events, ...events]
  return (
    <div className="flex h-full items-center overflow-hidden px-3" aria-live="polite" aria-atomic="false">
      <div className="tape-crawl gap-8 pr-8 text-sm">
        {loop.map((event, index) => (
          <div key={`${event.id}:${index}`} className="shrink-0">
            <TapeItem event={event} />
          </div>
        ))}
      </div>
    </div>
  )
}

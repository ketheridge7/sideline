import { type JSX } from 'react'
import type { OverlayDensity, OverlayWidgetId } from '@shared/overlayLayout'
import type { OverlayHudState, Player, TapeEvent } from '@shared/types'
import { formatDelta, overlayName } from '../shared/format'
import { HudCrawler, ToastChip } from '../shared/HudCrawler'
import { ScoreTick } from '../shared/ScoreTick'
import { visibleInjury } from '@shared/display'
import { resolveDensity, type Density } from './density'
import type { OverlaySurface } from './subscribe'

const YOU = '#7DD3FC'
const THEM = '#94A3B8'

const scorePx = (density: Density): number => {
  switch (density) {
    case 'compact':
      return 32
    case 'regular':
      return 36
    case 'large':
      return 44
    default: {
      const _never: never = density
      return _never
    }
  }
}

const RailColumn = ({
  players,
  field,
  hash,
  align,
  restColor
}: {
  players: Player[]
  field: 'pos' | 'name' | 'nfl' | 'pts'
  hash?: 'you' | 'them'
  align: 'left' | 'right'
  restColor: string
}): JSX.Element => {
  const rows = Math.max(players.length, 1)
  return (
    <div
      className={`flex h-full min-h-0 min-w-0 flex-col py-0.5 ${
        hash === 'you' ? 'border-l border-you/70' : ''
      }`}
    >
      {Array.from({ length: rows }, (_, index) => {
        const player = players[index]
        const textAlign = align === 'right' ? 'text-right' : 'text-left'
        const injury = field === 'name' ? visibleInjury(player?.status) : null
        let body: JSX.Element | string = '—'
        let typeClass = 'font-cond font-semibold uppercase tracking-wide text-[13px] text-text'
        if (field === 'pos') {
          typeClass = 'font-cond font-medium uppercase tracking-wide text-[11px] text-muted'
          body = player?.position || '—'
        } else if (field === 'name') {
          typeClass = 'font-cond font-semibold uppercase tracking-wide text-[14px] text-text'
          body = player ? overlayName(player.name) : '—'
        } else if (field === 'nfl') {
          typeClass = 'font-cond font-medium uppercase tracking-wide text-[11px] text-muted'
          body = player?.nflTeam || '—'
        } else if (field === 'pts') {
          typeClass = 'font-cond text-[14px] font-bold tabular-nums'
          body = player ? (
            <ScoreTick
              value={player.points}
              restColor={restColor}
              align={align}
              className="w-full text-[14px] font-cond font-bold"
            />
          ) : (
            '—'
          )
        } else {
          const _never: never = field
          body = _never
        }
        return (
          <div
            key={player?.playerId ?? `${field}-${index}`}
            className={`flex min-h-0 flex-1 items-center px-0.5 ${textAlign} ${typeClass}`}
          >
            {typeof body === 'string' ? (
              <span className="w-full truncate">
                {body}
                {injury ? <span className="ml-1 text-air">{injury}</span> : null}
              </span>
            ) : (
              body
            )}
          </div>
        )
      })}
    </div>
  )
}

const BenchList = ({
  players,
  density,
  align
}: {
  players: Player[]
  density: Density
  align: 'left' | 'right'
}): JSX.Element => (
  <div className={`flex h-full flex-col justify-end gap-0.5 ${align === 'right' ? 'items-end' : ''}`}>
    {players.slice(0, 8).map((player) => (
      <div
        key={player.playerId}
        className={`truncate font-cond uppercase text-muted ${density === 'large' ? 'text-sm' : 'text-[11px]'}`}
      >
        {overlayName(player.name)}
      </div>
    ))}
  </div>
)

export const OverlayWidgetView = ({
  id,
  hud,
  surface,
  density,
  showCrawler
}: {
  id: OverlayWidgetId
  hud: OverlayHudState
  surface: OverlaySurface
  density: OverlayDensity
  showCrawler: boolean
}): JSX.Element => {
  const resolved = resolveDensity(surface, density)
  switch (id) {
    case 'meta.league':
      return (
        <div className="flex h-full items-center truncate font-medium uppercase tracking-[0.18em] text-[11px] text-muted">
          {hud.leagueName}
        </div>
      )
    case 'meta.week':
      return (
        <div className="flex h-full items-center font-medium uppercase tracking-[0.18em] text-[11px] text-muted">
          {hud.week != null ? `WK ${hud.week}` : '—'}
        </div>
      )
    case 'meta.live':
      if (!hud.pollingLive && !hud.replay) return <></>
      return (
        <div className="flex h-full items-center">
          <span className="live-dot inline-block h-1 w-1 bg-lime" aria-label={hud.replay ? 'Replay' : 'Live'} />
        </div>
      )
    case 'team.mine.name':
      return (
        <div className="flex h-full items-end truncate font-cond text-[11px] font-semibold uppercase tracking-[0.16em] text-you">
          {hud.myName}
        </div>
      )
    case 'team.opp.name':
      return (
        <div className="flex h-full items-end truncate font-cond text-[11px] font-semibold uppercase tracking-[0.16em] text-them">
          {hud.oppName}
        </div>
      )
    case 'score.mine':
      return (
        <ScoreTick
          value={hud.myPoints}
          restColor={YOU}
          className="h-full font-cond font-extrabold"
          style={{ fontSize: scorePx(resolved) }}
        />
      )
    case 'score.opp':
      return (
        <ScoreTick
          value={hud.oppPoints}
          restColor={THEM}
          className="h-full font-cond font-extrabold"
          style={{ fontSize: scorePx(resolved) }}
        />
      )
    case 'score.delta': {
      const leading = hud.delta > 0
      const trailing = hud.delta < 0
      const deltaClass = leading ? 'text-you' : trailing ? 'text-air' : 'text-muted'
      return (
        <div
          className={`flex h-full items-end font-cond text-[13px] font-bold uppercase tabular-nums ${deltaClass}`}
        >
          {formatDelta(hud.delta)}
        </div>
      )
    }
    case 'col.mine.pos':
      return <RailColumn players={hud.myStarters} field="pos" hash="you" align="left" restColor={YOU} />
    case 'col.mine.name':
      return <RailColumn players={hud.myStarters} field="name" align="left" restColor={YOU} />
    case 'col.mine.nfl':
      return <RailColumn players={hud.myStarters} field="nfl" align="left" restColor={YOU} />
    case 'col.mine.pts':
      return <RailColumn players={hud.myStarters} field="pts" align="left" restColor={YOU} />
    case 'col.opp.pos':
      return <RailColumn players={hud.oppStarters} field="pos" align="left" restColor={THEM} />
    case 'col.opp.name':
      return <RailColumn players={hud.oppStarters} field="name" align="left" restColor={THEM} />
    case 'col.opp.nfl':
      return <RailColumn players={hud.oppStarters} field="nfl" align="left" restColor={THEM} />
    case 'col.opp.pts':
      return <RailColumn players={hud.oppStarters} field="pts" align="left" restColor={THEM} />
    case 'bench.mine':
      return <BenchList players={hud.myBench} density={resolved} align="left" />
    case 'bench.opp':
      return <BenchList players={hud.oppBench} density={resolved} align="right" />
    case 'toast.slot': {
      const events: TapeEvent[] =
        hud.tape.length > 0
          ? hud.tape
          : hud.toast
            ? [
                {
                  id: hud.toast.id,
                  at: Date.now(),
                  kind: 'status',
                  player: hud.toast.title,
                  detail: hud.toast.body
                }
              ]
            : []
      return showCrawler ? <HudCrawler events={events} /> : <ToastChip events={events} />
    }
    default: {
      const _never: never = id
      return _never
    }
  }
}

import { useEffect, useRef, useState, type JSX } from 'react'
import type { OverlayDensity, OverlayWidgetId } from '@shared/overlayLayout'
import type { OverlayHudState, Player, TapeEvent } from '@shared/types'
import { formatDelta, formatScore, overlayName } from '../shared/format'
import { HudCrawler, ToastChip } from '../shared/HudCrawler'
import { nflTeamLabel, visibleInjury } from '@shared/display'
import { resolveDensity, type Density } from './density'
import type { OverlaySurface } from './subscribe'

const nameSize = (density: Density): string => {
  switch (density) {
    case 'compact':
      return 'text-[13px]'
    case 'regular':
      return 'text-[15px]'
    case 'large':
      return 'text-[22px]'
    default: {
      const _never: never = density
      return _never
    }
  }
}

const metaSize = (density: Density): string => {
  switch (density) {
    case 'compact':
      return 'text-[10px]'
    case 'regular':
      return 'text-[11px]'
    case 'large':
      return 'text-[16px]'
    default: {
      const _never: never = density
      return _never
    }
  }
}

const scorePx = (density: Density): number => {
  switch (density) {
    case 'compact':
      return 56
    case 'regular':
      return 96
    case 'large':
      return 128
    default: {
      const _never: never = density
      return _never
    }
  }
}

const YardNumber = ({
  value,
  color,
  density
}: {
  value: number
  color: string
  density: Density
}): JSX.Element => {
  const prev = useRef(value)
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (prev.current === value) return
    prev.current = value
    setFlash(true)
    const timer = window.setTimeout(() => setFlash(false), 280)
    return () => window.clearTimeout(timer)
  }, [value])
  return (
    <div
      className="font-cond font-extrabold leading-none tabular-nums"
      style={{
        fontSize: scorePx(density),
        color: flash ? '#B6FF3B' : color
      }}
    >
      {formatScore(value)}
    </div>
  )
}

const RailColumn = ({
  players,
  field,
  hash,
  align,
  density
}: {
  players: Player[]
  field: 'pos' | 'name' | 'nfl' | 'pts'
  hash?: 'you' | 'them'
  align: 'left' | 'right'
  density: Density
}): JSX.Element => {
  const rows = Math.max(players.length, 1)
  return (
    <div
      className={`flex h-full min-h-0 min-w-0 flex-col ${hash === 'you' ? 'border-l-2 border-you/70' : ''} ${
        hash === 'them' ? 'border-r-2 border-them/70' : ''
      }`}
    >
      {Array.from({ length: rows }, (_, index) => {
        const player = players[index]
        const textAlign = align === 'right' ? 'text-right' : 'text-left'
        let body = '—'
        if (player) {
          switch (field) {
            case 'pos':
              body = player.position || '—'
              break
            case 'name':
              body = overlayName(player.name)
              break
            case 'nfl':
              body = player.nflTeam || '—'
              break
            case 'pts':
              body = player.points == null ? '—' : formatScore(player.points)
              break
            default: {
              const _never: never = field
              body = _never
            }
          }
        }
        const muted = field === 'nfl' || field === 'pos' || !player
        const injury = field === 'name' ? visibleInjury(player?.status) : null
        const bodyText = field === 'nfl' ? nflTeamLabel(player?.nflTeam) || '—' : body
        return (
          <div
            key={player?.playerId ?? `${field}-${index}`}
            className={`flex min-h-0 flex-1 items-center px-0.5 font-cond uppercase tracking-wide ${textAlign} ${
              field === 'pts' ? 'tabular-nums font-bold' : 'font-semibold'
            } ${muted ? 'text-muted' : 'text-text'} ${nameSize(density)}`}
          >
            <span className="w-full truncate">
              {bodyText}
              {injury ? <span className="ml-1 text-air">{injury}</span> : null}
            </span>
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
        {overlayName(player.name)} {player.points == null ? '' : formatScore(player.points)}
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
        <div
          className={`flex h-full items-center truncate font-medium uppercase tracking-[0.18em] text-muted ${metaSize(resolved)}`}
        >
          {hud.leagueName}
        </div>
      )
    case 'meta.week':
      return (
        <div
          className={`flex h-full items-center font-medium uppercase tracking-[0.18em] text-muted ${metaSize(resolved)}`}
        >
          {hud.week != null ? `WK ${hud.week}` : '—'}
        </div>
      )
    case 'meta.live':
      if (hud.replay) {
        return (
          <div
            className={`flex h-full items-center font-cond font-bold uppercase tracking-[0.16em] text-muted ${metaSize(resolved)}`}
          >
            Replay
          </div>
        )
      }
      if (!hud.pollingLive) return <></>
      return (
        <div
          className={`flex h-full items-center gap-1.5 font-cond font-bold uppercase tracking-[0.16em] text-air ${metaSize(resolved)}`}
        >
          <span className="inline-block h-1.5 w-1.5 bg-air" aria-hidden="true" />
          On air
        </div>
      )
    case 'team.mine.name':
      return (
        <div
          className={`flex h-full items-end truncate font-cond font-bold uppercase tracking-[0.14em] text-you ${
            resolved === 'large' ? 'text-[26px]' : resolved === 'compact' ? 'text-sm' : 'text-lg'
          }`}
        >
          {hud.myName}
        </div>
      )
    case 'team.opp.name':
      return (
        <div
          className={`flex h-full items-end justify-end truncate font-cond font-bold uppercase tracking-[0.14em] text-them ${
            resolved === 'large' ? 'text-[26px]' : resolved === 'compact' ? 'text-sm' : 'text-lg'
          }`}
        >
          {hud.oppName}
        </div>
      )
    case 'score.mine':
      return (
        <YardNumber value={hud.myPoints} color="#7DD3FC" density={resolved} />
      )
    case 'score.opp':
      return (
        <div className="flex h-full justify-end">
          <YardNumber value={hud.oppPoints} color="#94A3B8" density={resolved} />
        </div>
      )
    case 'score.delta': {
      const leading = hud.delta > 0
      const trailing = hud.delta < 0
      const deltaClass = leading ? 'text-you' : trailing ? 'text-air' : 'text-muted'
      return (
        <div
          className={`flex h-full flex-col items-center justify-center border border-you/40 px-2 font-cond font-extrabold uppercase tracking-[0.14em] tabular-nums ${deltaClass} ${
            resolved === 'large' ? 'text-3xl' : resolved === 'compact' ? 'text-sm' : 'text-xl'
          }`}
        >
          <span className="text-[10px] tracking-[0.2em] text-muted">Lead</span>
          {formatDelta(hud.delta)}
        </div>
      )
    }
    case 'col.mine.pos':
      return <RailColumn players={hud.myStarters} field="pos" hash="you" align="left" density={resolved} />
    case 'col.mine.name':
      return <RailColumn players={hud.myStarters} field="name" align="left" density={resolved} />
    case 'col.mine.nfl':
      return <RailColumn players={hud.myStarters} field="nfl" align="left" density={resolved} />
    case 'col.mine.pts':
      return <RailColumn players={hud.myStarters} field="pts" align="left" density={resolved} />
    case 'col.opp.pos':
      return <RailColumn players={hud.oppStarters} field="pos" hash="them" align="right" density={resolved} />
    case 'col.opp.name':
      return <RailColumn players={hud.oppStarters} field="name" align="right" density={resolved} />
    case 'col.opp.nfl':
      return <RailColumn players={hud.oppStarters} field="nfl" align="right" density={resolved} />
    case 'col.opp.pts':
      return <RailColumn players={hud.oppStarters} field="pts" align="right" density={resolved} />
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

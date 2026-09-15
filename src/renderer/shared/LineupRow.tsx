import { type JSX } from 'react'
import type { Player } from '@shared/types'
import { nflTeamLabel, visibleInjury } from '@shared/display'
import { overlayName } from './format'
import { HUD_FROST } from './HudChrome'
import { LastTickMark, ScoreTick } from './ScoreTick'

export const HudRail = ({
  players,
  you
}: {
  players: Player[]
  you?: boolean
}): JSX.Element => (
  <StarterColumn players={players} you={you} hud compact />
)

export const BoardRails = ({
  mine,
  opp
}: {
  mine: Player[]
  opp: Player[]
}): JSX.Element => {
  const rows = Math.max(mine.length, opp.length, 1)
  return (
    <section className="grid min-h-0 flex-1 grid-cols-2 grid-rows-1 overflow-hidden">
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden px-5 py-3">
        <h2 className="mb-2 shrink-0 font-cond text-xs font-bold uppercase tracking-[0.18em] text-you">Starters</h2>
        <StarterColumn players={mine} you rows={rows} />
      </div>
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden px-5 py-3">
        <h2 className="mb-2 shrink-0 text-right font-cond text-xs font-bold uppercase tracking-[0.18em] text-them">Starters</h2>
        <StarterColumn players={opp} rows={rows} />
      </div>
    </section>
  )
}

const StarterColumn = ({
  players,
  you,
  hud,
  compact,
  rows
}: {
  players: Player[]
  you?: boolean
  hud?: boolean
  compact?: boolean
  rows?: number
}): JSX.Element => {
  const count = Math.max(rows ?? players.length, 1)
  return (
    <div
      className={`${hud ? 'hud-rail' : ''} flex h-full min-h-0 min-w-0 flex-col`}
      data-hud-rail={you ? 'mine' : 'opp'}
    >
      {Array.from({ length: count }, (_, index) => (
        <LineupRow
          key={players[index]?.playerId ?? `${you ? 'mine' : 'opp'}-${index}`}
          player={players[index]}
          compact={compact}
          you={you}
          hud={hud}
        />
      ))}
    </div>
  )
}

export const LineupRow = ({
  player,
  compact,
  tv,
  you,
  hud
}: {
  player?: Player
  compact?: boolean
  tv?: boolean
  you?: boolean
  hud?: boolean
}): JSX.Element => {
  const rowClass = hud
    ? 'lineup-row hud-rail-row'
    : `lineup-row ${compact ? (tv ? 'h-8' : 'h-[22px]') : 'min-h-11 flex-1'}`
  if (!player) {
    return <div className={rowClass} data-lineup-row="empty" />
  }
  const name = compact ? overlayName(player.name) : player.name
  const team = nflTeamLabel(player.nflTeam)
  const injury = visibleInjury(player.status)
  const posClass = hud
    ? 'hud-type-pos'
    : `font-cond font-bold uppercase tracking-wide text-muted ${
        compact ? (tv ? 'text-xs' : 'text-[10px]') : 'text-sm'
      }`
  const nameClass = hud
    ? 'hud-type-player min-w-0 truncate'
    : `min-w-0 truncate ${
        compact ? (tv ? 'text-base' : 'text-[11px]') : 'font-cond text-base font-semibold uppercase tracking-wide'
      }`
  const ptsClass = hud
    ? 'hud-type-pts w-full'
    : `w-full font-cond font-bold ${compact ? (tv ? 'text-lg' : 'text-[13px]') : 'text-xl'}`
  return (
    <div className={rowClass} data-lineup-row={you ? 'mine' : 'opp'}>
      <span className={`lineup-row-pos ${posClass}`} data-lineup-col="pos">
        {player.position || '—'}
      </span>
      <span className={`lineup-row-name ${nameClass}`} data-lineup-col="name">
        {name}
        {injury ? <span className="ml-1 text-[10px] font-semibold uppercase text-air">{injury}</span> : null}
        {!compact && player.lastPlay ? (
          <span className="ml-1.5 text-[10px] font-normal uppercase tracking-wide text-muted">{player.lastPlay}</span>
        ) : null}
        {!compact ? (
          <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted">{team}</span>
        ) : null}
      </span>
      <span className="lineup-row-pts" data-lineup-col="pts">
        {!compact ? <LastTickMark value={player.points} /> : null}
        <ScoreTick value={player.points} restColor={HUD_FROST} align="right" className={ptsClass} />
      </span>
    </div>
  )
}

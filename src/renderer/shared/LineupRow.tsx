import { type JSX } from 'react'
import type { Player } from '@shared/types'
import { nflTeamLabel, visibleInjury } from '@shared/display'
import { overlayName } from './format'
import { LastTickMark, ScoreTick } from './ScoreTick'

export const LineupRow = ({
  player,
  compact,
  mirror,
  tv,
  you
}: {
  player?: Player
  compact?: boolean
  mirror?: boolean
  tv?: boolean
  you?: boolean
}): JSX.Element => {
  if (!player) {
    return <div className={compact ? (tv ? 'h-8' : 'h-[22px]') : 'h-8'} />
  }
  const name = compact ? overlayName(player.name) : player.name
  const team = nflTeamLabel(player.nflTeam)
  const injury = visibleInjury(player.status)
  const restColor = you ? '#7DD3FC' : '#F4F6F8'
  const pos = (
    <span
      className={`shrink-0 font-cond font-bold uppercase tracking-wide text-muted ${
        compact ? (tv ? 'w-9 text-xs' : 'w-7 text-[10px]') : 'w-10 text-sm'
      }`}
    >
      {player.position || '—'}
    </span>
  )
  const label = (
    <span
      className={`min-w-0 flex-1 truncate ${
        compact ? (tv ? 'text-base' : 'text-[11px]') : 'font-cond text-base font-semibold uppercase tracking-wide'
      }`}
    >
      {name}
      {!compact && player.lastPlay ? (
        <span className="ml-1.5 text-[10px] font-normal uppercase tracking-wide text-muted">{player.lastPlay}</span>
      ) : null}
    </span>
  )
  const nfl = !compact ? (
    <span className="w-8 shrink-0 text-right text-[10px] uppercase tracking-wide text-muted">{team}</span>
  ) : null
  const score = (
    <span className="flex shrink-0 items-center gap-0.5">
      {!compact ? <LastTickMark value={player.points} /> : null}
      <ScoreTick
        value={player.points}
        restColor={restColor}
        align="right"
        className={`shrink-0 font-cond font-bold ${
          compact ? (tv ? 'w-12 text-lg' : 'w-9 text-[13px]') : 'w-16 text-xl'
        }`}
      />
    </span>
  )
  const status = injury ? (
    <span className="shrink-0 text-[10px] font-semibold uppercase text-air">{injury}</span>
  ) : null
  return (
    <div
      className={`flex items-center gap-2 ${
        compact ? (tv ? 'h-8' : 'h-[22px]') : 'min-h-11 flex-1'
      }`}
    >
      {mirror ? (
        <>
          {score}
          {status}
          {nfl}
          {label}
          {pos}
        </>
      ) : (
        <>
          {pos}
          {label}
          {status}
          {nfl}
          {score}
        </>
      )}
    </div>
  )
}

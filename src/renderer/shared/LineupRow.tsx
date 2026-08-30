import { type JSX } from 'react'
import type { Player } from '@shared/types'
import { nflTeamLabel, visibleInjury } from '@shared/display'
import { overlayName } from './format'
import { ScoreTick } from './ScoreTick'

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
        compact ? (tv ? 'w-9 text-xs' : 'w-7 text-[10px]') : 'w-8 text-[11px]'
      }`}
    >
      {player.position || '—'}
    </span>
  )
  const label = (
    <span className={`min-w-0 flex-1 truncate ${compact ? (tv ? 'text-base' : 'text-[11px]') : 'text-[13px]'}`}>
      {name}
    </span>
  )
  const nfl = !compact ? (
    <span className="w-8 shrink-0 text-right text-[10px] uppercase tracking-wide text-muted">{team}</span>
  ) : null
  const score = (
    <ScoreTick
      value={player.points}
      restColor={restColor}
      align="right"
      className={`shrink-0 font-cond font-bold ${
        compact ? (tv ? 'w-12 text-lg' : 'w-9 text-[13px]') : 'w-12 text-base'
      }`}
    />
  )
  const status = injury ? (
    <span className="shrink-0 text-[10px] font-semibold uppercase text-air">{injury}</span>
  ) : null
  return (
    <div
      className={`flex items-center gap-1.5 ${
        compact ? (tv ? 'h-8' : 'h-[22px]') : 'h-8 border-b border-line/80 last:border-0'
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

import type { JSX } from 'react'
import type { Player } from '@shared/types'
import { formatScore, overlayName } from './format'

export const LineupRow = ({
  player,
  compact,
  mirror,
  tv
}: {
  player?: Player
  compact?: boolean
  mirror?: boolean
  tv?: boolean
}): JSX.Element => {
  if (!player) {
    return <div className={compact ? (tv ? 'h-8' : 'h-[22px]') : 'h-11'} />
  }
  const pts = player.points == null ? '—' : formatScore(player.points)
  const name = compact ? overlayName(player.name) : player.name
  const pos = (
    <span
      className={`shrink-0 font-semibold uppercase tracking-wide text-muted ${
        compact ? (tv ? 'w-9 text-xs' : 'w-7 text-[10px]') : 'w-10 text-xs'
      }`}
    >
      {player.position || '—'}
    </span>
  )
  const label = (
    <span className={`min-w-0 flex-1 truncate ${compact ? (tv ? 'text-base' : 'text-[11px]') : 'text-sm'}`}>
      {name}
    </span>
  )
  const score = (
    <span
      className={`shrink-0 font-cond font-bold tabular-nums ${
        compact ? (tv ? 'w-12 text-right text-lg' : 'w-9 text-right text-[13px]') : 'w-14 text-right text-lg'
      }`}
    >
      {pts}
    </span>
  )
  const status = player.status ? (
    <span className="shrink-0 text-[10px] font-semibold uppercase text-air">{player.status}</span>
  ) : null
  return (
    <div
      className={`flex items-center gap-1.5 ${
        compact ? (tv ? 'h-8' : 'h-[22px]') : 'h-11 border-b border-line/80 last:border-0'
      }`}
    >
      {mirror ? (
        <>
          {score}
          {status}
          {label}
          {pos}
        </>
      ) : (
        <>
          {pos}
          {label}
          {status}
          {!compact ? <span className="w-8 text-right text-[11px] text-muted">{player.nflTeam}</span> : null}
          {score}
        </>
      )}
    </div>
  )
}

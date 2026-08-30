import { useEffect, useRef, useState, type JSX } from 'react'
import type { Player } from '@shared/types'
import { nflTeamLabel, visibleInjury } from '@shared/display'
import { formatScore, overlayName } from './format'

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
  const prevPts = useRef<number | undefined>(undefined)
  const [tick, setTick] = useState<'up' | 'down' | null>(null)
  useEffect(() => {
    if (player?.points == null) return
    if (prevPts.current != null && player.points !== prevPts.current) {
      setTick(player.points > prevPts.current ? 'up' : 'down')
    }
    prevPts.current = player.points
  }, [player?.points])

  if (!player) {
    return <div className={compact ? (tv ? 'h-8' : 'h-[22px]') : 'h-8'} />
  }
  const pts = player.points == null ? '—' : formatScore(player.points)
  const name = compact ? overlayName(player.name) : player.name
  const team = nflTeamLabel(player.nflTeam)
  const injury = visibleInjury(player.status)
  const ptsColor = you ? 'text-you' : 'text-text'
  const tickMark =
    tick === 'up' ? (
      <span className="w-2 text-[10px] text-lime" aria-hidden="true">
        ▲
      </span>
    ) : tick === 'down' ? (
      <span className="w-2 text-[10px] text-air" aria-hidden="true">
        ▼
      </span>
    ) : (
      <span className="w-2" aria-hidden="true" />
    )
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
    <span
      className={`shrink-0 font-cond font-bold tabular-nums ${ptsColor} ${
        compact ? (tv ? 'w-12 text-right text-lg' : 'w-9 text-right text-[13px]') : 'w-12 text-right text-base'
      }`}
    >
      {pts}
    </span>
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
          {tickMark}
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
          {tickMark}
        </>
      )}
    </div>
  )
}

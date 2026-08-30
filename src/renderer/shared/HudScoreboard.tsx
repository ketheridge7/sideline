import type { JSX } from 'react'
import type { Matchup } from '@shared/types'
import { formatDelta, formatScore } from './format'

export const HudScoreboard = ({ matchup }: { matchup: Matchup }): JSX.Element => {
  const delta = matchup.myPoints - matchup.oppPoints
  const bye = !matchup.oppTeam
  return (
    <div
      className="grid grid-cols-[1fr_auto_1fr] items-end gap-4 border-y border-line bg-card px-6 py-4"
      aria-live="polite"
    >
      <div className="border-l-[3px] border-you pl-4">
        <div className="text-xs uppercase tracking-[0.16em] text-muted">{matchup.myTeam.owner}</div>
        <div className="font-cond text-xl font-bold uppercase">{matchup.myTeam.name}</div>
        <div className="text-xs text-muted">{matchup.myTeam.record}</div>
        <div className="mt-1 font-cond text-5xl font-extrabold leading-none tabular-nums">
          {formatScore(matchup.myPoints)}
        </div>
      </div>
      <div className="text-center">
        <div
          className={`font-cond text-2xl font-extrabold tabular-nums ${
            delta > 0 ? 'text-you' : 'text-muted'
          }`}
        >
          {formatDelta(delta)}
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted">delta</div>
      </div>
      <div className={`border-r-[3px] pr-4 text-right ${bye ? 'border-line' : 'border-them'}`}>
        <div className="text-xs uppercase tracking-[0.16em] text-muted">
          {matchup.oppTeam?.owner ?? 'Bye'}
        </div>
        <div className="font-cond text-xl font-bold uppercase text-them">
          {matchup.oppTeam?.name ?? 'BYE'}
        </div>
        <div className="text-xs text-muted">{matchup.oppTeam?.record ?? ''}</div>
        <div className="mt-1 font-cond text-5xl font-extrabold leading-none tabular-nums text-them">
          {formatScore(matchup.oppPoints)}
        </div>
      </div>
    </div>
  )
}

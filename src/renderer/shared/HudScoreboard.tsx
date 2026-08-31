import type { JSX } from 'react'
import type { Matchup } from '@shared/types'
import { LeadBar } from './LeadBar'
import { ScoreTick } from './ScoreTick'

export const HudScoreboard = ({ matchup }: { matchup: Matchup }): JSX.Element => {
  const bye = !matchup.oppTeam
  return (
    <div className="border-b border-line bg-card px-5 py-3" aria-live="polite">
      <div className="grid grid-cols-[1fr_minmax(8rem,12rem)_1fr] items-end gap-4">
        <div>
          {matchup.myTeam.owner ? (
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted">{matchup.myTeam.owner}</div>
          ) : null}
          <div className="truncate font-cond text-xl font-bold uppercase tracking-wide text-you">
            {matchup.myTeam.name}
          </div>
          <div className="text-[11px] text-muted">{matchup.myTeam.record}</div>
          <ScoreTick
            value={matchup.myPoints}
            restColor="#F4F6F8"
            className="mt-1 font-cond text-6xl font-extrabold leading-none"
          />
        </div>
        <LeadBar mine={matchup.myPoints} opp={matchup.oppPoints} />
        <div className="text-right">
          {matchup.oppTeam?.owner ? (
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted">{matchup.oppTeam.owner}</div>
          ) : null}
          <div className={`truncate font-cond text-xl font-bold uppercase tracking-wide ${bye ? 'text-muted' : 'text-them'}`}>
            {matchup.oppTeam?.name ?? 'BYE'}
          </div>
          <div className="text-[11px] text-muted">{matchup.oppTeam?.record ?? ''}</div>
          <ScoreTick
            value={matchup.oppPoints}
            restColor="#94A3B8"
            align="right"
            className="mt-1 font-cond text-6xl font-extrabold leading-none"
          />
        </div>
      </div>
    </div>
  )
}

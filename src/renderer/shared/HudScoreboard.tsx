import type { JSX } from 'react'
import type { Matchup } from '@shared/types'
import { LeadBar } from './LeadBar'
import { ScoreTick } from './ScoreTick'

export const HudScoreboard = ({
  matchup,
  needsSignIn = false
}: {
  matchup: Matchup
  needsSignIn?: boolean
}): JSX.Element => {
  const bye = !matchup.oppTeam
  const opponentName = matchup.oppTeam?.name ?? (needsSignIn ? 'Sign in' : 'BYE')
  return (
    <div className="px-6 py-5" aria-live="polite">
      <div className="grid grid-cols-[1fr_minmax(7rem,11rem)_1fr] items-end gap-6">
        <div className="min-w-0 text-center">
          {matchup.myTeam.owner ? (
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted">{matchup.myTeam.owner}</div>
          ) : null}
          <div className="truncate font-cond text-4xl font-extrabold uppercase tracking-[0.06em] text-you">
            {matchup.myTeam.name}
          </div>
          <div className="text-xs text-muted">{matchup.myTeam.record}</div>
          <ScoreTick
            value={matchup.myPoints}
            restColor="#F8FBFF"
            align="center"
            className="mt-1 font-cond text-7xl font-extrabold leading-none"
          />
        </div>
        <LeadBar mine={matchup.myPoints} opp={matchup.oppPoints} />
        <div className="min-w-0 text-center">
          {matchup.oppTeam?.owner ? (
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted">{matchup.oppTeam.owner}</div>
          ) : null}
          <div
            className={`truncate font-cond text-4xl font-extrabold uppercase tracking-[0.06em] ${
              bye ? 'text-muted' : 'text-them'
            }`}
          >
            {opponentName}
          </div>
          <div className="text-xs text-muted">{matchup.oppTeam?.record ?? ''}</div>
          <ScoreTick
            value={matchup.oppPoints}
            restColor="#E8E4DC"
            align="center"
            className="mt-1 font-cond text-7xl font-extrabold leading-none"
          />
        </div>
      </div>
    </div>
  )
}

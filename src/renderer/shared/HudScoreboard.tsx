import type { JSX } from 'react'
import type { Matchup } from '@shared/types'
import { matchupChanceToWin, matchupWinPctSource } from '@shared/display'
import { HudTeamName, HudTeamScore } from './HudChrome'
import { LeadBar } from './LeadBar'

export const HudScoreboard = ({
  matchup,
  needsSignIn = false,
  showOwners = true
}: {
  matchup: Matchup
  needsSignIn?: boolean
  showOwners?: boolean
}): JSX.Element => {
  const bye = !matchup.oppTeam
  const opponentName = matchup.oppTeam?.name ?? (needsSignIn ? 'Sign in' : 'BYE')
  return (
    <div className="px-6 py-5" aria-live="polite">
      <div className="grid grid-cols-[1fr_minmax(7rem,11rem)_1fr] items-end gap-6">
        <div className="min-w-0 text-center">
          {showOwners && matchup.myTeam.owner ? (
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted" data-team-owner="mine">
              {matchup.myTeam.owner}
            </div>
          ) : null}
          <HudTeamName name={matchup.myTeam.name} tone="you" surface="board" />
          <div className="text-xs text-muted">{matchup.myTeam.record}</div>
          <HudTeamScore value={matchup.myPoints} tone="you" surface="board" />
        </div>
        <LeadBar
          mine={matchup.myPoints}
          opp={matchup.oppPoints}
          chance={matchupChanceToWin(matchup)}
          source={matchupWinPctSource(matchup)}
        />
        <div className="min-w-0 text-center">
          {showOwners && matchup.oppTeam?.owner ? (
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted" data-team-owner="opp">
              {matchup.oppTeam.owner}
            </div>
          ) : null}
          <HudTeamName name={opponentName} tone="them" surface="board" muted={bye} />
          <div className="text-xs text-muted">{matchup.oppTeam?.record ?? ''}</div>
          <HudTeamScore value={matchup.oppPoints} tone="them" surface="board" />
        </div>
      </div>
    </div>
  )
}

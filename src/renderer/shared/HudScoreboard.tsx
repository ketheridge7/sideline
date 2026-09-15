import type { JSX } from 'react'
import { Pin } from 'lucide-react'
import type { Matchup } from '@shared/types'

const pinName = (value: string | undefined, fallback: string): string => {
  const name = value?.trim()
  return name ? name : fallback
}

export const HudScoreboard = ({
  matchup,
  needsSignIn = false
}: {
  matchup: Matchup
  needsSignIn?: boolean
}): JSX.Element => {
  const bye = !matchup.oppTeam
  const myName = pinName(matchup.myTeam.name, matchup.myTeam.owner.trim() || '—')
  const opponentName = pinName(matchup.oppTeam?.name, needsSignIn ? 'Sign in' : 'BYE')
  return (
    <div className="shrink-0 border-b border-line px-5 py-3" data-hud-scoreboard="pin" aria-live="polite">
      <div className="mb-3 flex items-center gap-1.5 font-cond text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
        <Pin className="h-3 w-3 text-lime" aria-hidden="true" />
        Pinned
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="min-w-0">
          <div
            className="truncate font-cond text-3xl font-extrabold uppercase tracking-[0.06em] text-text"
            data-hud="team-name"
            data-hud-side="mine"
          >
            {myName}
          </div>
          <div className="mt-0.5 font-cond text-[11px] font-bold uppercase tracking-[0.16em] text-you">Ice-lime</div>
        </div>
        <div className="text-center font-cond text-sm font-bold uppercase tracking-[0.2em] text-muted">Vs</div>
        <div className="min-w-0 text-right">
          <div
            className={`truncate font-cond text-3xl font-extrabold uppercase tracking-[0.06em] ${
              bye ? 'text-muted' : 'text-text'
            }`}
            data-hud="team-name"
            data-hud-side="opp"
          >
            {opponentName}
          </div>
          <div className="mt-0.5 font-cond text-[11px] font-bold uppercase tracking-[0.16em] text-them">Silver</div>
        </div>
      </div>
    </div>
  )
}

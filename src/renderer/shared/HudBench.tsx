import type { JSX } from 'react'
import type { Player } from '@shared/types'
import { nflTeamLabel, visibleInjury } from '@shared/display'
import { overlayName } from './format'
import { LastTickMark, ScoreTick } from './ScoreTick'

export const HudBench = ({
  players,
  label,
  mirror
}: {
  players: Player[]
  label: string
  mirror?: boolean
}): JSX.Element => {
  if (players.length === 0) {
    return (
      <div className={`border-t border-line px-4 py-2 ${mirror ? 'text-right' : ''}`}>
        <span className="font-cond text-[10px] font-bold uppercase tracking-[0.2em] text-muted">{label}</span>
        <span className="ml-2 text-xs text-muted">Empty</span>
      </div>
    )
  }
  return (
    <div className={`border-t border-line px-4 py-2 ${mirror ? 'text-right' : ''}`}>
      <div
        className={`mb-1 font-cond text-[10px] font-bold uppercase tracking-[0.2em] text-muted ${
          mirror ? 'text-them' : 'text-you'
        }`}
      >
        {label}
      </div>
      <div className={`flex gap-1.5 overflow-x-auto ${mirror ? 'flex-row-reverse' : ''}`}>
        {players.map((player) => {
          const injury = visibleInjury(player.status)
          return (
            <div
              key={player.playerId}
              className={`shrink-0 border border-line bg-bg px-2 py-1 text-xs ${
                injury ? 'text-muted' : ''
              }`}
            >
              <span className="font-cond uppercase text-muted">{injury || player.position || 'BN'}</span>{' '}
              {overlayName(player.name)}{' '}
              <span className="uppercase text-muted">{nflTeamLabel(player.nflTeam)}</span>{' '}
              <LastTickMark value={player.points} />
              <ScoreTick
                value={player.points}
                restColor="#94A3B8"
                className="inline-block font-cond text-xs font-bold tabular-nums"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

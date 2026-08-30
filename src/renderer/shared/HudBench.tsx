import type { JSX } from 'react'
import type { Player } from '@shared/types'
import { formatScore, overlayName } from './format'

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
      <div className={`border-t border-line px-5 py-2 ${mirror ? 'text-right' : ''}`}>
        <span className="font-cond text-[10px] font-bold uppercase tracking-[0.2em] text-muted">{label}</span>
        <span className="ml-2 text-xs text-muted">Empty</span>
      </div>
    )
  }
  return (
    <div className={`border-t border-line px-5 py-2 ${mirror ? 'text-right' : ''}`}>
      <div
        className={`mb-1 font-cond text-[10px] font-bold uppercase tracking-[0.2em] text-muted ${
          mirror ? 'text-them' : 'text-you'
        }`}
      >
        {label}
      </div>
      <div className={`flex gap-1.5 overflow-x-auto ${mirror ? 'flex-row-reverse' : ''}`}>
        {players.map((player) => (
          <div
            key={player.playerId}
            className={`shrink-0 rounded-md border border-line bg-bg px-2 py-1 text-xs ${
              player.status && /out|ir/i.test(player.status) ? 'text-muted' : ''
            }`}
          >
            <span className="font-cond uppercase text-muted">{player.status || 'BN'}</span>{' '}
            {overlayName(player.name)}{' '}
            <span className="tabular-nums text-muted">
              {player.points == null ? '—' : formatScore(player.points)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

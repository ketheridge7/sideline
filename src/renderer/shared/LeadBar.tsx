import type { JSX } from 'react'
import type { ChanceToWin } from '@shared/winPct'
import { chanceToWinPercents } from '@shared/winPct'
import { LeadChip } from './HudChrome'

export const LeadBar = ({
  mine,
  opp,
  chance,
  compact
}: {
  mine: number
  opp: number
  chance: ChanceToWin | null
  compact?: boolean
}): JSX.Element => {
  const delta = Math.round((mine - opp) * 100) / 100
  const percents = chance ? chanceToWinPercents(chance) : null
  const mineWidth = chance ? `${chance.mine * 100}%` : '50%'
  const oppWidth = chance ? `${chance.opp * 100}%` : '50%'
  const label = percents
    ? `Chance to win ${percents.mine}% vs ${percents.opp}%`
    : 'Chance to win unavailable'
  return (
    <div className={`flex flex-col justify-end ${compact ? 'gap-1' : 'gap-1.5'}`}>
      {!compact ? (
        <div className="text-center font-cond text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
          Chance to win
        </div>
      ) : null}
      {chance ? (
        <div
          className={`flex overflow-hidden bg-line ${compact ? 'h-1' : 'h-1.5'}`}
          aria-label={label}
          data-hud="win-pct-bar"
        >
          <div className="h-full bg-you" style={{ width: mineWidth }} />
          <div className="h-full bg-them/50" style={{ width: oppWidth }} />
        </div>
      ) : (
        <div
          className={`bg-line ${compact ? 'h-1' : 'h-1.5'}`}
          aria-label={label}
          data-hud="win-pct-bar"
          data-hud-win-pct="pending"
        />
      )}
      {!compact ? (
        <div className="flex justify-between font-cond text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
          {percents ? (
            <>
              <span data-hud="win-pct" data-hud-side="mine">
                {percents.mine}% Win
              </span>
              <span data-hud="win-pct" data-hud-side="opp">
                {percents.opp}% Win
              </span>
            </>
          ) : (
            <span className="w-full text-center" data-hud="win-pct" data-hud-win-pct="pending">
              Win% pending
            </span>
          )}
        </div>
      ) : null}
      <LeadChip delta={delta} surface="board" />
    </div>
  )
}

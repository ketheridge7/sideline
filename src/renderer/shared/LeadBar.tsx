import type { JSX } from 'react'
import type { ChanceToWin, WinPctSource } from '@shared/winPct'
import { chanceToWinPercents } from '@shared/winPct'
import { LeadChip } from './HudChrome'

const winPctCopy = (
  source: WinPctSource,
  percents: { mine: number; opp: number } | null
): { header: string; pending: string; aria: string; mine: string; opp: string } => {
  switch (source) {
    case 'official':
      return {
        header: 'Chance to win',
        pending: 'Win% pending',
        aria: percents ? `Chance to win ${percents.mine}% vs ${percents.opp}%` : 'Chance to win unavailable',
        mine: percents ? `${percents.mine}% Win` : '',
        opp: percents ? `${percents.opp}% Win` : ''
      }
    case 'estimated':
      return {
        header: 'Est. win%',
        pending: 'Est. win% pending',
        aria: percents ? `Estimated win ${percents.mine}% vs ${percents.opp}%` : 'Estimated win unavailable',
        mine: percents ? `${percents.mine}% Est.` : '',
        opp: percents ? `${percents.opp}% Est.` : ''
      }
    default: {
      const _never: never = source
      return _never
    }
  }
}

export const LeadBar = ({
  mine,
  opp,
  chance,
  source = 'official',
  compact
}: {
  mine: number
  opp: number
  chance: ChanceToWin | null
  source?: WinPctSource
  compact?: boolean
}): JSX.Element => {
  const delta = Math.round((mine - opp) * 100) / 100
  const percents = chance ? chanceToWinPercents(chance) : null
  const copy = winPctCopy(source, percents)
  const mineWidth = chance ? `${chance.mine * 100}%` : '50%'
  const oppWidth = chance ? `${chance.opp * 100}%` : '50%'
  return (
    <div className={`flex flex-col justify-end ${compact ? 'gap-1' : 'gap-1.5'}`}>
      {!compact ? (
        <div className="text-center font-cond text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
          {copy.header}
        </div>
      ) : null}
      {chance ? (
        <div
          className={`flex overflow-hidden bg-line ${compact ? 'h-1' : 'h-1.5'}`}
          aria-label={copy.aria}
          data-hud="win-pct-bar"
          data-hud-win-pct-source={source}
        >
          <div className="h-full bg-you" style={{ width: mineWidth }} />
          <div className="h-full bg-them/50" style={{ width: oppWidth }} />
        </div>
      ) : (
        <div
          className={`bg-line ${compact ? 'h-1' : 'h-1.5'}`}
          aria-label={copy.aria}
          data-hud="win-pct-bar"
          data-hud-win-pct="pending"
          data-hud-win-pct-source={source}
        />
      )}
      {!compact ? (
        <div className="flex justify-between font-cond text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
          {percents ? (
            <>
              <span data-hud="win-pct" data-hud-side="mine" data-hud-win-pct-source={source}>
                {copy.mine}
              </span>
              <span data-hud="win-pct" data-hud-side="opp" data-hud-win-pct-source={source}>
                {copy.opp}
              </span>
            </>
          ) : (
            <span className="w-full text-center" data-hud="win-pct" data-hud-win-pct="pending" data-hud-win-pct-source={source}>
              {copy.pending}
            </span>
          )}
        </div>
      ) : null}
      <LeadChip delta={delta} surface="board" />
    </div>
  )
}

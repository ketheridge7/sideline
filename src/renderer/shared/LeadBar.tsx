import type { JSX } from 'react'
import { leadShare } from '@shared/display'
import { LeadChip } from './HudChrome'

export const LeadBar = ({
  mine,
  opp,
  compact
}: {
  mine: number
  opp: number
  compact?: boolean
}): JSX.Element => {
  const share = leadShare(mine, opp)
  const delta = Math.round((mine - opp) * 100) / 100
  return (
    <div className={`flex flex-col justify-end ${compact ? 'gap-1' : 'gap-1.5'}`}>
      <div
        className={`flex overflow-hidden bg-line ${compact ? 'h-1' : 'h-1.5'}`}
        aria-hidden="true"
      >
        <div className="h-full bg-you" style={{ width: `${share.mine * 100}%` }} />
        <div className="h-full bg-them/50" style={{ width: `${share.opp * 100}%` }} />
      </div>
      {!compact ? (
        <div className="flex justify-between font-cond text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
          <span>{Math.round(share.mine * 100)}%</span>
          <span>{Math.round(share.opp * 100)}%</span>
        </div>
      ) : null}
      <LeadChip delta={delta} surface="board" />
    </div>
  )
}

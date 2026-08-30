import type { JSX } from 'react'
import { leadShare } from '@shared/display'
import { formatDelta } from './format'

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
  const leading = delta > 0
  const trailing = delta < 0
  return (
    <div className={`flex flex-col justify-end ${compact ? 'gap-1' : 'gap-1.5'}`}>
      <div className={`flex overflow-hidden bg-line ${compact ? 'h-1' : 'h-1.5'}`} aria-hidden="true">
        <div className="h-full bg-you" style={{ width: `${share.mine * 100}%` }} />
        <div className="h-full bg-them/50" style={{ width: `${share.opp * 100}%` }} />
      </div>
      <div
        className={`text-center font-cond font-extrabold uppercase tracking-[0.14em] tabular-nums ${
          leading ? 'text-you' : trailing ? 'text-air' : 'text-muted'
        } ${compact ? 'text-[11px]' : 'text-sm'}`}
      >
        {delta === 0 ? 'Tied' : `${leading ? 'Lead' : 'Trail'} ${formatDelta(delta)}`}
      </div>
    </div>
  )
}

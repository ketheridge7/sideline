import type { JSX } from 'react'
import type { League } from '@shared/types'

export const ProviderBadge = ({ provider }: { provider: League['provider'] }): JSX.Element => {
  const sleeper = provider === 'sleeper'
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        sleeper ? 'bg-sleeper/15 text-sleeper' : 'bg-espn/15 text-espn'
      }`}
    >
      {sleeper ? 'Sleeper' : 'ESPN'}
    </span>
  )
}

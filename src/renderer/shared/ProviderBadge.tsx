import type { JSX } from 'react'
import type { League } from '@shared/types'

export const ProviderBadge = ({
  provider,
  stamp
}: {
  provider: League['provider']
  stamp?: boolean
}): JSX.Element => {
  const sleeper = provider === 'sleeper'
  const label = sleeper ? 'Sleeper' : 'ESPN'
  if (stamp) {
    return (
      <span
        className={`inline-block h-1.5 w-1.5 shrink-0 ${sleeper ? 'bg-sleeper' : 'bg-espn'}`}
        title={label}
        aria-label={label}
      />
    )
  }
  return (
    <span
      className={`px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
        sleeper ? 'text-sleeper' : 'text-espn'
      }`}
    >
      {sleeper ? 'SL' : 'ES'}
    </span>
  )
}

import { useMemo, type JSX } from 'react'
import type { AppState } from '@shared/types'
import { leagueKey } from '@shared/types'
import { ProviderBadge } from '../shared/ProviderBadge'

const api = (): NonNullable<Window['sideline']> => {
  if (!window.sideline) throw new Error('Sideline preload missing')
  return window.sideline
}

export const ChannelStrip = ({ state }: { state: AppState }): JSX.Element | null => {
  const channels = useMemo(() => {
    const pinned = state.leagues.filter((league) =>
      state.pinnedLeagueKeys.includes(leagueKey(league.provider, league.id))
    )
    return pinned.length > 0 ? pinned : state.leagues
  }, [state.leagues, state.pinnedLeagueKeys])

  if (channels.length === 0) return null

  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-line px-5 py-2" role="tablist">
      {channels.map((league) => {
        const key = leagueKey(league.provider, league.id)
        const selected = state.selectedLeagueKey === key
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-current={selected ? 'true' : undefined}
            onClick={() => void api().selectLeague(key)}
            className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1 text-sm transition-colors duration-200 ${
              selected ? 'border-you/50 bg-card text-text' : 'border-line text-muted hover:text-text'
            }`}
          >
            <ProviderBadge provider={league.provider} />
            <span className="max-w-40 truncate">{league.name}</span>
          </button>
        )
      })}
    </div>
  )
}

import type { JSX } from 'react'
import { Pin } from 'lucide-react'
import type { AppState } from '@shared/types'
import { leagueKey } from '@shared/types'
import { ProviderBadge } from '../shared/ProviderBadge'

const api = (): NonNullable<Window['sideline']> => {
  if (!window.sideline) throw new Error('Sideline preload missing')
  return window.sideline
}

export const BoardsScreen = ({ state }: { state: AppState }): JSX.Element => {
  const pinned = new Set(state.pinnedLeagueKeys)

  const handlePin = (key: string): void => {
    const next = pinned.has(key)
      ? state.pinnedLeagueKeys.filter((row) => row !== key)
      : [...state.pinnedLeagueKeys, key]
    void api().setPinned(next)
  }

  if (state.leagues.length === 0) {
    return (
      <div className="p-8 text-sm text-muted">
        Connect Sleeper or ESPN, then your leagues will land here. Pin the Sunday boards you want in the
        channel strip.
      </div>
    )
  }

  return (
    <div className="grid gap-2 p-5">
      <p className="mb-2 text-sm text-muted">Pin Sunday boards, then open one as the live companion.</p>
      {state.leagues.map((league) => {
        const key = leagueKey(league.provider, league.id)
        const selected = state.selectedLeagueKey === key
        return (
          <div
            key={key}
            className={`flex items-center gap-3 rounded-sm border px-4 py-3 ${
              selected ? 'border-you/40 bg-card' : 'border-line bg-card/60'
            }`}
          >
            <button
              type="button"
              onClick={() => handlePin(key)}
              className={`cursor-pointer rounded p-1 transition-colors duration-200 ${
                pinned.has(key) ? 'text-you' : 'text-muted hover:text-text'
              }`}
              aria-label={pinned.has(key) ? `Unpin ${league.name}` : `Pin ${league.name}`}
              aria-pressed={pinned.has(key)}
            >
              <Pin className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => void api().selectLeague(key)}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
            >
              <ProviderBadge provider={league.provider} />
              <span className="truncate font-medium">{league.name}</span>
              <span className="ml-auto text-xs text-muted">Week {league.week}</span>
            </button>
            {league.provider === 'espn' ? (
              <button
                type="button"
                onClick={() => void api().removeEspnLeague(league.id)}
                className="cursor-pointer text-xs text-muted hover:text-air"
              >
                Remove
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

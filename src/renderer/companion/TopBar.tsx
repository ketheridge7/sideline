import type { JSX } from 'react'
import { ChevronDown, Eye, Layers3, Radio, Settings2, Trophy } from 'lucide-react'
import type { AppState } from '@shared/types'

export type Screen = 'board' | 'boards' | 'connect'

const api = (): NonNullable<Window['sideline']> => {
  if (!window.sideline) throw new Error('Sideline preload missing')
  return window.sideline
}

export const TopBar = ({
  state,
  screen,
  studioOpen,
  onScreen,
  onStudio
}: {
  state: AppState
  screen: Screen
  studioOpen: boolean
  onScreen: (screen: Screen) => void
  onStudio: (open: boolean) => void
}): JSX.Element => {
  const handleOverlay = (): void => {
    void api().toggleOverlay()
  }
  return (
    <header className="flex items-center gap-3 border-b border-line px-5 py-3">
      <div className="flex items-center gap-2">
        <Radio className="h-5 w-5 text-you" aria-hidden="true" />
        <span className="font-cond text-2xl font-extrabold uppercase tracking-[0.12em]">Sideline</span>
      </div>
      {state.nfl ? (
        <span className="text-sm text-muted">
          Week {state.nfl.displayWeek} · {state.nfl.leagueSeason}
          {state.pollingLive ? ' · ON AIR' : ''}
          {state.replay ? ' · Replay' : ''}
        </span>
      ) : null}
      <nav className="ml-auto flex items-center gap-1">
        {(
          [
            ['board', 'Board', Trophy],
            ['boards', 'Boards', Layers3],
            ['connect', 'Connect', Settings2]
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => onScreen(id)}
            className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm uppercase tracking-wide transition-colors duration-200 ${
              screen === id ? 'bg-card text-you' : 'text-muted hover:text-text'
            }`}
            aria-current={screen === id ? 'page' : undefined}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
        <div className="ml-2 flex">
          <button
            type="button"
            onClick={handleOverlay}
            className={`flex cursor-pointer items-center gap-1.5 rounded-l-md border px-3 py-1.5 text-sm transition-colors duration-200 ${
              state.overlayVisible
                ? 'border-you/40 bg-you/10 text-you'
                : 'border-you/40 text-you hover:bg-you/10'
            }`}
            aria-label="Toggle overlay"
            aria-pressed={state.overlayVisible}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            HUD
          </button>
          <button
            type="button"
            onClick={() => onStudio(!studioOpen)}
            className="flex cursor-pointer items-center rounded-r-md border border-l-0 border-you/40 px-2 text-you hover:bg-you/10"
            aria-label="Open overlay studio"
            aria-expanded={studioOpen}
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </nav>
    </header>
  )
}

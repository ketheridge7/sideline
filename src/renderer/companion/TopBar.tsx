import type { JSX } from 'react'
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
    <header className="flex items-center gap-4 border-b border-line px-4 py-2">
      <span className="font-cond text-2xl font-extrabold uppercase italic tracking-[0.14em]">Sideline</span>
      {state.nfl ? (
        <span className="font-cond text-sm font-bold uppercase tracking-[0.16em] text-muted">
          Week {state.nfl.displayWeek}
        </span>
      ) : null}
      {state.pollingLive ? (
        <span className="flex items-center gap-1.5 font-cond text-xs font-bold uppercase tracking-[0.18em] text-air">
          <span className="live-dot inline-block h-1.5 w-1.5 bg-air" aria-hidden="true" />
          Live
        </span>
      ) : state.replay ? (
        <span className="font-cond text-xs font-bold uppercase tracking-[0.18em] text-lime">Replay</span>
      ) : null}
      <nav className="ml-auto flex items-center gap-1">
        {(
          [
            ['board', 'Scoreboard'],
            ['boards', 'Leagues'],
            ['connect', 'Connect']
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onScreen(id)}
            className={`cursor-pointer border px-3 py-1 font-cond text-xs font-bold uppercase tracking-[0.16em] ${
              screen === id ? 'border-you text-text' : 'border-line text-muted hover:text-text'
            }`}
            aria-current={screen === id ? 'page' : undefined}
          >
            {label}
          </button>
        ))}
        <div className="ml-3 flex items-center gap-2">
          <span className="font-cond text-[11px] font-bold uppercase tracking-[0.16em] text-muted">HUD</span>
          <button
            type="button"
            role="switch"
            aria-checked={state.overlayVisible}
            aria-label="Toggle overlay"
            onClick={handleOverlay}
            className={`relative h-5 w-9 cursor-pointer border ${
              state.overlayVisible ? 'border-lime bg-lime' : 'border-line bg-bg'
            }`}
          >
            <span
              className={`absolute top-0.5 h-3.5 w-3.5 bg-bg ${
                state.overlayVisible ? 'right-0.5' : 'left-0.5'
              }`}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            onClick={() => onStudio(!studioOpen)}
            className={`cursor-pointer border px-2 py-1 font-cond text-[10px] font-bold uppercase tracking-[0.16em] ${
              studioOpen ? 'border-you text-you' : 'border-line text-muted hover:text-text'
            }`}
            aria-label="Open overlay studio"
            aria-expanded={studioOpen}
          >
            Studio
          </button>
        </div>
      </nav>
    </header>
  )
}

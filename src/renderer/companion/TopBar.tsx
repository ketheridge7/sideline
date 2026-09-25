import type { JSX } from 'react'
import type { AppState } from '@shared/types'
import { chromeDotClass, chromePillClass } from './chrome'
import { SidelineWordmark } from './SidelineWordmark'

export type Screen = 'board' | 'boards' | 'connect'

const api = (): NonNullable<Window['sideline']> => {
  if (!window.sideline) throw new Error('Sideline preload missing')
  return window.sideline
}

export const TopBar = ({
  state,
  screen,
  onScreen
}: {
  state: AppState
  screen: Screen
  onScreen: (screen: Screen) => void
}): JSX.Element => {
  const handleOverlay = (): void => {
    void api().toggleOverlay()
  }
  return (
    <header className="companion-titlebar drag flex items-center gap-4 border-b border-line py-2">
      <SidelineWordmark />
      {state.nfl ? (
        <span className="rounded-full bg-white/[0.06] px-2.5 py-1 font-cond text-sm font-bold uppercase tracking-[0.16em] text-muted">
          Week {state.nfl.displayWeek}
        </span>
      ) : null}
      {state.replay ? (
        <button
          type="button"
          onClick={() => onScreen('connect')}
          className="no-drag cursor-pointer rounded-full bg-lime/10 px-2.5 py-1 font-cond text-xs font-bold uppercase tracking-[0.18em] text-lime ring-1 ring-lime/50 hover:bg-lime/15"
          data-replay-chip="armed"
          title="Replay is a demo mode: scripted Sunday slate, fake leagues only. Relaunch Sideline normally for live leagues."
        >
          Replay
        </button>
      ) : null}
      <nav className="ml-auto flex items-center gap-1.5">
        {(
          [
            ['board', 'Scoreboard'],
            ['boards', 'Leagues'],
            ['connect', 'Connect']
          ] as const
        ).map(([id, label]) => {
          const active = screen === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onScreen(id)}
              className={chromePillClass(active, 'nav')}
              data-chrome="pill"
              aria-current={active ? 'page' : undefined}
            >
              {label}
              {active ? <span className={chromeDotClass} aria-hidden="true" /> : null}
            </button>
          )
        })}
        <div className="ml-2 flex items-center gap-1.5">
          <button
            type="button"
            role="switch"
            aria-checked={state.overlayVisible}
            aria-label="Toggle overlay"
            onClick={handleOverlay}
            className={chromePillClass(state.overlayVisible, 'compact')}
            data-chrome="pill"
          >
            HUD
            {state.overlayVisible ? <span className={chromeDotClass} aria-hidden="true" /> : null}
          </button>
        </div>
      </nav>
    </header>
  )
}

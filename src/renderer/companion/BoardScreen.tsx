import { useEffect, type JSX } from 'react'
import { parseLeagueKey, type AppState, type ToastPayload } from '@shared/types'
import { espnBoardUx } from '@shared/display'
import { tapeForLeague } from '@shared/tape'
import { HudBench } from '../shared/HudBench'
import { HudScoreboard } from '../shared/HudScoreboard'
import { BoardRails } from '../shared/LineupRow'
import { ScoringTape } from './ScoringTape'
import { Watchlist } from './Watchlist'
import { NflTicker } from './NflTicker'
import { chromeDotClass, chromeFillPillClass, chromePillClass } from './chrome'

export const studioControlsVisible = (overlayVisible: boolean): boolean => overlayVisible

const api = (): NonNullable<Window['sideline']> => {
  if (!window.sideline) throw new Error('Sideline preload missing')
  return window.sideline
}

const EspnRecoverBanner = ({
  ux,
  onSignIn
}: {
  ux: 'auth-fail' | 'empty-roster'
  onSignIn: () => void
}): JSX.Element => {
  let copy: string
  switch (ux) {
    case 'auth-fail':
      copy = 'ESPN session is not healthy. Sign in so Sideline can load named starters.'
      break
    case 'empty-roster':
      copy = 'ESPN returned team names without starters. Sign in again to recover the lineup.'
      break
    default: {
      const _never: never = ux
      return _never
    }
  }
  return (
    <div
      className="flex flex-wrap items-center gap-3 border-b border-air/40 bg-air/10 px-5 py-2"
      data-espn-board-ux={ux}
    >
      <p className="min-w-0 flex-1 text-sm text-air">{copy}</p>
      <button
        type="button"
        onClick={onSignIn}
        className={chromeFillPillClass('espn', 'compact')}
      >
        Sign in
      </button>
    </div>
  )
}

const EditLayoutPill = ({
  studioOpen,
  onStudio
}: {
  studioOpen: boolean
  onStudio: (open: boolean) => void
}): JSX.Element => (
  <div className="flex items-center px-6 pb-3" data-edit-layout="hud">
    <button
      type="button"
      onClick={() => onStudio(!studioOpen)}
      className={chromePillClass(studioOpen, 'compact')}
      data-chrome="pill"
      aria-label="Open overlay studio"
      aria-expanded={studioOpen}
    >
      Edit layout
      {studioOpen ? <span className={chromeDotClass} aria-hidden="true" /> : null}
    </button>
  </div>
)

export const BoardScreen = ({
  state,
  toasts,
  history,
  studioOpen,
  onStudio,
  onBoards
}: {
  state: AppState
  toasts: ToastPayload[]
  history: Record<string, number[]>
  studioOpen: boolean
  onStudio: (open: boolean) => void
  onBoards: () => void
}): JSX.Element => {
  const matchup = state.matchup
  const selected = state.selectedLeagueKey ? parseLeagueKey(state.selectedLeagueKey) : null
  const boardUx = espnBoardUx({
    provider: selected?.provider,
    espnConnected: state.espnConnected,
    espnNeedsRelogin: state.espnNeedsRelogin,
    matchup
  })
  const showReplay = boardUx === 'healthy-lineup' && state.replay
  const showLineups = boardUx === 'healthy-lineup'
  const showEditLayout = studioControlsVisible(state.overlayVisible)
  const tape = tapeForLeague(
    state.tape.length > 0
      ? state.tape
      : toasts.map((toast) => ({
          id: toast.id,
          at: Date.now(),
          kind: 'status' as const,
          player: toast.title,
          detail: toast.body
        })),
    state.selectedLeagueKey
  )

  useEffect(() => {
    const handleKey = (event: KeyboardEvent): void => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
        return
      }
      if (event.key === 'e' || event.key === 'E') {
        if (!showEditLayout) return
        onStudio(!studioOpen)
        return
      }
      if (event.key === 'o' || event.key === 'O') {
        void api().toggleOverlay()
        return
      }
      if (event.key === 'Escape' && studioOpen) {
        onStudio(false)
        if (state.overlayEditMode) void api().setOverlayEditMode(false)
        return
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onStudio, showEditLayout, state.overlayEditMode, studioOpen])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1">
        <Watchlist state={state} history={history} onBoards={onBoards} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-espn-board-ux={boardUx}>
        {boardUx === 'auth-fail' || boardUx === 'empty-roster' ? (
          <EspnRecoverBanner ux={boardUx} onSignIn={() => void api().signInEspn()} />
        ) : null}
        {!matchup ? (
          <>
            {showEditLayout ? <EditLayoutPill studioOpen={studioOpen} onStudio={onStudio} /> : null}
            <div className="p-8 text-sm text-muted">
              {boardUx === 'auth-fail'
                ? 'Sign in with ESPN to load this league. Sideline cannot see a private ESPN matchup without cookies.'
                : 'Pin a Sunday board, then open it. Sideline shows one matchup at a time.'}
            </div>
          </>
        ) : (
          <>
            {showReplay ? (
              <div className="flex flex-wrap items-center gap-3 px-5 py-1.5 text-[11px] uppercase tracking-[0.16em] text-muted">
                <span className="font-cond font-bold text-lime">Replay</span>
              </div>
            ) : null}
            <HudScoreboard
              matchup={matchup}
              needsSignIn={boardUx === 'auth-fail'}
            />
            {showEditLayout ? <EditLayoutPill studioOpen={studioOpen} onStudio={onStudio} /> : null}
            {showLineups ? (
              <>
                <BoardRails mine={matchup.starters} opp={matchup.oppStarters ?? []} />
                <div className="grid grid-cols-2">
                  <HudBench players={matchup.bench} label="Bench" />
                  <HudBench players={matchup.oppTeam ? matchup.oppBench : []} label="Bench" mirror />
                </div>
              </>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">
                Starters stay hidden until ESPN returns a named lineup.
              </p>
            )}
          </>
        )}
      </div>
      <ScoringTape events={tape} />
      </div>
      {state.nflTicker.length > 0 ? <NflTicker games={state.nflTicker} /> : null}
    </div>
  )
}

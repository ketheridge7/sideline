import { useEffect, type JSX } from 'react'
import type { AppState, ToastPayload } from '@shared/types'
import { leagueKey } from '@shared/types'
import { HudBench } from '../shared/HudBench'
import { HudScoreboard } from '../shared/HudScoreboard'
import { LineupRow } from '../shared/LineupRow'
import { ScoringTape } from './ScoringTape'
import { Watchlist } from './Watchlist'
import { NflTicker } from './NflTicker'

const api = (): NonNullable<Window['sideline']> => {
  if (!window.sideline) throw new Error('Sideline preload missing')
  return window.sideline
}

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
  const tape = state.tape.length > 0 ? state.tape : toasts.map((toast) => ({
    id: toast.id,
    at: Date.now(),
    kind: 'status' as const,
    player: toast.title,
    detail: toast.body
  }))

  useEffect(() => {
    const handleKey = (event: KeyboardEvent): void => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
        return
      }
      if (event.key === 'e' || event.key === 'E') {
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
      if (event.key === '[' || event.key === ']') {
        const pinned = state.leagues.filter((row) =>
          state.pinnedLeagueKeys.includes(leagueKey(row.provider, row.id))
        )
        const list = pinned.length > 0 ? pinned : state.leagues
        const index = list.findIndex((row) => leagueKey(row.provider, row.id) === state.selectedLeagueKey)
        if (list.length === 0) return
        const delta = event.key === ']' ? 1 : -1
        const next = list[(index + delta + list.length) % list.length]
        void api().selectLeague(leagueKey(next.provider, next.id))
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onStudio, state.leagues, state.overlayEditMode, state.pinnedLeagueKeys, state.selectedLeagueKey, studioOpen])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1">
        <Watchlist state={state} history={history} onBoards={onBoards} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {!matchup ? (
          <div className="p-8 text-sm text-muted">
            {state.espnNeedsRelogin && state.selectedLeagueKey?.startsWith('espn:')
              ? 'Sign in with ESPN to load this league. Sideline cannot see a private ESPN matchup without cookies.'
              : 'Pin a Sunday board, then open it. Sideline shows one matchup at a time.'}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 px-5 py-1.5 text-[11px] uppercase tracking-[0.16em] text-muted">
              {state.pollingLive ? (
                <span className="flex items-center gap-1.5 font-cond font-bold text-air">
                  <span className="live-dot inline-block h-1.5 w-1.5 bg-air" aria-hidden="true" />
                  On air
                </span>
              ) : null}
              {state.replay ? (
                <span className="font-cond font-bold text-lime">Replay</span>
              ) : null}
              {state.lastUpdated ? (
                <span>
                  {new Date(state.lastUpdated).toLocaleTimeString()} · {state.pollingLive ? '3s' : '30s'}
                  {state.pollMs != null ? ` · ${state.pollMs}ms` : ''}
                  {state.liveCallMs != null ? ` · live ${state.liveCallMs}ms` : ''}
                </span>
              ) : null}
            </div>
            <HudScoreboard
              matchup={matchup}
              needsSignIn={state.espnNeedsRelogin && state.selectedLeagueKey?.startsWith('espn:')}
            />
            <section className="grid min-h-0 flex-1 grid-cols-2 overflow-hidden">
              <div className="min-h-0 overflow-auto px-5 py-3">
                <h2 className="mb-2 font-cond text-xs font-bold uppercase tracking-[0.18em] text-you">You</h2>
                {Array.from({ length: Math.max(matchup.starters.length, matchup.oppStarters?.length ?? 0, 1) }, (_, index) => (
                  <LineupRow
                    key={matchup.starters[index]?.playerId ?? `mine-${index}`}
                    player={matchup.starters[index]}
                    you
                  />
                ))}
              </div>
              <div className="min-h-0 overflow-auto px-5 py-3">
                <h2 className="mb-2 text-right font-cond text-xs font-bold uppercase tracking-[0.18em] text-them">
                  Them
                </h2>
                {Array.from({ length: Math.max(matchup.starters.length, matchup.oppStarters?.length ?? 0, 1) }, (_, index) => (
                  <LineupRow
                    key={matchup.oppStarters?.[index]?.playerId ?? `opp-${index}`}
                    player={matchup.oppStarters?.[index]}
                    mirror
                  />
                ))}
              </div>
            </section>
            <div className="grid grid-cols-2">
              <HudBench players={matchup.bench} label="Bench" />
              <HudBench players={matchup.oppTeam ? matchup.oppBench : []} label="Bench" mirror />
            </div>
          </>
        )}
      </div>
      <ScoringTape events={tape} />
      </div>
      {state.nflTicker.length > 0 ? <NflTicker games={state.nflTicker} /> : null}
    </div>
  )
}

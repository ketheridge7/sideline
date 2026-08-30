import { useEffect, type JSX } from 'react'
import type { AppState, ToastPayload } from '@shared/types'
import { leagueKey } from '@shared/types'
import { HudBench } from '../shared/HudBench'
import { HudCrawler } from '../shared/HudCrawler'
import { HudScoreboard } from '../shared/HudScoreboard'
import { LineupRow } from '../shared/LineupRow'
import { ChannelStrip } from './ChannelStrip'

const api = (): NonNullable<Window['sideline']> => {
  if (!window.sideline) throw new Error('Sideline preload missing')
  return window.sideline
}

export const BoardScreen = ({
  state,
  toasts,
  studioOpen,
  onStudio
}: {
  state: AppState
  toasts: ToastPayload[]
  studioOpen: boolean
  onStudio: (open: boolean) => void
}): JSX.Element => {
  const league = state.leagues.find(
    (row) => leagueKey(row.provider, row.id) === state.selectedLeagueKey
  )
  const matchup = state.matchup

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

  if (!league || !matchup) {
    return (
      <div className="p-8 text-sm text-muted">
        Pin a Sunday board, then open it. Sideline shows one matchup at a time.
      </div>
    )
  }

  const rows = Math.max(matchup.starters.length, matchup.oppStarters?.length ?? 0, 1)
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChannelStrip state={state} />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-3 px-5 py-2 text-xs text-muted">
            {state.pollingLive ? (
              <span className="font-cond font-bold uppercase tracking-[0.2em] text-air">On air</span>
            ) : null}
            {state.replay ? (
              <span className="font-cond font-bold uppercase tracking-[0.2em] text-you">Replay</span>
            ) : null}
            {state.lastUpdated ? (
              <span>
                {new Date(state.lastUpdated).toLocaleTimeString()} · {state.pollingLive ? '10s' : '30s'}
              </span>
            ) : null}
          </div>
          <HudScoreboard matchup={matchup} />
          <section className="grid min-h-0 flex-1 grid-cols-2 gap-px overflow-auto bg-line">
            <div className="bg-card px-5 py-3">
              <h2 className="mb-2 font-cond text-xs font-bold uppercase tracking-[0.2em] text-you">
                Your starters
              </h2>
              {Array.from({ length: rows }, (_, index) => (
                <LineupRow
                  key={matchup.starters[index]?.playerId ?? `mine-${index}`}
                  player={matchup.starters[index]}
                />
              ))}
            </div>
            <div className="bg-card px-5 py-3">
              <h2 className="mb-2 text-right font-cond text-xs font-bold uppercase tracking-[0.2em] text-them">
                Their starters
              </h2>
              {Array.from({ length: rows }, (_, index) => (
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
          <HudCrawler toasts={toasts} />
        </div>
      </div>
    </div>
  )
}

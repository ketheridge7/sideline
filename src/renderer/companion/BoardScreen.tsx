import { useEffect, useState, type JSX } from 'react'
import { parseLeagueKey, type AppState, type ToastPayload } from '@shared/types'
import { espnBoardUx } from '@shared/display'
import { tapeForLeague } from '@shared/tape'
import { HudScoreboard } from '../shared/HudScoreboard'
import { BoardRails } from '../shared/LineupRow'
import { ScoringTape } from './ScoringTape'
import { Watchlist } from './Watchlist'
import { NflTicker } from './NflTicker'
import { LeagueSyncingBanner } from './LeagueSyncing'
import { chromeFillPillClass, chromePillClass } from './chrome'
import { LeagueScoreboard } from './LeagueScoreboard'
import { useLeagueBoard } from '../shared/useLeagueBoard'

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

export const BoardScreen = ({
  state,
  toasts,
  history,
  onBoards
}: {
  state: AppState
  toasts: ToastPayload[]
  history: Record<string, number[]>
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
  const showReplay = boardUx === 'healthy-lineup' && state.replay && !state.captureQuiet
  const showLineups = boardUx === 'healthy-lineup'
  const selectedRefreshing = Boolean(
    state.selectedLeagueKey &&
      state.boards.some((board) => board.key === state.selectedLeagueKey && board.refreshing)
  )
  const leagueBoard = useLeagueBoard()
  const [leagueView, setLeagueView] = useState<'mine' | 'league'>('mine')
  const boardForLeague =
    leagueBoard && state.selectedLeagueKey && leagueBoard.leagueKey === state.selectedLeagueKey ? leagueBoard : null

  const setLeagueMode = (next: 'mine' | 'league'): void => {
    if (next === leagueView) return
    setLeagueView(next)
    void window.sideline?.setLeagueBrowse({ open: next === 'league' })
  }

  useEffect(() => {
    return () => {
      void window.sideline?.setLeagueBrowse({ open: false })
    }
  }, [])

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
      if (event.key === 'o' || event.key === 'O') {
        void api().toggleOverlay()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1">
        <Watchlist state={state} history={history} onBoards={onBoards} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-espn-board-ux={boardUx}>
        <div className="flex items-center gap-1.5 border-b border-line px-5 py-2">
          <button
            type="button"
            onClick={() => setLeagueMode('mine')}
            className={chromePillClass(leagueView === 'mine', 'compact')}
            data-league-toggle="mine"
            aria-pressed={leagueView === 'mine'}
          >
            Mine
          </button>
          <button
            type="button"
            onClick={() => setLeagueMode('league')}
            className={chromePillClass(leagueView === 'league', 'compact')}
            data-league-toggle="league"
            aria-pressed={leagueView === 'league'}
          >
            League
          </button>
        </div>
        {boardUx === 'auth-fail' || boardUx === 'empty-roster' || (leagueView === 'league' && boardForLeague?.needsSignIn) ? (
          <EspnRecoverBanner
            ux={boardUx === 'empty-roster' ? 'empty-roster' : 'auth-fail'}
            onSignIn={() => void api().signInEspn()}
          />
        ) : null}
        {selectedRefreshing ? <LeagueSyncingBanner /> : null}
        {leagueView === 'league' ? (
          <LeagueScoreboard board={boardForLeague} onMine={() => setLeagueMode('mine')} />
        ) : !matchup ? (
          <div className="p-8 text-sm text-muted">
            {boardUx === 'auth-fail'
              ? 'Sign in with ESPN to load this league. Sideline cannot see a private ESPN matchup without cookies.'
              : 'Pin a Sunday board, then open it. Sideline shows one matchup at a time.'}
          </div>
        ) : (
          <div key={state.selectedLeagueKey ?? 'matchup'} className="flex min-h-0 min-w-0 flex-1 flex-col">
            {showReplay ? (
              <div className="flex flex-wrap items-center gap-3 px-5 py-1.5 text-[11px] uppercase tracking-[0.16em] text-muted">
                <span className="font-cond font-bold text-lime">Replay</span>
              </div>
            ) : null}
            <HudScoreboard
              matchup={matchup}
              needsSignIn={boardUx === 'auth-fail'}
              showOwners={selected?.provider !== 'sleeper'}
            />
            {showLineups ? (
              <BoardRails
                mine={matchup.starters}
                opp={matchup.oppStarters ?? []}
                mineBench={matchup.bench}
                oppBench={matchup.oppTeam ? matchup.oppBench : []}
                oppMissing={!matchup.oppTeam}
              />
            ) : (
              <p className="px-5 py-4 text-sm text-muted">
                Starters stay hidden until ESPN returns a named lineup.
              </p>
            )}
          </div>
        )}
      </div>
      <ScoringTape events={tape} />
      </div>
      {state.nflTicker.length > 0 ? <NflTicker games={state.nflTicker} /> : null}
    </div>
  )
}

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { emptyAppState, type Matchup, type TapeEvent } from '@shared/types'
import { BoardScreen } from './BoardScreen'

const espnMatchup = (named: boolean): Matchup => ({
  myTeam: { id: '8', name: 'Team Etheridge', owner: 'KE', record: '1-0' },
  oppTeam: { id: '3', name: "Django Achane'd", owner: 'DA', record: '0-1' },
  myPoints: named ? 12 : 0,
  oppPoints: named ? 9 : 0,
  starters: named
    ? [{ playerId: '3139477', name: 'Patrick Mahomes', position: 'QB', nflTeam: 'KC', points: 12 }]
    : [],
  bench: [],
  oppStarters: named
    ? [{ playerId: '4427366', name: "De'Von Achane", position: 'RB', nflTeam: 'MIA', points: 9 }]
    : [],
  oppBench: []
})

const mixedTape: TapeEvent[] = [
  {
    id: 'sleeper-inj',
    at: 2,
    kind: 'injury',
    player: 'Dowdle DAL',
    detail: 'OUT',
    leagueKey: 'sleeper:1333470459076804608',
    leagueName: 'Gucci Gang Dynasty'
  },
  {
    id: 'espn-score',
    at: 1,
    kind: 'score',
    player: 'Mahomes KC',
    detail: 'QB',
    delta: 2.4,
    leagueKey: 'espn:543268341',
    leagueName: 'Dawg Pound'
  },
  {
    id: 'espn-waiver',
    at: 3,
    kind: 'add',
    player: 'Downs IND',
    detail: 'add',
    leagueKey: 'espn:543268341',
    leagueName: 'Dawg Pound'
  }
]

const renderBoard = (
  state: ReturnType<typeof emptyAppState>,
  studioOpen = false
): string =>
  renderToStaticMarkup(
    <BoardScreen
      state={state}
      toasts={[]}
      history={{}}
      studioOpen={studioOpen}
      onStudio={() => undefined}
      onBoards={() => undefined}
    />
  )

describe('BoardScreen ESPN UX', () => {
  it('shows a Sign in CTA and no On air for an auth-fail ESPN board', () => {
    const state = emptyAppState()
    state.selectedLeagueKey = 'espn:543268341'
    state.espnNeedsRelogin = true
    state.espnConnected = false
    state.pollingLive = true
    state.matchup = espnMatchup(false)
    const html = renderBoard(state)
    expect(html).toContain('data-espn-board-ux="auth-fail"')
    expect(html).toContain('Sign in')
    expect(html).not.toContain('On air')
    expect(html).not.toContain('Patrick Mahomes')
  })

  it('shows a recover CTA for names-without-starters instead of a blank on-air lineup', () => {
    const state = emptyAppState()
    state.selectedLeagueKey = 'espn:543268341'
    state.espnConnected = true
    state.pollingLive = true
    state.matchup = espnMatchup(false)
    const html = renderBoard(state)
    expect(html).toContain('data-espn-board-ux="empty-roster"')
    expect(html).toContain('Team Etheridge')
    expect(html).toContain('Sign in')
    expect(html).toContain('without starters')
    expect(html).not.toContain('On air')
    expect(html).not.toContain('data-hud-rail')
  })

  it('keeps named starters when ESPN is healthy and does not paint On air chrome', () => {
    const state = emptyAppState()
    state.selectedLeagueKey = 'espn:543268341'
    state.espnConnected = true
    state.pollingLive = true
    state.matchup = espnMatchup(true)
    const html = renderBoard(state)
    expect(html).toContain('data-espn-board-ux="healthy-lineup"')
    expect(html).toContain('Patrick Mahomes')
    expect(html).toContain('data-hud-rail="mine"')
    expect(html).toContain('data-hud-rail="opp"')
    expect(html).not.toContain('On air')
    expect(html).not.toContain('without starters')
  })

  it('titles the right rail Scoring tape for this matchup', () => {
    const state = emptyAppState()
    state.selectedLeagueKey = 'espn:543268341'
    state.espnConnected = true
    state.matchup = espnMatchup(true)
    const html = renderBoard(state)
    expect(html).toContain('data-scoring-tape="selected"')
    expect(html).toContain('Scoring tape')
    expect(html).toContain('This matchup')
    expect(html).not.toContain('Live scoring')
    expect(html).not.toContain('>Live<')
  })

  it('scopes scoring tape to the selected league', () => {
    const state = emptyAppState()
    state.selectedLeagueKey = 'espn:543268341'
    state.espnConnected = true
    state.matchup = espnMatchup(true)
    state.tape = mixedTape
    const espnHtml = renderBoard(state)
    expect(espnHtml).toContain('Mahomes KC')
    expect(espnHtml).not.toContain('Dowdle DAL')
    const sleeper = renderBoard({
      ...state,
      selectedLeagueKey: 'sleeper:1333470459076804608',
      matchup: {
        ...espnMatchup(true),
        myTeam: { id: '11', name: 'Gibbs Me Head', owner: 'ketheridge', record: '1-0' }
      }
    })
    expect(sleeper).toContain('Dowdle DAL')
    expect(sleeper).not.toContain('Mahomes KC')
  })

  it('does not paint ESPN adds, drops, or waivers on Scoring tape', () => {
    const state = emptyAppState()
    state.selectedLeagueKey = 'espn:543268341'
    state.espnConnected = true
    state.matchup = espnMatchup(true)
    state.tape = mixedTape
    const html = renderBoard(state)
    expect(html).toContain('Mahomes KC')
    expect(html).not.toContain('Downs IND')
    expect(html).not.toContain('>Waiver<')
  })

  it('puts Edit layout under the scoreboard only when HUD is on', () => {
    const state = emptyAppState()
    state.selectedLeagueKey = 'espn:543268341'
    state.espnConnected = true
    state.matchup = espnMatchup(true)
    const off = renderBoard(state)
    expect(off).not.toContain('Edit layout')
    expect(off).not.toContain('data-edit-layout')
    expect(off).not.toContain('>Studio<')
    state.overlayVisible = true
    const on = renderBoard(state)
    expect(on).toContain('Edit layout')
    expect(on).toContain('data-edit-layout="hud"')
    expect(on).toContain('aria-label="Open overlay studio"')
    expect(on).toContain('aria-expanded="false"')
    expect(on).not.toContain('>Studio<')
    const open = renderBoard(state, true)
    expect(open).toContain('aria-expanded="true"')
    expect(open).toContain('ring-lime')
    expect(open).toContain('text-lime')
    expect(open).toContain('bg-lime/10')
    expect(on.indexOf('Team Etheridge')).toBeLessThan(on.indexOf('Edit layout'))
    expect(on).toContain('text-lime">Starters</h2>')
    expect(on).toContain('text-them">Starters</h2>')
    expect(on).toContain('text-lime')
    expect(on).toContain('>Bench<')
  })

  it('folds bench into column feet instead of a full-width chip rail', () => {
    const state = emptyAppState()
    state.selectedLeagueKey = 'espn:543268341'
    state.espnConnected = true
    state.matchup = {
      ...espnMatchup(true),
      bench: [{ playerId: 'kittle', name: 'George Kittle', position: 'TE', nflTeam: 'SF', points: 4.2 }],
      oppBench: [{ playerId: 'nico', name: 'Nico Collins', position: 'WR', nflTeam: 'HOU', points: 3.1 }]
    }
    const html = renderBoard(state)
    expect(html).toContain('data-bench-column="mine"')
    expect(html).toContain('data-bench-column="opp"')
    expect(html).toContain('data-bench-foot="mine"')
    expect(html).toContain('data-bench-open="false"')
    expect(html).not.toContain('data-bench-popover')
    expect(html).not.toContain('George Kittle')
    expect(html).not.toContain('overflow-x-auto')
  })
})

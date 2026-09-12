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
  }
]

const renderBoard = (state: ReturnType<typeof emptyAppState>): string =>
  renderToStaticMarkup(
    <BoardScreen
      state={state}
      toasts={[]}
      history={{}}
      studioOpen={false}
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
  })

  it('keeps named starters and On air when ESPN is healthy', () => {
    const state = emptyAppState()
    state.selectedLeagueKey = 'espn:543268341'
    state.espnConnected = true
    state.pollingLive = true
    state.matchup = espnMatchup(true)
    const html = renderBoard(state)
    expect(html).toContain('data-espn-board-ux="healthy-lineup"')
    expect(html).toContain('Patrick Mahomes')
    expect(html).toContain('On air')
    expect(html).not.toContain('without starters')
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
})

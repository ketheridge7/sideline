import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { emptyAppState, type MatchupBoard } from '@shared/types'
import { BoardsScreen } from './BoardsScreen'

const board: MatchupBoard = {
  key: 'sleeper:1',
  leagueName: 'Friday Night Gridiron',
  provider: 'sleeper',
  week: 1,
  myName: 'Gibbs Me Head',
  oppName: 'The Other Guys',
  myPoints: 142.8,
  oppPoints: 131.2,
  lastScorers: [
    { playerId: '1', name: 'Jahmyr Gibbs', position: 'RB', points: 24.6 },
    { playerId: '2', name: 'Josh Allen', position: 'QB', points: 18.2, delta: 6.4 }
  ]
}

const renderBoards = (overrides: Partial<ReturnType<typeof emptyAppState>> = {}): string => {
  const state = emptyAppState()
  state.sleeperConnected = true
  state.boards = [board]
  state.leagues = [{ id: '1', name: 'Friday Night Gridiron', provider: 'sleeper', season: '2026', week: 1 }]
  return renderToStaticMarkup(
    <BoardsScreen state={{ ...state, ...overrides }} onOpenBoard={() => undefined} />
  )
}

describe('BoardsScreen', () => {
  it('labels chips Top scorers and shows points, not tick deltas', () => {
    const html = renderBoards()
    expect(html).toContain('Top scorers')
    expect(html).not.toContain('Last score')
    expect(html).toContain('24.6')
    expect(html).toContain('18.2')
    expect(html).not.toContain('+6.4')
  })

  it('puts Scoring tape on the right for all leagues', () => {
    const html = renderBoards()
    expect(html).toContain('data-scoring-tape="all-leagues"')
    expect(html).toContain('Scoring tape')
    expect(html).toContain('All leagues')
    expect(html).not.toContain('Live scoring')
    expect(html).not.toContain('Auto-refresh on')
    expect(html).not.toContain('View full play-by-play')
    expect(html).toContain('Open scoreboard')
    expect(html.indexOf('matchups')).toBeLessThan(html.indexOf('data-scoring-tape="all-leagues"'))
    expect(html).toContain('border-l border-line')
  })

  it('paints my team name lime and leaves the opponent muted', () => {
    const html = renderBoards()
    expect(html).toContain('text-lime')
    expect(html).toContain('Gibbs Me Head')
    expect(html).toContain('text-muted">The Other Guys')
    expect(html).not.toMatch(/text-lime[^"]*">The Other Guys/)
  })
})

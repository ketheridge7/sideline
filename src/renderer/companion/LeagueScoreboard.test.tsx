import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { LeagueBoardSnapshot, Matchup } from '@shared/types'
import { applyLeagueScanKey, LeagueScoreboard } from './LeagueScoreboard'

const pairing = (name: string, opp: string | null): Matchup => ({
  myTeam: { id: name, name, owner: name, record: '1-0' },
  oppTeam: opp ? { id: opp, name: opp, owner: opp, record: '0-1' } : null,
  myPoints: 12,
  oppPoints: opp ? 9 : 0,
  myProjectedPoints: 20,
  oppProjectedPoints: opp ? 18 : undefined,
  myWinPct: opp ? 0.6 : undefined,
  oppWinPct: opp ? 0.4 : undefined,
  winPctSource: 'official',
  starters: [{ playerId: '1', name: 'Quarterback', position: 'QB', nflTeam: 'KC', points: 12 }],
  bench: [],
  oppStarters: opp ? [{ playerId: '2', name: 'Runner', position: 'RB', nflTeam: 'DAL', points: 9 }] : [],
  oppBench: []
})

const board = (): LeagueBoardSnapshot => ({
  leagueKey: 'sleeper:1',
  leagueName: 'Friday Night Gridiron',
  provider: 'sleeper',
  week: 3,
  status: 'ready',
  pollingLive: true,
  updatedAt: 1,
  pairs: [
    { id: 'mine', mine: true, matchup: pairing('Ice Box', 'Hash Marks'), left: 4, oppLeft: 5 },
    { id: 'other', mine: false, matchup: pairing('Last Call', 'Sober Sundays'), left: 2, oppLeft: 0 },
    { id: 'bye', mine: false, matchup: pairing('Practice Squad', null), left: 0, oppLeft: 0 }
  ]
})

describe('applyLeagueScanKey', () => {
  it('moves, opens, and steps back without leaving the league view until a second Escape', () => {
    const list = { view: 'list' as const, index: 0 }
    const down = applyLeagueScanKey(list, 'ArrowDown', 3)
    expect(down).toEqual({ view: 'list', index: 1 })
    const opened = applyLeagueScanKey(down === 'mine' ? list : down, 'Enter', 3)
    expect(opened).toEqual({ view: 'detail', index: 1 })
    expect(applyLeagueScanKey(opened === 'mine' ? list : opened, 'ArrowDown', 3)).toEqual({
      view: 'detail',
      index: 1
    })
    const back = applyLeagueScanKey(opened === 'mine' ? list : opened, 'Escape', 3)
    expect(back).toEqual({ view: 'list', index: 1 })
    expect(applyLeagueScanKey(back === 'mine' ? list : back, 'Escape', 3)).toBe('mine')
  })
})

describe('LeagueScoreboard', () => {
  it('renders every pairing, a bye, players left, and a live mark', () => {
    const html = renderToStaticMarkup(<LeagueScoreboard board={board()} onMine={() => undefined} />)
    expect(html).toContain('data-league-board="list"')
    expect(html).toContain('Ice Box')
    expect(html).toContain('Hash Marks')
    expect(html).toContain('data-league-bye="true"')
    expect(html).toContain('BYE')
    expect(html).toContain('4 left')
    expect(html).toContain('data-live-dot="true"')
    expect(html).toContain('The overlay stays on yours.')
  })

  it('shows a loading skeleton and keeps the last names when a later snapshot errors', () => {
    const loading = renderToStaticMarkup(<LeagueScoreboard board={null} onMine={() => undefined} />)
    expect(loading).toContain('data-league-status="loading"')
    const failed: LeagueBoardSnapshot = { ...board(), status: 'error', error: 'League scores are paused after a rate limit. Your matchup is unchanged.' }
    const html = renderToStaticMarkup(<LeagueScoreboard board={failed} onMine={() => undefined} />)
    expect(html).toContain('Ice Box')
    expect(html).toContain('data-league-status="error"')
    expect(html).toContain('paused after a rate limit')
  })
})

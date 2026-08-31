import { describe, expect, it } from 'vitest'
import { lastName, leadShare, liveScorers, nflTeamLabel, sparklinePoints, toMatchupBoard, visibleInjury } from './display'
import type { League, Matchup } from './types'

const league: League = {
  id: '1',
  name: 'Friday Night Gridiron',
  provider: 'sleeper',
  season: '2025',
  week: 1
}

const matchup: Matchup = {
  myTeam: { id: 'a', name: 'Gibbs Me Head', owner: 'Me', record: '1-0' },
  oppTeam: { id: 'b', name: 'The Other Guys', owner: 'You', record: '0-1' },
  myPoints: 142.8,
  oppPoints: 131.2,
  starters: [
    { playerId: '1', name: 'Jahmyr Gibbs', position: 'RB', nflTeam: 'DET', points: 24.6 },
    { playerId: '2', name: 'Josh Allen', position: 'QB', nflTeam: 'BUF', points: 18.2 }
  ],
  bench: [],
  oppStarters: [{ playerId: '3', name: 'Derrick Henry', position: 'RB', nflTeam: 'BAL', points: 12 }],
  oppBench: []
}

describe('visibleInjury', () => {
  it('hides roster noise and keeps real injury/IR', () => {
    expect(visibleInjury('ACTIVE')).toBeNull()
    expect(visibleInjury('NORMAL')).toBeNull()
    expect(visibleInjury('INJURY_RESERVE')).toBe('IR')
    expect(visibleInjury('injury-reserve')).toBe('IR')
    expect(visibleInjury('OUT')).toBe('OUT')
    expect(visibleInjury('Questionable')).toBe('Q')
    expect(visibleInjury('Doubtful')).toBe('D')
    expect(visibleInjury()).toBeNull()
  })
})

describe('lastName', () => {
  it('keeps DST labels and otherwise uses the last token', () => {
    expect(lastName('Jahmyr Gibbs')).toBe('Gibbs')
    expect(lastName('Eagles D/ST')).toBe('Eagles D/ST')
    expect(lastName('Hurts')).toBe('Hurts')
  })
})

describe('nflTeamLabel', () => {
  it('drops leaked numeric proTeamIds', () => {
    expect(nflTeamLabel('12')).toBe('')
    expect(nflTeamLabel('KC')).toBe('KC')
    expect(nflTeamLabel('')).toBe('')
  })
})

describe('leadShare', () => {
  it('splits combined score, not a win probability', () => {
    const share = leadShare(142.8, 131.2)
    expect(share.mine + share.opp).toBeCloseTo(1)
    expect(share.mine).toBeGreaterThan(0.5)
    expect(leadShare(0, 0)).toEqual({ mine: 0.5, opp: 0.5 })
  })
})

describe('sparklinePoints', () => {
  it('returns an svg polyline for two or more samples', () => {
    expect(sparklinePoints([1], 40, 12)).toBe('')
    expect(sparklinePoints([1, 2, 3], 40, 12).split(' ')).toHaveLength(3)
  })
})

describe('toMatchupBoard', () => {
  it('packs one card of league meta, scores, and live scorers', () => {
    const board = toMatchupBoard(league, matchup)
    expect(board.key).toBe('sleeper:1')
    expect(board.myPoints).toBe(142.8)
    expect(board.lastScorers.map((row) => row.name)).toEqual([
      'Jahmyr Gibbs',
      'Josh Allen',
      'Derrick Henry'
    ])
    expect(liveScorers(null)).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { applyCompanionHudPatch, lastName, leadShare, liveScorers, nflTeamLabel, sparklinePoints, toMatchupBoard, upsertMatchupBoard, visibleInjury } from './display'
import { emptyAppState, type League, type Matchup } from './types'

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
    expect(visibleInjury('Injured Reserve')).toBe('IR')
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

  it('prefers players who just ticked over season-long top scorers', () => {
    const ticking: Matchup = {
      ...matchup,
      starters: [
        { playerId: '1', name: 'Jahmyr Gibbs', position: 'RB', nflTeam: 'DET', points: 24.6 },
        { playerId: '2', name: 'Josh Allen', position: 'QB', nflTeam: 'BUF', points: 18.2, tickDelta: 6.4 }
      ]
    }
    expect(liveScorers(ticking, 1).map((row) => row.name)).toEqual(['Josh Allen'])
  })
})

describe('upsertMatchupBoard', () => {
  it('replaces a board in place and appends an unknown key', () => {
    const first = toMatchupBoard(league, matchup)
    const updated = toMatchupBoard(league, { ...matchup, myPoints: 150 })
    const other = toMatchupBoard({ ...league, id: '2', name: 'Other' }, matchup)
    expect(upsertMatchupBoard([first], updated).map((row) => row.myPoints)).toEqual([150])
    expect(upsertMatchupBoard([first], other).map((row) => row.key)).toEqual(['sleeper:1', 'sleeper:2'])
  })
})

describe('applyCompanionHudPatch', () => {
  it('upserts the selected LEAGUES card from the live matchup without a boards payload', () => {
    const first = toMatchupBoard(league, matchup)
    const other = toMatchupBoard({ ...league, id: '2', name: 'Other' }, matchup)
    const current = {
      ...emptyAppState(),
      leagues: [league, { ...league, id: '2', name: 'Other' }],
      selectedLeagueKey: 'sleeper:1',
      boards: [first, other],
      matchup
    }
    const next = applyCompanionHudPatch(current, {
      matchup: { ...matchup, myPoints: 150.4, oppPoints: 131.2 },
      tape: [],
      nflTicker: [],
      pollingLive: true,
      overlayEditMode: false,
      lastUpdated: 9,
      pollMs: 12,
      liveCallMs: 40
    })
    expect(next.matchup?.myPoints).toBe(150.4)
    expect(next.pollingLive).toBe(true)
    expect(next.boards.map((row) => row.myPoints)).toEqual([150.4, 142.8])
    expect(next.boards[1]?.leagueName).toBe('Other')
  })
})

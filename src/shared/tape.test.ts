import { describe, expect, it } from 'vitest'
import { injuryTapeFromDiff, mergeTape, scoreTapeFromDiff, transactionToTape } from './tape'
import type { League, Matchup, TapeEvent } from './types'

const league: League = {
  id: '1',
  name: 'Homies',
  provider: 'sleeper',
  season: '2025',
  week: 1
}

const matchup = (points: number, status?: string): Matchup => ({
  myTeam: { id: 'a', name: 'Mine', owner: 'Me', record: '1-0' },
  oppTeam: { id: 'b', name: 'Yours', owner: 'You', record: '0-1' },
  myPoints: points,
  oppPoints: 10,
  starters: [{ playerId: '1', name: 'Hurts', position: 'QB', nflTeam: 'PHI', points, status }],
  bench: [],
  oppStarters: [],
  oppBench: []
})

describe('transactionToTape', () => {
  it('labels waiver adds from existing transactions', () => {
    const event = transactionToTape(league, {
      id: 't1',
      type: 'add',
      players: ['Downs'],
      timestamp: 100
    })
    expect(event.kind).toBe('add')
    expect(event.player).toBe('Downs')
    expect(event.detail).toBe('add')
    expect(event.leagueName).toBe('Homies')
  })
})

describe('scoreTapeFromDiff', () => {
  it('emits only real point changes after the first sample', () => {
    const prev = new Map<string, number>()
    expect(scoreTapeFromDiff(league, matchup(12), prev)).toEqual([])
    const next = scoreTapeFromDiff(league, matchup(14.4), prev)
    expect(next).toHaveLength(1)
    expect(next[0]?.kind).toBe('score')
    expect(next[0]?.delta).toBe(2.4)
    expect(next[0]?.player).toBe('Hurts')
  })
})

describe('injuryTapeFromDiff', () => {
  it('emits when a real injury appears', () => {
    const prev = new Map<string, string>()
    expect(injuryTapeFromDiff(league, matchup(12, 'ACTIVE'), prev)).toEqual([])
    const next = injuryTapeFromDiff(league, matchup(12, 'OUT'), prev)
    expect(next[0]?.kind).toBe('injury')
    expect(next[0]?.detail).toBe('OUT')
  })
})

describe('mergeTape', () => {
  it('newest first, unique ids, capped', () => {
    const live: TapeEvent[] = [
      { id: 'a', at: 2, kind: 'score', player: 'A', detail: 'QB', delta: 1 }
    ]
    const snap: TapeEvent[] = [
      { id: 'a', at: 2, kind: 'score', player: 'A', detail: 'QB', delta: 1 },
      { id: 'b', at: 1, kind: 'add', player: 'B', detail: 'add' }
    ]
    expect(mergeTape(live, snap, 2).map((row) => row.id)).toEqual(['a', 'b'])
  })
})

import { describe, expect, it } from 'vitest'
import { injuryTapeFromDiff, mergeTape, mergeSessionTape, scoreTapeFromDiff, tapeForLeague, transactionToTape, withTickDeltas } from './tape'
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
    expect(next[0]?.player).toBe('Hurts PHI')
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

  it('does not refill tape with existing injuries on a cold open', () => {
    const prev = new Map<string, string>()
    expect(injuryTapeFromDiff(league, matchup(12, 'OUT'), prev)).toEqual([])
    expect(prev.get('sleeper:1:1')).toBe('OUT')
    expect(injuryTapeFromDiff(league, matchup(12, 'OUT'), prev)).toEqual([])
  })

  it('emits only after a baseline when injury status actually changes', () => {
    const prev = new Map<string, string>()
    expect(injuryTapeFromDiff(league, matchup(12, 'Questionable'), prev)).toEqual([])
    const changed = injuryTapeFromDiff(league, matchup(12, 'OUT'), prev)
    expect(changed).toHaveLength(1)
    expect(changed[0]?.kind).toBe('injury')
    expect(changed[0]?.detail).toBe('OUT')
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

describe('mergeSessionTape', () => {
  it('keeps a roster drop after a snapshot rebuild and newer score ticks', () => {
    const drop: TapeEvent = {
      id: 'tx:espn:1:drop-1',
      at: 10,
      kind: 'drop',
      player: 'Dell',
      detail: 'drop',
      leagueKey: 'espn:1',
      leagueName: 'Dawg Pound'
    }
    const afterSnapshot = mergeSessionTape([], [drop])
    expect(afterSnapshot.map((row) => row.id)).toEqual(['tx:espn:1:drop-1'])
    const scores: TapeEvent[] = Array.from({ length: 40 }, (_, index) => ({
      id: `score:${index}`,
      at: 100 + index,
      kind: 'score' as const,
      player: 'Hurts',
      detail: 'QB',
      delta: 0.1
    }))
    const afterScores = mergeSessionTape(scores, afterSnapshot)
    expect(afterScores.some((row) => row.id === 'tx:espn:1:drop-1')).toBe(true)
    expect(afterScores.find((row) => row.kind === 'drop')?.player).toBe('Dell')
  })

  it('pins add / add_drop / trade the same way so a refresh cannot blink them off', () => {
    const roster: TapeEvent[] = [
      { id: 'tx:add', at: 1, kind: 'add', player: 'Downs', detail: 'add' },
      { id: 'tx:swap', at: 2, kind: 'add_drop', player: 'A, B', detail: 'add / drop' },
      { id: 'tx:trade', at: 3, kind: 'trade', player: 'X, Y', detail: 'trade' }
    ]
    const rebuilt = mergeSessionTape(
      [{ id: 'score:new', at: 99, kind: 'score', player: 'Hurts', detail: 'QB', delta: 1 }],
      roster
    )
    expect(rebuilt.map((row) => row.id).sort()).toEqual(['score:new', 'tx:add', 'tx:swap', 'tx:trade'])
  })
})

describe('tapeForLeague', () => {
  it('keeps only the selected league key so ESPN Dawg Pound does not show Sleeper injuries', () => {
    const mixed: TapeEvent[] = [
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
      { id: 'toast', at: 0, kind: 'status', player: 'Sideline', detail: 'ok' }
    ]
    expect(tapeForLeague(mixed, 'espn:543268341').map((row) => row.id)).toEqual(['espn-score', 'toast'])
    expect(tapeForLeague(mixed, 'sleeper:1333470459076804608').map((row) => row.id)).toEqual([
      'sleeper-inj',
      'toast'
    ])
    expect(tapeForLeague(mixed, null)).toHaveLength(3)
  })
})

describe('withTickDeltas', () => {
  it('stamps the point delta after the first sample so score ticks can flash who just scored', () => {
    const prev = new Map<string, number>()
    const first = withTickDeltas(league, matchup(12), prev)
    expect(first.starters[0]?.tickDelta).toBeUndefined()
    scoreTapeFromDiff(league, first, prev)
    const second = withTickDeltas(league, matchup(14.4), prev)
    expect(second.starters[0]?.tickDelta).toBe(2.4)
  })

  it('clears a stale tick when points did not change', () => {
    const prev = new Map<string, number>([['sleeper:1:1', 14.4]])
    const next = withTickDeltas(league, matchup(14.4), prev)
    expect(next.starters[0]?.tickDelta).toBeUndefined()
  })

  it('clears a leftover tick when this poll has no previous sample', () => {
    const leftover = matchup(14.4)
    leftover.starters[0] = { ...leftover.starters[0]!, tickDelta: 3.2 }
    const next = withTickDeltas(league, leftover, new Map())
    expect(next.starters[0]?.tickDelta).toBeUndefined()
  })
})

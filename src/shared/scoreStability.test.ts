import { describe, expect, it } from 'vitest'
import {
  commitScore,
  emptyScoreMemory,
  liveTotalsTrustPlan,
  SCORE_STABILITY_CONFIRM_POLLS,
  scoreCommitPlan,
  stabilizeMatchup
} from './scoreStability'
import type { Matchup, Player } from './types'

const player = (id: string, points: number, extra?: Partial<Player>): Player => ({
  playerId: id,
  name: extra?.name ?? id,
  position: extra?.position ?? 'QB',
  nflTeam: extra?.nflTeam ?? 'PHI',
  points
})

const matchup = (mine: number, opp: number, starters?: Player[], oppStarters?: Player[]): Matchup => ({
  myTeam: { id: '1', name: 'Mine', owner: 'Me', record: '0-0' },
  oppTeam: { id: '2', name: 'Them', owner: 'You', record: '0-0' },
  myPoints: mine,
  oppPoints: opp,
  starters: starters ?? [player('100', mine)],
  bench: [],
  oppStarters: oppStarters ?? [player('200', opp)],
  oppBench: []
})

describe('scoreCommitPlan', () => {
  it('seeds the first value, commits increases, and holds a lower provisional', () => {
    expect(scoreCommitPlan({ committed: null, next: 22.4 })).toBe('seed')
    expect(scoreCommitPlan({ committed: 22.4, next: 24.1 })).toBe('commit-increase')
    expect(scoreCommitPlan({ committed: 22.4, next: 22.4 })).toBe('keep')
    expect(scoreCommitPlan({ committed: 22.4, next: 18 })).toBe('hold-pending')
    expect(
      scoreCommitPlan({ committed: 22.4, next: 18, pendingValue: 18, pendingPolls: SCORE_STABILITY_CONFIRM_POLLS - 1 })
    ).toBe('commit-confirmed')
    expect(scoreCommitPlan({ committed: 22.4, next: 18, official: true })).toBe('commit-official')
  })
})

describe('commitScore', () => {
  it('does not drop a committed score on one lower tick', () => {
    const held = commitScore({ committed: 22.4 }, 18)
    expect(held.committed).toBe(22.4)
    expect(held.pending).toEqual({ value: 18, polls: 1 })
  })

  it('commits a decrease after consecutive agreeing polls', () => {
    const pending = commitScore({ committed: 22.4 }, 18)
    const confirmed = commitScore(pending, 18)
    expect(confirmed.committed).toBe(18)
    expect(confirmed.pending).toBeUndefined()
  })

  it('restarts pending when the lower value changes', () => {
    const pending = commitScore({ committed: 22.4 }, 18)
    const restarted = commitScore(pending, 19)
    expect(restarted.committed).toBe(22.4)
    expect(restarted.pending).toEqual({ value: 19, polls: 1 })
  })

  it('clears pending when the live value returns to the watermark', () => {
    const pending = commitScore({ committed: 22.4 }, 18)
    const restored = commitScore(pending, 22.4)
    expect(restored.committed).toBe(22.4)
    expect(restored.pending).toBeUndefined()
  })
})

describe('stabilizeMatchup', () => {
  it('keeps a higher committed total when a later provisional payload is lower', () => {
    const memory = emptyScoreMemory()
    const shown = stabilizeMatchup(null, matchup(87.4, 61.2), memory)
    const flicker = stabilizeMatchup(shown, matchup(45.2, 61.2), memory)
    expect(flicker.myPoints).toBe(87.4)
    expect(flicker.oppPoints).toBe(61.2)
    expect(flicker.starters[0]?.points).toBe(87.4)
  })

  it('does not bounce when compact live oscillates below the watermark', () => {
    const memory = emptyScoreMemory()
    let hud = stabilizeMatchup(null, matchup(87.4, 70), memory)
    hud = stabilizeMatchup(hud, matchup(82.1, 70), memory)
    hud = stabilizeMatchup(hud, matchup(87.4, 70), memory)
    hud = stabilizeMatchup(hud, matchup(82.1, 70), memory)
    expect(hud.myPoints).toBe(87.4)
  })

  it('commits live increases immediately', () => {
    const memory = emptyScoreMemory()
    const shown = stabilizeMatchup(null, matchup(87.4, 70), memory)
    const next = stabilizeMatchup(shown, matchup(93.6, 70), memory)
    expect(next.myPoints).toBe(93.6)
    expect(next.starters[0]?.points).toBe(93.6)
  })

  it('holds last player chips when a later tick zeros some starters', () => {
    const memory = emptyScoreMemory()
    const shown = stabilizeMatchup(
      null,
      matchup(30, 8, [player('100', 18), player('101', 12)], [player('200', 8)]),
      memory
    )
    const incomplete = stabilizeMatchup(
      shown,
      matchup(18, 8, [player('100', 18), player('101', 0)], [player('200', 8)]),
      memory
    )
    expect(incomplete.myPoints).toBe(30)
    expect(incomplete.starters.find((row) => row.playerId === '101')?.points).toBe(12)
  })

  it('commits a decrease after two agreeing polls (final / official correction)', () => {
    const memory = emptyScoreMemory()
    const shown = stabilizeMatchup(null, matchup(22.4, 15.1), memory)
    const pending = stabilizeMatchup(shown, matchup(18, 12), memory)
    expect(pending.myPoints).toBe(22.4)
    const confirmed = stabilizeMatchup(pending, matchup(18, 12), memory)
    expect(confirmed.myPoints).toBe(18)
    expect(confirmed.oppPoints).toBe(12)
    expect(confirmed.starters[0]?.points).toBe(18)
  })

  it('commits an official correction on the first lower payload', () => {
    const memory = emptyScoreMemory()
    const shown = stabilizeMatchup(null, matchup(22.4, 15.1), memory)
    const corrected = stabilizeMatchup(shown, { ...matchup(0, 15.1), scoresFinal: true }, memory)
    expect(corrected.myPoints).toBe(0)
  })

  it('resets committed scores when the NFL week changes', () => {
    const memory = emptyScoreMemory()
    stabilizeMatchup(null, matchup(87.4, 70), memory, { week: 1 })
    const week2 = stabilizeMatchup(null, matchup(0, 0), memory, { week: 2 })
    expect(week2.myPoints).toBe(0)
    expect(memory.week).toBe(2)
  })

  it('does not seed header totals from a leftover last-HUD prev on first live apply', () => {
    const memory = emptyScoreMemory()
    const leftover = matchup(
      115.26,
      122.22,
      [player('106', 17.2), player('100', 0)],
      [player('201', 3), player('200', 0)]
    )
    const live = matchup(
      17.2,
      3,
      [player('106', 17.2), player('100', 0)],
      [player('201', 3), player('200', 0)]
    )
    const shown = stabilizeMatchup(leftover, live, memory, { week: 2 })
    expect(shown.myPoints).toBe(17.2)
    expect(shown.oppPoints).toBe(3)
    expect(shown.starters.find((row) => row.playerId === '106')?.points).toBe(17.2)
  })

  it('commits current-period live totals over leftover headers even after a poisoned seed', () => {
    const memory = emptyScoreMemory()
    const leftover = matchup(
      115.26,
      122.22,
      [player('106', 17.2), player('100', 0)],
      [player('201', 3), player('200', 0)]
    )
    const live = matchup(
      17.2,
      3,
      [player('106', 17.2), player('100', 0)],
      [player('201', 3), player('200', 0)]
    )
    stabilizeMatchup(null, leftover, memory, { week: 2 })
    const shown = stabilizeMatchup(leftover, live, memory, { week: 2 })
    expect(shown.myPoints).toBe(17.2)
    expect(shown.oppPoints).toBe(3)
    expect(liveTotalsTrustPlan({ prev: leftover, incoming: live })).toBe('trust-live')
  })

  it('passes projected finals through without the live-point watermark', () => {
    const memory = emptyScoreMemory()
    const shown = stabilizeMatchup(
      null,
      { ...matchup(22.4, 15.1), myProjectedPoints: 118.2, oppProjectedPoints: 96.4 },
      memory
    )
    const next = stabilizeMatchup(
      shown,
      { ...matchup(24.1, 15.1), myProjectedPoints: 110.4, oppProjectedPoints: 99.1 },
      memory
    )
    expect(next.myPoints).toBe(24.1)
    expect(next.myProjectedPoints).toBe(110.4)
    expect(next.oppProjectedPoints).toBe(99.1)
  })

  it('commits a D/ST drop on the first poll', () => {
    const memory = emptyScoreMemory()
    const defense = player('-16009', 5, { name: 'Packers D/ST', position: 'D/ST', nflTeam: 'GB' })
    const shown = stabilizeMatchup(null, matchup(0, 5, [player('100', 0)], [defense]), memory, { week: 3 })
    const next = stabilizeMatchup(
      shown,
      matchup(0, -7, [player('100', 0)], [{ ...defense, points: -7 }]),
      memory,
      { week: 3 }
    )
    expect(next.oppStarters[0]?.points).toBe(-7)
  })

  it('passes provider win% through without the live-point watermark', () => {
    const memory = emptyScoreMemory()
    const shown = stabilizeMatchup(null, { ...matchup(22.4, 15.1), myWinPct: 0.74, oppWinPct: 0.26 }, memory)
    const next = stabilizeMatchup(
      shown,
      { ...matchup(24.1, 15.1), myWinPct: 0.61, oppWinPct: 0.39 },
      memory
    )
    expect(next.myPoints).toBe(24.1)
    expect(next.myWinPct).toBe(0.61)
    expect(next.oppWinPct).toBe(0.39)
  })
})

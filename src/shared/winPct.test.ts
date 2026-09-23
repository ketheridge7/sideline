import { describe, expect, it } from 'vitest'
import {
  asWinProbability,
  chanceToWinPercents,
  estimatedChanceToWin,
  finalNflTeams,
  nflTeamKey,
  playerProjectedFinal,
  normalCdf,
  providerChanceToWin,
  remainingStd,
  WEEKLY_TEAM_STD
} from './winPct'

describe('providerChanceToWin', () => {
  it('mirrors ESPN schedule side winProbability (0–1)', () => {
    const share = providerChanceToWin(0.74, 0.26)
    expect(share).toEqual({ mine: 0.74, opp: 0.26 })
    expect(chanceToWinPercents(share!)).toEqual({ mine: 74, opp: 26 })
  })

  it('mirrors a lock (0.99 / 0.01) without snapping from live scores', () => {
    const share = providerChanceToWin(0.99, 0.01)
    expect(share?.mine).toBe(0.99)
    expect(chanceToWinPercents(share!)).toEqual({ mine: 99, opp: 1 })
  })

  it('accepts a 0–100 published percent', () => {
    expect(providerChanceToWin(74, 26)).toEqual({ mine: 0.74, opp: 0.26 })
    expect(asWinProbability(74)).toBe(0.74)
    expect(asWinProbability(0.74)).toBe(0.74)
  })

  it('derives the other side when only one published value is present', () => {
    expect(providerChanceToWin(0.1)).toEqual({ mine: 0.1, opp: 0.9 })
    expect(providerChanceToWin(undefined, 0.9)?.mine).toBeCloseTo(0.1)
    expect(providerChanceToWin(undefined, 0.9)?.opp).toBe(0.9)
  })

  it('does not fake a prediction from score-share or missing fields', () => {
    expect(providerChanceToWin()).toBeNull()
    expect(providerChanceToWin(0, 0)).toBeNull()
    expect(asWinProbability(-1)).toBeUndefined()
    expect(asWinProbability(101)).toBeUndefined()
  })
})

describe('estimatedChanceToWin', () => {
  it('is ~50% at 0–0 with equal projected finals', () => {
    const share = estimatedChanceToWin({
      myLive: 0,
      oppLive: 0,
      myProjected: 101.46,
      oppProjected: 101.46
    })
    expect(share).not.toBeNull()
    expect(share?.mine).toBeCloseTo(0.5, 5)
    expect(share?.opp).toBeCloseTo(0.5, 5)
    expect(chanceToWinPercents(share!)).toEqual({ mine: 50, opp: 50 })
  })

  it('is a high win% on a large projected lead', () => {
    const share = estimatedChanceToWin({
      myLive: 0,
      oppLive: 0,
      myProjected: 140,
      oppProjected: 80
    })
    expect(share?.mine).toBeGreaterThan(0.9)
    expect(share!.mine + share!.opp).toBeCloseTo(1)
  })

  it('does not fake a prediction from score-share when projections are missing', () => {
    expect(estimatedChanceToWin({ myLive: 0, oppLive: 0 })).toBeNull()
    expect(estimatedChanceToWin({ myLive: 80, oppLive: 40 })).toBeNull()
    expect(estimatedChanceToWin({ myLive: 0, oppLive: 0, myProjected: 0, oppProjected: 0 })).toBeNull()
  })

  it('snaps to live 100/0 when remaining is gone or the matchup is official', () => {
    expect(estimatedChanceToWin({ myLive: 112.2, oppLive: 98.4, myProjected: 112.2, oppProjected: 98.4 })?.mine).toBe(1)
    expect(estimatedChanceToWin({ myLive: 80, oppLive: 90, scoresFinal: true })?.mine).toBe(0)
    expect(estimatedChanceToWin({ myLive: 10, oppLive: 10, scoresFinal: true })?.mine).toBe(0.5)
  })

  it('uses remaining vs needed, not raw live score-share', () => {
    const trailingLive = estimatedChanceToWin({
      myLive: 40,
      oppLive: 80,
      myProjected: 120,
      oppProjected: 95
    })
    expect(trailingLive?.mine).toBeGreaterThan(0.7)
    const almostDone = estimatedChanceToWin({
      myLive: 80,
      oppLive: 40,
      myProjected: 85,
      oppProjected: 45
    })
    expect(almostDone?.mine).toBeGreaterThan(0.99)
  })
})

describe('normalCdf / remainingStd', () => {
  it('is 0.5 at z=0 and scales remaining noise with the weekly std', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 5)
    expect(normalCdf(1)).toBeCloseTo(0.8413, 3)
    expect(remainingStd(0)).toBe(0)
    expect(remainingStd(120)).toBeCloseTo(WEEKLY_TEAM_STD)
  })
})

describe('playerProjectedFinal', () => {
  it('uses the actual once the NFL game is final, even when under projection', () => {
    expect(playerProjectedFinal({ actual: 4.2, projected: 18, gameFinal: true })).toBe(4.2)
    expect(playerProjectedFinal({ actual: undefined, projected: 18, gameFinal: true })).toBe(0)
  })

  it('takes max(actual, projection) while the game is still to finish', () => {
    expect(playerProjectedFinal({ actual: 4.2, projected: 18, gameFinal: false })).toBe(18)
    expect(playerProjectedFinal({ actual: 24, projected: 18, gameFinal: false })).toBe(24)
    expect(playerProjectedFinal({ actual: 3, projected: undefined, gameFinal: false })).toBeUndefined()
  })
})

describe('finalNflTeams', () => {
  it('collects both teams of final games under one abbreviation per team', () => {
    const teams = finalNflTeams([
      { id: '1', away: 'WSH', awayScore: 10, home: 'PHI', homeScore: 24, clock: 'FINAL', final: true },
      { id: '2', away: 'KC', awayScore: 7, home: 'BUF', homeScore: 3, clock: 'Q2 4:12' }
    ])
    expect([...teams].sort()).toEqual(['PHI', 'WAS'])
    expect(nflTeamKey('jac')).toBe('JAX')
    expect(nflTeamKey(undefined)).toBe('')
  })
})

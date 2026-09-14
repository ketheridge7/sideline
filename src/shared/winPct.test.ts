import { describe, expect, it } from 'vitest'
import { chanceToWin, chanceToWinPercents, normalCdf, remainingStd, WEEKLY_TEAM_STD } from './winPct'

describe('chanceToWin', () => {
  it('is ~50% at 0–0 with equal projected finals', () => {
    const share = chanceToWin({
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
    const share = chanceToWin({
      myLive: 0,
      oppLive: 0,
      myProjected: 140,
      oppProjected: 80
    })
    expect(share?.mine).toBeGreaterThan(0.9)
    expect(share!.mine + share!.opp).toBeCloseTo(1)
  })

  it('does not fake a prediction from score-share when projections are missing', () => {
    expect(chanceToWin({ myLive: 0, oppLive: 0 })).toBeNull()
    expect(chanceToWin({ myLive: 80, oppLive: 40 })).toBeNull()
    expect(chanceToWin({ myLive: 0, oppLive: 0, myProjected: 0, oppProjected: 0 })).toBeNull()
  })

  it('snaps to live 100/0 when remaining is gone or the matchup is official', () => {
    expect(chanceToWin({ myLive: 112.2, oppLive: 98.4, myProjected: 112.2, oppProjected: 98.4 })?.mine).toBe(1)
    expect(chanceToWin({ myLive: 80, oppLive: 90, scoresFinal: true })?.mine).toBe(0)
    expect(chanceToWin({ myLive: 10, oppLive: 10, scoresFinal: true })?.mine).toBe(0.5)
  })

  it('uses remaining vs needed, not raw live score-share', () => {
    const trailingLive = chanceToWin({
      myLive: 40,
      oppLive: 80,
      myProjected: 120,
      oppProjected: 95
    })
    expect(trailingLive?.mine).toBeGreaterThan(0.7)
    const almostDone = chanceToWin({
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

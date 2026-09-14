import { describe, expect, it } from 'vitest'
import { asWinProbability, chanceToWinPercents, providerChanceToWin } from './winPct'

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

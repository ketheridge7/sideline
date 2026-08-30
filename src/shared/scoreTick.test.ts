import { describe, expect, it } from 'vitest'
import {
  SCORE_TICK_DELTA_MS,
  SCORE_TICK_SETTLE_MS,
  scoreTickChange,
  scoreTickLabel,
  scoreTickLimeT,
  scoreTickPhase
} from './scoreTick'

describe('scoreTickChange', () => {
  it('a pts increase produces a positive delta label', () => {
    const change = scoreTickChange(12.1, 18.3)
    expect(change).toEqual({ delta: 6.2, celebrate: true })
    expect(scoreTickLabel('delta', 18.3, change!.delta)).toBe('+6.2')
    expect(scoreTickLabel('settle', 18.3, change!.delta)).toBe('18.3')
    expect(scoreTickLabel('idle', 18.3, change!.delta)).toBe('18.3')
  })

  it('zero-change polls and missing values do not flash', () => {
    expect(scoreTickChange(12.1, 12.1)).toBeNull()
    expect(scoreTickChange(12.14, 12.06)).toBeNull()
    expect(scoreTickChange(undefined, 18.3)).toBeNull()
    expect(scoreTickChange(12.1, undefined)).toBeNull()
  })

  it('a correction drop does not celebrate', () => {
    const change = scoreTickChange(18.3, 12.1)
    expect(change).toEqual({ delta: -6.2, celebrate: false })
    expect(scoreTickPhase(200, false)).toBe('idle')
    expect(scoreTickLabel('idle', 12.1, change!.delta)).toBe('12.1')
  })
})

describe('scoreTickPhase', () => {
  it('holds the +delta, then settles, then returns to idle', () => {
    expect(scoreTickPhase(0, true)).toBe('delta')
    expect(scoreTickPhase(SCORE_TICK_DELTA_MS - 1, true)).toBe('delta')
    expect(scoreTickPhase(SCORE_TICK_DELTA_MS, true)).toBe('settle')
    expect(scoreTickPhase(SCORE_TICK_SETTLE_MS - 1, true)).toBe('settle')
    expect(scoreTickPhase(SCORE_TICK_SETTLE_MS, true)).toBe('idle')
    expect(scoreTickLimeT(0, true)).toBe(1)
    expect(scoreTickLimeT(SCORE_TICK_SETTLE_MS, true)).toBe(0)
  })
})

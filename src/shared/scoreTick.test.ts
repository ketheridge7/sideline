import { describe, expect, it } from 'vitest'
import {
  SCORE_TICK_DELTA_MS,
  SCORE_TICK_SETTLE_MS,
  scoreTickChange,
  scoreTickLabel,
  scoreTickLimeT,
  scoreTickPhase,
  scoreTickRedT
} from './scoreTick'

describe('scoreTickChange', () => {
  it('a pts increase produces a positive delta label', () => {
    const change = scoreTickChange(12.1, 18.3)
    expect(change).toEqual({ delta: 6.2, kind: 'up', celebrate: true })
    expect(scoreTickLabel('delta', 18.3, change!.delta)).toBe('+6.2')
    expect(scoreTickLabel('settle', 18.3, change!.delta)).toBe('18.3')
    expect(scoreTickLabel('idle', 18.3, change!.delta)).toBe('18.3')
    expect(scoreTickLimeT(0, change!.kind)).toBe(1)
    expect(scoreTickRedT(0, change!.kind)).toBe(0)
  })

  it('zero-change polls and missing values do not flash', () => {
    expect(scoreTickChange(12.1, 12.1)).toBeNull()
    expect(scoreTickChange(12.14, 12.06)).toBeNull()
    expect(scoreTickChange(undefined, 18.3)).toBeNull()
    expect(scoreTickChange(12.1, undefined)).toBeNull()
  })

  it('a correction drop does not celebrate', () => {
    const change = scoreTickChange(18.3, 12.1)
    expect(change).toEqual({ delta: -6.2, kind: 'down', celebrate: false })
    expect(scoreTickPhase(200, false)).toBe('idle')
    expect(scoreTickPhase(200, change!.celebrate)).toBe('idle')
    expect(scoreTickLabel('idle', 12.1, change!.delta)).toBe('12.1')
  })

  it('a pts drop is a first-class negative tag, not idle', () => {
    const change = scoreTickChange(18.3, 12.1)
    expect(change).toEqual({ delta: -6.2, kind: 'down', celebrate: false })
    expect(scoreTickPhase(0, change!.kind)).toBe('delta')
    expect(scoreTickPhase(200, change!.kind)).toBe('delta')
    expect(scoreTickPhase(SCORE_TICK_DELTA_MS - 1, 'down')).toBe('delta')
    expect(scoreTickLabel('delta', 12.1, change!.delta)).toBe('-6.2')
    expect(scoreTickLabel('settle', 12.1, change!.delta)).toBe('12.1')
    expect(scoreTickRedT(0, 'down')).toBe(1)
    expect(scoreTickRedT(SCORE_TICK_DELTA_MS - 1, 'down')).toBe(1)
    expect(scoreTickRedT(SCORE_TICK_DELTA_MS, 'down')).toBeLessThan(1)
    expect(scoreTickRedT(SCORE_TICK_SETTLE_MS, 'down')).toBe(0)
    expect(scoreTickLimeT(0, 'down')).toBe(0)
    expect(scoreTickLimeT(200, false)).toBe(0)
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
    expect(scoreTickLimeT(SCORE_TICK_DELTA_MS - 1, true)).toBe(1)
    expect(scoreTickLimeT(SCORE_TICK_DELTA_MS, true)).toBeLessThan(1)
    expect(scoreTickLimeT(SCORE_TICK_SETTLE_MS, true)).toBe(0)
    expect(scoreTickLimeT(0, 'up')).toBe(1)
    expect(scoreTickRedT(0, 'up')).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import { isLikelyLive, pollIntervalMs } from './liveWindow'

const et = (isoUtc: string): Date => new Date(isoUtc)

describe('isLikelyLive', () => {
  it('is live Sunday afternoon Eastern during regular season', () => {
    expect(isLikelyLive(et('2026-09-13T18:00:00Z'), 'regular')).toBe(true)
  })

  it('is idle Sunday morning Eastern', () => {
    expect(isLikelyLive(et('2026-09-13T15:00:00Z'), 'regular')).toBe(false)
  })

  it('is idle in preseason even on Sunday', () => {
    expect(isLikelyLive(et('2026-08-30T18:00:00Z'), 'pre')).toBe(false)
  })

  it('uses 10s when live and 30s when idle', () => {
    expect(pollIntervalMs(true)).toBe(10_000)
    expect(pollIntervalMs(false)).toBe(30_000)
  })
})

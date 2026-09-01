import { describe, expect, it } from 'vitest'
import { isLikelyLive, nextPollDelayMs, pollIntervalMs } from './liveWindow'

const et = (isoUtc: string): Date => new Date(isoUtc)

describe('isLikelyLive', () => {
  it('is live Sunday afternoon Eastern during regular season', () => {
    expect(isLikelyLive(et('2026-09-13T18:00:00Z'), 'regular')).toBe(true)
  })

  it('is live Sunday at London kickoff Eastern', () => {
    expect(isLikelyLive(et('2026-09-13T13:35:00Z'), 'regular')).toBe(true)
  })

  it('is idle Sunday before 9a Eastern', () => {
    expect(isLikelyLive(et('2026-09-13T12:00:00Z'), 'regular')).toBe(false)
  })

  it('is live Saturday afternoon Eastern', () => {
    expect(isLikelyLive(et('2026-12-26T18:00:00Z'), 'regular')).toBe(true)
  })

  it('is live Thanksgiving 12:30p Eastern', () => {
    expect(isLikelyLive(et('2026-11-26T17:30:00Z'), 'regular')).toBe(true)
  })

  it('is idle in preseason even on Sunday', () => {
    expect(isLikelyLive(et('2026-08-30T18:00:00Z'), 'pre')).toBe(false)
  })

  it('uses 3s when live and 30s when idle', () => {
    expect(pollIntervalMs(true)).toBe(3_000)
    expect(pollIntervalMs(false)).toBe(30_000)
  })

  it('counts poll interval start-to-start so a slow refresh does not add delay', () => {
    expect(nextPollDelayMs(3_000, 800)).toBe(2_200)
    expect(nextPollDelayMs(3_000, 3_500)).toBe(0)
  })
})

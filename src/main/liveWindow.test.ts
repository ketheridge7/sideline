import { describe, expect, it, vi } from 'vitest'
import { createLanPowerController, isLikelyLive, lanPowerSavePlan, nextPollDelayMs, pollIntervalMs } from './liveWindow'

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

describe('lanPowerSavePlan', () => {
  it('holds only while the LAN overlay is on during a live window', () => {
    expect(lanPowerSavePlan({ lanEnabled: true, live: true })).toBe('hold')
    expect(lanPowerSavePlan({ lanEnabled: true, live: false })).toBe('release')
    expect(lanPowerSavePlan({ lanEnabled: false, live: true })).toBe('release')
    expect(lanPowerSavePlan({ lanEnabled: false, live: false })).toBe('release')
  })

  it('starts prevent-app-suspension once and stops when the live window or LAN ends', () => {
    const started: string[] = []
    let active = false
    const onStart = vi.fn()
    const onStop = vi.fn()
    const controller = createLanPowerController(
      {
        start: (type) => {
          started.push(type)
          active = true
          return 7
        },
        stop: () => {
          active = false
        },
        isStarted: () => active
      },
      { onStart, onStop }
    )
    controller.sync(false, true)
    controller.sync(true, false)
    expect(started).toEqual([])
    controller.sync(true, true)
    controller.sync(true, true)
    expect(started).toEqual(['prevent-app-suspension'])
    expect(onStart).toHaveBeenCalledTimes(1)
    controller.sync(true, false)
    expect(active).toBe(false)
    expect(onStop).toHaveBeenCalledTimes(1)
    controller.sync(false, false)
    expect(onStop).toHaveBeenCalledTimes(1)
  })
})

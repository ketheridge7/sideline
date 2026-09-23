import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { writeFileSync } from 'fs'
import { join } from 'path'

vi.mock('electron', () => {
  const fs = require('fs') as typeof import('fs')
  const os = require('os') as typeof import('os')
  const path = require('path') as typeof import('path')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sideline-replay-'))
  return {
    app: { getPath: () => dir },
    BrowserWindow: class {},
    session: {
      fromPartition: () => ({
        cookies: { get: async () => [] },
        clearStorageData: async () => undefined
      })
    }
  }
})

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }))

vi.mock('./windows/espnLogin', () => ({
  readEspnCookies: async () => null
}))

import { app } from 'electron'
import { currentState, refresh, resetPollerForTests, warmupPollerCaches } from './poller'
import { resetReplayTick } from './providers/replay'

describe('replay poller', () => {
  beforeEach(() => {
    process.env.SIDELINE_REPLAY = '1'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('replay must not hit the network')
      })
    )
  })

  afterEach(() => {
    delete process.env.SIDELINE_REPLAY
    resetPollerForTests()
    resetReplayTick()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('keeps demo names even when a live Sleeper player dump is cached on disk', async () => {
    writeFileSync(
      join(app.getPath('userData'), 'sleeper-players.json'),
      JSON.stringify({ fetchedAt: Date.now(), players: { '4034': { name: 'Some Live Player', position: 'RB', nflTeam: 'SF' } } })
    )
    warmupPollerCaches()
    await refresh({ waitForBoards: true })
    await refresh({ waitForBoards: true })
    const state = currentState()
    expect(state.replay).toBe(true)
    expect(state.matchup?.myTeam.name).toBe('Ice Box')
    const names = [...(state.matchup?.starters ?? []), ...(state.matchup?.bench ?? [])].map((row) => row.name)
    expect(names).toContain('Bijan Robinson')
    expect(names.some((name) => /^[a-z]+-[a-z-]+$/.test(name) || /^fng/i.test(name))).toBe(false)
    expect(state.matchup?.starters.every((row) => row.position !== '?')).toBe(true)
  })

  it('moves the selected HUD on every poll instead of freezing on the first paint', async () => {
    await refresh({ waitForBoards: true })
    const opening = currentState().matchup
    expect(opening?.myTeam.name).toBe('Ice Box')
    await refresh({ waitForBoards: true })
    const next = currentState().matchup
    expect(next?.myPoints).toBeCloseTo((opening?.myPoints ?? 0) + 6.6)
    expect(next?.starters.find((row) => row.name === 'Bijan Robinson')?.tickDelta).toBe(6.6)
    await refresh({ waitForBoards: true })
    expect(currentState().matchup?.oppPoints).toBeCloseTo((opening?.oppPoints ?? 0) - 2)
    expect(currentState().tape.some((row) => row.player === 'Robinson ATL' && row.delta === 6.6)).toBe(true)
  })

  it('schedules the next demo poll after the HUD has painted', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await refresh()
    await refresh()
    const totals = (): string => `${currentState().matchup?.myPoints}/${currentState().matchup?.oppPoints}`
    const before = totals()
    await vi.advanceTimersByTimeAsync(3_500)
    await vi.advanceTimersByTimeAsync(3_500)
    await vi.waitFor(() => expect(totals()).not.toBe(before))
  })
})

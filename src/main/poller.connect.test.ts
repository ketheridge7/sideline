import { afterEach, describe, expect, it, vi } from 'vitest'
import { writeFileSync } from 'fs'
import { join } from 'path'

vi.mock('electron', () => {
  const fs = require('fs') as typeof import('fs')
  const os = require('os') as typeof import('os')
  const path = require('path') as typeof import('path')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sideline-connect-'))
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

const espnAuth = vi.hoisted(() => ({
  cookies: null as { espn_s2: string; SWID: string } | null
}))

vi.mock('./windows/espnLogin', () => ({
  readEspnCookies: async () => espnAuth.cookies
}))

import { app } from 'electron'
import { loadSettings, saveSettings } from './store'
import {
  addEspnLeagueId,
  connectSleeper,
  currentState,
  listDiscoverableLeagues,
  refresh,
  resetPollerForTests,
  setSelectedLeagueIds,
  warmupPollerCaches
} from './poller'

afterEach(() => {
  resetPollerForTests()
  espnAuth.cookies = null
  saveSettings({
    sleeperUsername: null,
    sleeperUserId: null,
    sleeperLeagueIds: null,
    espnLeagueIds: [],
    selectedLeagueKey: null,
    pinnedLeagueKeys: []
  })
  vi.unstubAllGlobals()
})

const jsonOk = (body: unknown) => ({
  ok: true,
  status: 200,
  headers: { get: () => 'application/json' },
  json: async () => body
})

const writeNfl = (dir: string): void => {
  writeFileSync(
    join(dir, 'sideline-nfl.json'),
    JSON.stringify({
      at: Date.now(),
      nfl: {
        week: 1,
        displayWeek: 1,
        season: '2026',
        leagueSeason: '2026',
        seasonType: 'regular'
      }
    })
  )
}

const sleeperLeaguesPayload = [
  { league_id: '11', name: 'Friday Night', season: '2026' },
  { league_id: '22', name: 'Fourth & Drunken', season: '2026' }
]

describe('poller connect league selection', () => {
  it('connects Sleeper without importing every league, then add-selected lands the allowlist on Boards', async () => {
    const dir = app.getPath('userData')
    writeNfl(dir)
    warmupPollerCaches()

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/user/tester') && !url.includes('/leagues/')) {
          return jsonOk({ user_id: 'me', username: 'tester' })
        }
        if (url.includes('/leagues/nfl/')) return jsonOk(sleeperLeaguesPayload)
        if (url.includes('/state/nfl')) {
          return jsonOk({
            week: 1,
            display_week: 1,
            season: '2026',
            league_season: '2026',
            season_type: 'regular'
          })
        }
        if (url.includes('scoreboard')) return jsonOk({ events: [] })
        return jsonOk([])
      })
    )

    const connected = await connectSleeper('tester')
    expect(connected.ok).toBe(true)
    expect(loadSettings().sleeperLeagueIds).toEqual([])
    expect(currentState().leagues.filter((row) => row.provider === 'sleeper')).toEqual([])

    const listed = await listDiscoverableLeagues('sleeper')
    expect(listed.ok).toBe(true)
    expect(listed.leagues.map((row) => row.id).sort()).toEqual(['11', '22'])
    expect(listed.leagues.map((row) => row.name)).toContain('Friday Night')

    const added = await setSelectedLeagueIds('sleeper', ['11'])
    expect(added.ok).toBe(true)
    expect(currentState().leagues.filter((row) => row.provider === 'sleeper').map((row) => row.id)).toEqual(['11'])
    expect(currentState().leagues.some((row) => row.id === '22')).toBe(false)
  })

  it('discovers ESPN fan leagues for the picker without auto-adding them to Boards', async () => {
    const dir = app.getPath('userData')
    writeNfl(dir)
    espnAuth.cookies = { espn_s2: 's2', SWID: '{11111111-1111-1111-1111-111111111111}' }
    saveSettings({ espnLeagueIds: [], sleeperUsername: null, sleeperUserId: null, sleeperLeagueIds: null })
    warmupPollerCaches()

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/apis/v2/fans/')) {
          return jsonOk({
            favoriteLeagues: [
              { leagueId: '111', leagueName: 'Gridiron Gurus', sport: 'ffl' },
              { leagueId: '222', leagueName: 'Dawg Pound', sport: 'ffl' }
            ]
          })
        }
        if (url.includes('scoreboard')) return jsonOk({ events: [] })
        if (url.includes('/state/nfl')) {
          return jsonOk({
            week: 1,
            display_week: 1,
            season: '2026',
            league_season: '2026',
            season_type: 'regular'
          })
        }
        return jsonOk({ teams: [], schedule: [] })
      })
    )

    await refresh({ waitForBoards: true })
    expect(loadSettings().espnLeagueIds).toEqual([])
    expect(currentState().leagues.filter((row) => row.provider === 'espn')).toEqual([])

    const listed = await listDiscoverableLeagues('espn')
    expect(listed.ok).toBe(true)
    expect(listed.leagues.map((row) => row.id).sort()).toEqual(['111', '222'])

    const added = await setSelectedLeagueIds('espn', ['222'])
    expect(added.ok).toBe(true)
    expect(currentState().leagues.filter((row) => row.provider === 'espn').map((row) => row.id)).toEqual(['222'])
  })

  it('does not join a stale refresh when an ESPN league is added while that refresh is pending', async () => {
    const dir = app.getPath('userData')
    writeNfl(dir)
    espnAuth.cookies = { espn_s2: 's2', SWID: '{11111111-1111-1111-1111-111111111111}' }
    saveSettings({ espnLeagueIds: ['111'], sleeperUsername: null, sleeperUserId: null, sleeperLeagueIds: null })
    warmupPollerCaches()

    let releaseFirst: () => void = () => undefined
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const leagueUrls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/leagues/')) leagueUrls.push(url)
        if (url.includes('/state/nfl')) {
          return jsonOk({
            week: 1,
            display_week: 1,
            season: '2026',
            league_season: '2026',
            season_type: 'regular'
          })
        }
        if (url.includes('scoreboard')) return jsonOk({ events: [] })
        if (url.includes('/apis/v2/fans/')) return jsonOk({ favoriteLeagues: [] })
        if (url.includes('/leagues/111') && url.includes('mSettings')) {
          await firstGate
          return jsonOk({ id: 111, settings: { name: 'Old League' }, teams: [], schedule: [] })
        }
        if (url.includes('/leagues/222')) {
          return jsonOk({ id: 222, settings: { name: 'Added League' }, teams: [], schedule: [] })
        }
        return jsonOk({ teams: [], schedule: [], scoringPeriodId: 1 })
      })
    )

    const first = refresh({ waitForBoards: true })
    try {
      await vi.waitFor(() => {
        expect(leagueUrls.some((url) => url.includes('/leagues/111') && url.includes('mSettings'))).toBe(true)
      })
      const added = addEspnLeagueId('222')
      await vi.waitFor(() => {
        expect(leagueUrls.some((url) => url.includes('/leagues/222'))).toBe(true)
      })
      releaseFirst()
      const result = await added
      expect(result).toEqual({ ok: true })
      expect(currentState().leagues.filter((row) => row.provider === 'espn').map((row) => row.id).sort()).toEqual([
        '111',
        '222'
      ])
      await first
    } finally {
      releaseFirst()
    }
  })
})

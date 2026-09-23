import { afterEach, describe, expect, it, vi } from 'vitest'
import { writeFileSync, existsSync, unlinkSync, readFileSync } from 'fs'
import { join } from 'path'
import { leagueKey, toOverlayHud } from '@shared/types'
import { espnBoardUx, espnIndicatorHealthy } from '@shared/display'

vi.mock('electron', () => {
  const fs = require('fs') as typeof import('fs')
  const os = require('os') as typeof import('os')
  const path = require('path') as typeof import('path')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sideline-poller-'))
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
import { saveSettings } from './store'
import { warmupPollerCaches, refresh, resetPollerForTests, currentState, invalidateEspnSession, primeEspnCookies, setOverlayVisible } from './poller'
import { runtime } from './runtime'

afterEach(() => {
  resetPollerForTests()
  espnAuth.cookies = null
  vi.unstubAllGlobals()
})

const jsonOk = (body: unknown) => ({
  ok: true,
  status: 200,
  headers: { get: () => 'application/json' },
  json: async () => body
})

const nflDisk = {
  at: Date.now(),
  nfl: {
    week: 1,
    displayWeek: 1,
    season: '2026',
    leagueSeason: '2026',
    seasonType: 'regular'
  }
}

const hudMatchup = {
  myTeam: { id: '1', name: 'Mine', owner: 'Me', record: '1-0' },
  oppTeam: { id: '2', name: 'Yours', owner: 'You', record: '0-1' },
  myPoints: 10,
  oppPoints: 8,
  starters: [{ playerId: '1', name: 'Hurts', position: 'QB', nflTeam: 'PHI', points: 10 }],
  bench: [] as { playerId: string; name: string; position: string; nflTeam: string; points: number }[],
  oppStarters: [{ playerId: '3', name: 'Allen', position: 'QB', nflTeam: 'BUF', points: 8 }],
  oppBench: [] as { playerId: string; name: string; position: string; nflTeam: string; points: number }[]
}

const sleeperMatchups = [
  {
    roster_id: 1,
    matchup_id: 7,
    points: 12.5,
    starters: ['1'],
    players: ['1'],
    players_points: { '1': 12.5 }
  },
  {
    roster_id: 2,
    matchup_id: 7,
    points: 9,
    starters: ['3'],
    players: ['3'],
    players_points: { '3': 9 }
  }
]

const writeNfl = (dir: string): void => {
  writeFileSync(join(dir, 'sideline-nfl.json'), JSON.stringify({ ...nflDisk, at: Date.now() }))
}

describe('poller live tick order', () => {
  it('kicks Sleeper /matchups before GET /leagues, /players/nfl, and the NFL scoreboard', async () => {
    const dir = app.getPath('userData')
    const leagueId = '123456789'
    const selectedKey = leagueKey('sleeper', leagueId)
    saveSettings({
      sleeperUsername: 'tester',
      sleeperUserId: 'me',
      selectedLeagueKey: selectedKey
    })
    writeNfl(dir)
    writeFileSync(
      join(dir, 'sideline-last-hud.json'),
      JSON.stringify({
        at: Date.now(),
        displayWeek: 1,
        selectedKey,
        matchup: hudMatchup
      })
    )
    warmupPollerCaches()

    const urls: string[] = []
    const inits: Array<{ priority?: string }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: { priority?: string }) => {
        urls.push(url)
        inits.push(init ?? {})
        if (url.includes('/matchups/')) return jsonOk(sleeperMatchups)
        if (url.includes('/state/nfl')) {
          return jsonOk({
            week: 1,
            display_week: 1,
            season: '2026',
            league_season: '2026',
            season_type: 'regular'
          })
        }
        if (url.includes('/leagues/')) return jsonOk([])
        if (url.includes('/players/nfl')) return jsonOk({})
        if (url.includes('scoreboard')) return jsonOk({ events: [] })
        return jsonOk([])
      })
    )

    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().matchup?.myPoints).toBe(12.5)
    await expect.poll(() => currentState().matchup?.oppPoints).toBe(9)
    await expect.poll(() => currentState().matchup?.starters[0]?.points).toBe(12.5)
    await expect.poll(() => currentState().selectedLeagueKey).toBe(selectedKey)

    expect(urls[0]).toContain('/state/nfl')
    const matchupsAt = urls.findIndex((url) => url.includes('/matchups/'))
    const leaguesAt = urls.findIndex((url) => url.includes('/leagues/'))
    const playersAt = urls.findIndex((url) => url.includes('/players/nfl'))
    const scoreboardAt = urls.findIndex((url) => url.includes('scoreboard'))
    expect(matchupsAt).toBeGreaterThan(0)
    expect(inits[matchupsAt]?.priority).toBe('high')
    expect(urls[matchupsAt]).toContain(`/league/${leagueId}/matchups/1`)
    expect(urls[matchupsAt]).toContain('?_=')
    if (leaguesAt >= 0) expect(matchupsAt).toBeLessThan(leaguesAt)
    if (playersAt >= 0) expect(matchupsAt).toBeLessThan(playersAt)
    if (scoreboardAt >= 0) {
      expect(matchupsAt).toBeLessThan(scoreboardAt)
      expect(inits[scoreboardAt]?.priority).toBe('low')
    }
  })

  it('kicks ESPN mLiveScoring before mTeam, discovery, and the NFL scoreboard', async () => {
    const dir = app.getPath('userData')
    const leagueId = '899513'
    const selectedKey = leagueKey('espn', leagueId)
    saveSettings({
      sleeperUsername: null,
      sleeperUserId: null,
      selectedLeagueKey: selectedKey,
      espnLeagueIds: [leagueId]
    })
    writeNfl(dir)
    writeFileSync(
      join(dir, 'sideline-last-hud.json'),
      JSON.stringify({
        at: Date.now(),
        displayWeek: 1,
        selectedKey,
        matchup: hudMatchup
      })
    )
    warmupPollerCaches()

    const urls: string[] = []
    const inits: Array<{ priority?: string }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: { priority?: string }) => {
        urls.push(url)
        inits.push(init ?? {})
        if (url.includes('mLiveScoring')) {
          return jsonOk({
            scoringPeriodId: 1,
            schedule: [
              {
                matchupPeriodId: 1,
                home: { teamId: 1, totalPointsLive: 12.5 },
                away: { teamId: 2, totalPointsLive: 9 }
              }
            ],
            liveScoring: {
              teams: [
                {
                  teamId: 1,
                  totalPointsLive: 12.5,
                  players: [{ playerId: 1, totalPointsLive: 12.5 }]
                },
                {
                  teamId: 2,
                  totalPointsLive: 9,
                  players: [{ playerId: 3, totalPointsLive: 9 }]
                }
              ]
            }
          })
        }
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
        return jsonOk({ teams: [], schedule: [] })
      })
    )

    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().matchup?.myPoints).toBe(12.5)
    await expect.poll(() => currentState().matchup?.oppPoints).toBe(9)
    await expect.poll(() => currentState().matchup?.starters[0]?.points).toBe(12.5)
    await expect.poll(() => currentState().selectedLeagueKey).toBe(selectedKey)

    const liveAt = urls.findIndex((url) => url.includes('view=mLiveScoring'))
    const teamAt = urls.findIndex((url) => url.includes('view=mTeam'))
    const settingsAt = urls.findIndex((url) => url.includes('view=mSettings'))
    const scoreboardAt = urls.findIndex((url) => url.includes('scoreboard'))
    expect(urls[0]).toContain('/state/nfl')
    expect(liveAt).toBeGreaterThan(0)
    expect(inits[liveAt]?.priority).toBe('high')
    expect(urls[liveAt]).toContain('lm-api-reads.fantasy.espn.com')
    expect(urls[liveAt]).not.toContain('view=mTeam')
    expect(urls[liveAt]).not.toContain('view=mScoreboard')
    if (teamAt >= 0) expect(liveAt).toBeLessThan(teamAt)
    if (settingsAt >= 0) expect(liveAt).toBeLessThan(settingsAt)
    if (scoreboardAt >= 0) {
      expect(liveAt).toBeLessThan(scoreboardAt)
      expect(inits[scoreboardAt]?.priority).toBe('low')
    }
  })

  it('recovers mMatchupScore immediately when compact mLiveScoring fails', async () => {
    const dir = app.getPath('userData')
    const leagueId = '899514'
    const selectedKey = leagueKey('espn', leagueId)
    saveSettings({
      sleeperUsername: null,
      sleeperUserId: null,
      selectedLeagueKey: selectedKey,
      espnLeagueIds: [leagueId]
    })
    writeNfl(dir)
    const scoresPath = join(dir, 'sideline-espn-scores.json')
    if (existsSync(scoresPath)) unlinkSync(scoresPath)
    writeFileSync(
      join(dir, 'sideline-last-hud.json'),
      JSON.stringify({
        at: Date.now(),
        displayWeek: 1,
        selectedKey,
        matchup: hudMatchup
      })
    )
    warmupPollerCaches()

    const urls: string[] = []
    const inits: Array<{ priority?: string }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: { priority?: string }) => {
        urls.push(url)
        inits.push(init ?? {})
        if (url.includes('mLiveScoring') && !url.includes('mMatchupScore')) {
          return { ok: false, status: 500, headers: { get: () => 'application/json' }, json: async () => ({}) }
        }
        if (url.includes('mMatchupScore')) {
          return jsonOk({
            scoringPeriodId: 1,
            schedule: [
              {
                matchupPeriodId: 1,
                home: { teamId: 1, totalPointsLive: 12.5 },
                away: { teamId: 2, totalPointsLive: 9 }
              }
            ],
            liveScoring: {
              teams: [
                {
                  teamId: 1,
                  totalPointsLive: 12.5,
                  players: [{ playerId: 1, totalPointsLive: 12.5 }]
                },
                {
                  teamId: 2,
                  totalPointsLive: 9,
                  players: [{ playerId: 3, totalPointsLive: 9 }]
                }
              ]
            }
          })
        }
        if (url.includes('scoreboard')) return jsonOk({ events: [] })
        return jsonOk({ teams: [], schedule: [] })
      })
    )

    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().matchup?.myPoints).toBe(12.5)
    await expect.poll(() => currentState().matchup?.starters[0]?.points).toBe(12.5)

    const liveAt = urls.findIndex((url) => url.includes('view=mLiveScoring') && !url.includes('mMatchupScore'))
    const boxAt = urls.findIndex((url) => url.includes('view=mMatchupScore'))
    const scoreboardAt = urls.findIndex((url) => url.includes('scoreboard'))
    expect(urls.join('\n')).toContain('mMatchupScore')
    expect(urls[0]).toContain('/state/nfl')
    expect(liveAt).toBeGreaterThan(0)
    expect(boxAt).toBeGreaterThan(liveAt)
    expect(inits[boxAt]?.priority).toBe('high')
    if (scoreboardAt >= 0) expect(boxAt).toBeLessThan(scoreboardAt)
  })

  it('kicks mMatchupScore first on a true-cold ESPN HUD so compact stubs cannot paint a bye', async () => {
    const dir = app.getPath('userData')
    const leagueId = '899516'
    const selectedKey = leagueKey('espn', leagueId)
    saveSettings({
      sleeperUsername: null,
      sleeperUserId: null,
      selectedLeagueKey: selectedKey,
      espnLeagueIds: [leagueId]
    })
    writeNfl(dir)
    const hudPath = join(dir, 'sideline-last-hud.json')
    if (existsSync(hudPath)) unlinkSync(hudPath)
    const scoresPath = join(dir, 'sideline-espn-scores.json')
    if (existsSync(scoresPath)) unlinkSync(scoresPath)
    warmupPollerCaches()

    const urls: string[] = []
    const inits: Array<{ priority?: string }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: { priority?: string }) => {
        urls.push(url)
        inits.push(init ?? {})
        if (url.includes('mLiveScoring') && !url.includes('mMatchupScore')) {
          return jsonOk({
            scoringPeriodId: 1,
            id: Number(leagueId),
            schedule: [{ matchupPeriodId: 1 }]
          })
        }
        if (url.includes('mMatchupScore')) {
          return jsonOk({
            scoringPeriodId: 1,
            teams: [
              { id: 1, location: 'Mine', nickname: 'Team' },
              { id: 2, location: 'Yours', nickname: 'Club' }
            ],
            schedule: [
              {
                matchupPeriodId: 1,
                home: { teamId: 1, totalPointsLive: 12.5 },
                away: { teamId: 2, totalPointsLive: 9 }
              }
            ],
            liveScoring: {
              teams: [
                {
                  teamId: 1,
                  totalPointsLive: 12.5,
                  players: [{ playerId: 1, totalPointsLive: 12.5 }]
                },
                {
                  teamId: 2,
                  totalPointsLive: 9,
                  players: [{ playerId: 3, totalPointsLive: 9 }]
                }
              ]
            }
          })
        }
        if (url.includes('scoreboard')) return jsonOk({ events: [] })
        return jsonOk({ teams: [], schedule: [] })
      })
    )

    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().matchup?.myPoints).toBe(12.5)

    const liveAt = urls.findIndex((url) => url.includes('view=mLiveScoring') && !url.includes('mMatchupScore'))
    const boxAt = urls.findIndex((url) => url.includes('view=mMatchupScore'))
    expect(boxAt).toBeGreaterThanOrEqual(0)
    expect(urls[boxAt]).toContain('view=mMatchupScore')
    expect(inits[boxAt]?.priority).toBe('high')
    if (liveAt >= 0) expect(boxAt).toBeLessThan(liveAt)
  })

  it('starts a cold Sleeper /matchups GET before rosters, leagues, and the scoreboard', async () => {
    const dir = app.getPath('userData')
    const leagueId = '123456789'
    saveSettings({
      sleeperUsername: 'tester',
      sleeperUserId: 'me',
      selectedLeagueKey: leagueKey('sleeper', leagueId),
      espnLeagueIds: [],
      pinnedLeagueKeys: []
    })
    writeNfl(dir)
    const hudPath = join(dir, 'sideline-last-hud.json')
    if (existsSync(hudPath)) unlinkSync(hudPath)
    warmupPollerCaches()

    const urls: string[] = []
    const inits: Array<{ priority?: string }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: { priority?: string }) => {
        urls.push(url)
        inits.push(init ?? {})
        if (url.includes('/matchups/')) return jsonOk(sleeperMatchups)
        if (url.includes('/rosters')) {
          return jsonOk([
            { roster_id: 1, owner_id: 'me', settings: { wins: 1, losses: 0 } },
            { roster_id: 2, owner_id: 'them', settings: { wins: 0, losses: 1 } }
          ])
        }
        if (url.includes('/league/') && url.includes('/users')) {
          return jsonOk([
            { user_id: 'me', display_name: 'Me', metadata: { team_name: 'Mine' } },
            { user_id: 'them', display_name: 'You', metadata: { team_name: 'Yours' } }
          ])
        }
        if (url.includes('/state/nfl')) {
          return jsonOk({
            week: 1,
            display_week: 1,
            season: '2026',
            league_season: '2026',
            season_type: 'regular'
          })
        }
        if (url.includes('/leagues/')) return jsonOk([])
        if (url.includes('scoreboard')) return jsonOk({ events: [] })
        return jsonOk([])
      })
    )

    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().matchup?.myPoints).toBe(12.5)

    const matchupsAt = urls.findIndex((url) => url.includes('/matchups/'))
    const rostersAt = urls.findIndex((url) => url.includes('/rosters'))
    const leaguesAt = urls.findIndex((url) => url.includes('/leagues/'))
    const scoreboardAt = urls.findIndex((url) => url.includes('scoreboard'))
    expect(matchupsAt).toBeGreaterThan(0)
    expect(urls[0]).toContain('/state/nfl')
    expect(inits[matchupsAt]?.priority).toBe('high')
    const usersAt = urls.findIndex((url) => url.includes('/users'))
    if (rostersAt >= 0) {
      expect(matchupsAt).toBeLessThan(rostersAt)
      expect(inits[rostersAt]?.priority).toBe('low')
    }
    if (usersAt >= 0) expect(inits[usersAt]?.priority).toBe('low')
    if (leaguesAt >= 0) expect(matchupsAt).toBeLessThan(leaguesAt)
    if (scoreboardAt >= 0) {
      expect(matchupsAt).toBeLessThan(scoreboardAt)
      expect(inits[scoreboardAt]?.priority).toBe('low')
    }
  })

  it('does not refetch Sleeper /matchups after GET /user on a true-cold HUD', async () => {
    const dir = app.getPath('userData')
    const leagueId = '123456789'
    saveSettings({
      sleeperUsername: 'tester',
      sleeperUserId: null,
      selectedLeagueKey: leagueKey('sleeper', leagueId),
      espnLeagueIds: [],
      pinnedLeagueKeys: []
    })
    writeNfl(dir)
    const hudPath = join(dir, 'sideline-last-hud.json')
    if (existsSync(hudPath)) unlinkSync(hudPath)
    warmupPollerCaches()

    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url)
        if (url.includes('/user/tester')) {
          await new Promise((resolve) => setTimeout(resolve, 80))
          return jsonOk({ user_id: 'me', username: 'tester' })
        }
        if (url.includes('/matchups/')) return jsonOk(sleeperMatchups)
        if (url.includes('/rosters')) {
          return jsonOk([
            { roster_id: 1, owner_id: 'me', settings: { wins: 1, losses: 0 } },
            { roster_id: 2, owner_id: 'them', settings: { wins: 0, losses: 1 } }
          ])
        }
        if (url.includes('/league/') && url.includes('/users')) {
          return jsonOk([
            { user_id: 'me', display_name: 'Me', metadata: { team_name: 'Mine' } },
            { user_id: 'them', display_name: 'You', metadata: { team_name: 'Yours' } }
          ])
        }
        if (url.includes('/state/nfl')) {
          return jsonOk({
            week: 1,
            display_week: 1,
            season: '2026',
            league_season: '2026',
            season_type: 'regular'
          })
        }
        if (url.includes('/leagues/')) return jsonOk([])
        if (url.includes('scoreboard')) return jsonOk({ events: [] })
        return jsonOk([])
      })
    )

    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().matchup?.myPoints).toBe(12.5)
    expect(urls.filter((url) => url.includes('/matchups/'))).toHaveLength(1)
    expect(urls.some((url) => url.includes('/user/tester'))).toBe(true)
  })

  it('does not refetch selected Sleeper /matchups when rest prefetch already has that league', async () => {
    const dir = app.getPath('userData')
    const leagueId = '123456789'
    const restId = '987654321'
    const selectedKey = leagueKey('sleeper', leagueId)
    saveSettings({
      sleeperUsername: 'tester',
      sleeperUserId: 'me',
      selectedLeagueKey: selectedKey,
      espnLeagueIds: [],
      pinnedLeagueKeys: [leagueKey('sleeper', restId)]
    })
    writeNfl(dir)
    writeFileSync(
      join(dir, 'sideline-last-hud.json'),
      JSON.stringify({
        at: Date.now(),
        displayWeek: 1,
        selectedKey,
        matchup: hudMatchup
      })
    )
    writeFileSync(
      join(dir, 'sideline-sleeper-leagues.json'),
      JSON.stringify({
        at: Date.now(),
        username: 'tester',
        season: '2026',
        leagues: [
          { id: leagueId, name: 'Mine', provider: 'sleeper', season: '2026', week: 1 },
          { id: restId, name: 'Other', provider: 'sleeper', season: '2026', week: 1 }
        ]
      })
    )
    warmupPollerCaches()

    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url)
        if (url.includes('/matchups/')) return jsonOk(sleeperMatchups)
        if (url.includes('/rosters')) {
          return jsonOk([
            { roster_id: 1, owner_id: 'me', settings: { wins: 1, losses: 0 } },
            { roster_id: 2, owner_id: 'them', settings: { wins: 0, losses: 1 } }
          ])
        }
        if (url.includes('/league/') && url.includes('/users')) {
          return jsonOk([
            { user_id: 'me', display_name: 'Me', metadata: { team_name: 'Mine' } },
            { user_id: 'them', display_name: 'You', metadata: { team_name: 'Yours' } }
          ])
        }
        if (url.includes('/state/nfl')) {
          return jsonOk({
            week: 1,
            display_week: 1,
            season: '2026',
            league_season: '2026',
            season_type: 'regular'
          })
        }
        if (url.includes('/leagues/')) return jsonOk([])
        if (url.includes('scoreboard')) return jsonOk({ events: [] })
        return jsonOk([])
      })
    )

    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().matchup?.myPoints).toBe(12.5)
    expect(urls.filter((url) => url.includes(`/league/${leagueId}/matchups/`))).toHaveLength(1)
  })

  it('kicks compact mLiveScoring first when ESPN boxscore is on disk without last HUD', async () => {
    const dir = app.getPath('userData')
    const leagueId = '899513'
    const selectedKey = leagueKey('espn', leagueId)
    saveSettings({
      sleeperUsername: null,
      sleeperUserId: null,
      selectedLeagueKey: selectedKey,
      espnLeagueIds: [leagueId]
    })
    writeNfl(dir)
    const hudPath = join(dir, 'sideline-last-hud.json')
    if (existsSync(hudPath)) unlinkSync(hudPath)
    writeFileSync(
      join(dir, 'sideline-espn-scores.json'),
      JSON.stringify({
        at: Date.now(),
        byId: {
          [leagueId]: {
            week: 1,
            payload: {
              scoringPeriodId: 1,
              teams: [
                { id: 1, location: 'Mine', nickname: 'Team' },
                { id: 2, location: 'Yours', nickname: 'Club' }
              ],
              schedule: [
                {
                  matchupPeriodId: 1,
                  home: { teamId: 1, totalPointsLive: 10 },
                  away: { teamId: 2, totalPointsLive: 8 }
                }
              ]
            }
          }
        }
      })
    )
    warmupPollerCaches()

    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url)
        if (url.includes('mLiveScoring') && !url.includes('mMatchupScore')) {
          return jsonOk({
            scoringPeriodId: 1,
            liveScoring: {
              teams: [
                { teamId: 1, totalPointsLive: 12.5 },
                { teamId: 2, totalPointsLive: 9 }
              ]
            }
          })
        }
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
        return jsonOk({ teams: [], schedule: [] })
      })
    )

    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().matchup?.myPoints).toBe(12.5)
    await expect.poll(() => currentState().selectedLeagueKey).toBe(selectedKey)

    expect(urls[0]).toContain('/state/nfl')
    const liveAt = urls.findIndex((url) => url.includes('view=mLiveScoring'))
    expect(liveAt).toBeGreaterThan(0)
    expect(urls[liveAt]).toContain('view=mLiveScoring')
    expect(urls[liveAt]).not.toContain('view=mMatchupScore')
    expect(urls[liveAt]).not.toContain('view=mTeam')
  })

  it('does not resurrect week-1 last-HUD points for week 2 when scores disk is 0-0', () => {
    const dir = app.getPath('userData')
    const leagueId = '543268341'
    const selectedKey = leagueKey('espn', leagueId)
    saveSettings({
      sleeperUsername: null,
      sleeperUserId: null,
      selectedLeagueKey: selectedKey,
      espnLeagueIds: [leagueId]
    })
    writeFileSync(
      join(dir, 'sideline-nfl.json'),
      JSON.stringify({
        at: Date.now(),
        nfl: {
          week: 2,
          displayWeek: 2,
          season: '2026',
          leagueSeason: '2026',
          seasonType: 'regular'
        }
      })
    )
    const stale = {
      ...hudMatchup,
      myPoints: 115.4,
      oppPoints: 122.2,
      starters: [{ ...hudMatchup.starters[0], points: 24.1 }],
      oppStarters: [{ ...hudMatchup.oppStarters[0], points: 28.4 }],
      scoresFinal: false
    }
    writeFileSync(
      join(dir, 'sideline-last-hud.json'),
      JSON.stringify({
        at: Date.now(),
        displayWeek: 2,
        selectedKey,
        matchup: stale
      })
    )
    writeFileSync(
      join(dir, 'sideline-matchups.json'),
      JSON.stringify({
        at: Date.now(),
        week: 2,
        byKey: { [selectedKey]: stale }
      })
    )
    writeFileSync(
      join(dir, 'sideline-espn-scores.json'),
      JSON.stringify({
        at: Date.now(),
        byId: {
          [leagueId]: {
            week: 2,
            payload: {
              scoringPeriodId: 2,
              schedule: [
                {
                  matchupPeriodId: 2,
                  winner: 'UNDECIDED',
                  home: {
                    teamId: 1,
                    totalPointsLive: 0,
                    totalPoints: 117.86,
                    pointsByScoringPeriod: { '2': 0 },
                    rosterForCurrentScoringPeriod: {
                      entries: [{ lineupSlotId: 0, playerId: 1 }]
                    }
                  },
                  away: {
                    teamId: 2,
                    totalPointsLive: 0,
                    totalPoints: 122.22,
                    pointsByScoringPeriod: { '2': 0 },
                    rosterForCurrentScoringPeriod: {
                      entries: [{ lineupSlotId: 0, playerId: 3 }]
                    }
                  }
                }
              ]
            }
          }
        }
      })
    )
    warmupPollerCaches()
    expect(currentState().nfl?.displayWeek).toBe(2)
    expect(currentState().matchup?.myPoints).toBe(0)
    expect(currentState().matchup?.oppPoints).toBe(0)
    expect(currentState().matchup?.starters[0]?.points).toBe(0)
    expect(currentState().matchup?.oppStarters[0]?.points).toBe(0)
    expect(currentState().matchup?.scoresFinal).toBe(false)
  })

  it('uses week-2 ESPN live matchup totals instead of last-HUD week-1 finals', () => {
    const dir = app.getPath('userData')
    const leagueId = '543268341'
    const selectedKey = leagueKey('espn', leagueId)
    saveSettings({
      sleeperUsername: null,
      sleeperUserId: null,
      selectedLeagueKey: selectedKey,
      espnLeagueIds: [leagueId]
    })
    writeFileSync(
      join(dir, 'sideline-nfl.json'),
      JSON.stringify({
        at: Date.now(),
        nfl: {
          week: 2,
          displayWeek: 2,
          season: '2026',
          leagueSeason: '2026',
          seasonType: 'regular'
        }
      })
    )
    const stale = {
      ...hudMatchup,
      myPoints: 115.26,
      oppPoints: 122.22,
      starters: [
        { playerId: '1', name: 'Hurts', position: 'QB', nflTeam: 'PHI', points: 0 },
        { playerId: '4', name: 'LaPorta', position: 'TE', nflTeam: 'DET', points: 17.2 }
      ],
      oppStarters: [
        { playerId: '3', name: 'Allen', position: 'QB', nflTeam: 'BUF', points: 0 },
        { playerId: '5', name: 'Bates', position: 'K', nflTeam: 'CIN', points: 3 }
      ],
      scoresFinal: false
    }
    writeFileSync(
      join(dir, 'sideline-last-hud.json'),
      JSON.stringify({
        at: Date.now(),
        displayWeek: 2,
        selectedKey,
        matchup: stale
      })
    )
    writeFileSync(
      join(dir, 'sideline-matchups.json'),
      JSON.stringify({
        at: Date.now(),
        week: 2,
        byKey: { [selectedKey]: stale }
      })
    )
    writeFileSync(
      join(dir, 'sideline-espn-scores.json'),
      JSON.stringify({
        at: Date.now(),
        byId: {
          [leagueId]: {
            week: 2,
            payload: {
              scoringPeriodId: 2,
              currentMatchupPeriod: 2,
              latestScoringPeriod: 2,
              schedule: [
                {
                  matchupPeriodId: 2,
                  winner: 'UNDECIDED',
                  home: {
                    teamId: 1,
                    totalPoints: 0,
                    totalPointsLive: 17.2,
                    rosterForCurrentScoringPeriod: {
                      entries: [
                        {
                          lineupSlotId: 0,
                          playerId: 1,
                          playerPoolEntry: {
                            player: { fullName: 'Hurts', defaultPositionId: 1, proTeamId: 21 }
                          }
                        },
                        {
                          lineupSlotId: 6,
                          playerId: 4,
                          playerPoolEntry: {
                            player: { fullName: 'LaPorta', defaultPositionId: 3, proTeamId: 8 }
                          }
                        }
                      ]
                    }
                  },
                  away: {
                    teamId: 2,
                    totalPoints: 0,
                    totalPointsLive: 3,
                    rosterForCurrentScoringPeriod: {
                      entries: [
                        {
                          lineupSlotId: 0,
                          playerId: 3,
                          playerPoolEntry: {
                            player: { fullName: 'Allen', defaultPositionId: 1, proTeamId: 2 }
                          }
                        },
                        {
                          lineupSlotId: 17,
                          playerId: 5,
                          playerPoolEntry: {
                            player: { fullName: 'Bates', defaultPositionId: 5, proTeamId: 7 }
                          }
                        }
                      ]
                    }
                  }
                }
              ]
            }
          }
        }
      })
    )
    warmupPollerCaches()
    expect(currentState().nfl?.displayWeek).toBe(2)
    expect(currentState().matchup?.myPoints).toBe(17.2)
    expect(currentState().matchup?.oppPoints).toBe(3)
    expect(currentState().matchup?.starters.find((player) => player.playerId === '4')?.points).toBe(17.2)
    expect(currentState().matchup?.oppStarters.find((player) => player.playerId === '5')?.points).toBe(3)
    expect(currentState().boards.find((board) => board.key === selectedKey)?.myPoints).toBe(17.2)
    expect(currentState().boards.find((board) => board.key === selectedKey)?.oppPoints).toBe(3)
  })

  it('commits week-2 live totals on the first refresh when last HUD is still 115/122', async () => {
    const dir = app.getPath('userData')
    const leagueId = '543268341'
    const selectedKey = leagueKey('espn', leagueId)
    saveSettings({
      sleeperUsername: null,
      sleeperUserId: null,
      selectedLeagueKey: selectedKey,
      espnLeagueIds: [leagueId]
    })
    writeFileSync(
      join(dir, 'sideline-nfl.json'),
      JSON.stringify({
        at: Date.now(),
        nfl: {
          week: 2,
          displayWeek: 2,
          season: '2026',
          leagueSeason: '2026',
          seasonType: 'regular'
        }
      })
    )
    const stale = {
      ...hudMatchup,
      myPoints: 115.26,
      oppPoints: 122.22,
      starters: [
        { playerId: '1', name: 'Hurts', position: 'QB', nflTeam: 'PHI', points: 0 },
        { playerId: '4', name: 'LaPorta', position: 'TE', nflTeam: 'DET', points: 17.2 }
      ],
      oppStarters: [
        { playerId: '3', name: 'Allen', position: 'QB', nflTeam: 'BUF', points: 0 },
        { playerId: '5', name: 'Bates', position: 'K', nflTeam: 'CIN', points: 3 }
      ],
      scoresFinal: false
    }
    writeFileSync(
      join(dir, 'sideline-last-hud.json'),
      JSON.stringify({ at: Date.now(), displayWeek: 2, selectedKey, matchup: stale })
    )
    writeFileSync(
      join(dir, 'sideline-matchups.json'),
      JSON.stringify({ at: Date.now(), week: 2, byKey: { [selectedKey]: stale } })
    )
    writeFileSync(join(dir, 'sideline-espn-scores.json'), JSON.stringify({ at: Date.now(), byId: {} }))
    warmupPollerCaches()
    expect(currentState().matchup?.myPoints).toBe(115.26)

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/state/nfl')) {
          return jsonOk({
            week: 2,
            display_week: 2,
            season: '2026',
            league_season: '2026',
            season_type: 'regular'
          })
        }
        if (url.includes('mLiveScoring') || url.includes('mMatchupScore')) {
          return jsonOk({
            scoringPeriodId: 2,
            currentMatchupPeriod: 2,
            schedule: [
              {
                matchupPeriodId: 2,
                winner: 'UNDECIDED',
                home: {
                  teamId: 1,
                  totalPoints: 0,
                  totalPointsLive: 17.2,
                  rosterForCurrentScoringPeriod: {
                    entries: [
                      {
                        lineupSlotId: 0,
                        playerId: 1,
                        playerPoolEntry: { player: { fullName: 'Hurts', defaultPositionId: 1, proTeamId: 21 } }
                      },
                      {
                        lineupSlotId: 6,
                        playerId: 4,
                        playerPoolEntry: { player: { fullName: 'LaPorta', defaultPositionId: 3, proTeamId: 8 } }
                      }
                    ]
                  }
                },
                away: {
                  teamId: 2,
                  totalPoints: 0,
                  totalPointsLive: 3,
                  rosterForCurrentScoringPeriod: {
                    entries: [
                      {
                        lineupSlotId: 0,
                        playerId: 3,
                        playerPoolEntry: { player: { fullName: 'Allen', defaultPositionId: 1, proTeamId: 2 } }
                      },
                      {
                        lineupSlotId: 17,
                        playerId: 5,
                        playerPoolEntry: { player: { fullName: 'Bates', defaultPositionId: 5, proTeamId: 7 } }
                      }
                    ]
                  }
                }
              }
            ],
            liveScoring: {
              teams: [
                {
                  teamId: 1,
                  totalPointsLive: 17.2,
                  players: [{ playerId: 4, totalPointsLive: 17.2, lineupSlotId: 6 }]
                },
                {
                  teamId: 2,
                  totalPointsLive: 3,
                  players: [{ playerId: 5, totalPointsLive: 3, lineupSlotId: 17 }]
                }
              ]
            }
          })
        }
        if (url.includes('scoreboard')) return jsonOk({ events: [] })
        return jsonOk({ teams: [], schedule: [] })
      })
    )

    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().matchup?.myPoints).toBe(17.2)
    await expect.poll(() => currentState().matchup?.oppPoints).toBe(3)
    expect(currentState().boards.find((board) => board.key === selectedKey)?.myPoints).toBe(17.2)
    expect(currentState().boards.find((board) => board.key === selectedKey)?.oppPoints).toBe(3)
  })

  it('keeps week-2 live headers after a poisoned-HUD warmup plus compact live tick', async () => {
    const dir = app.getPath('userData')
    const leagueId = '543268341'
    const selectedKey = leagueKey('espn', leagueId)
    saveSettings({
      sleeperUsername: null,
      sleeperUserId: null,
      selectedLeagueKey: selectedKey,
      espnLeagueIds: [leagueId]
    })
    writeFileSync(
      join(dir, 'sideline-nfl.json'),
      JSON.stringify({
        at: Date.now(),
        nfl: {
          week: 2,
          displayWeek: 2,
          season: '2026',
          leagueSeason: '2026',
          seasonType: 'regular'
        }
      })
    )
    const stale = {
      ...hudMatchup,
      myPoints: 115.26,
      oppPoints: 122.22,
      starters: [
        { playerId: '1', name: 'Hurts', position: 'QB', nflTeam: 'PHI', points: 0 },
        { playerId: '4', name: 'LaPorta', position: 'TE', nflTeam: 'DET', points: 17.2 }
      ],
      oppStarters: [
        { playerId: '3', name: 'Allen', position: 'QB', nflTeam: 'BUF', points: 0 },
        { playerId: '5', name: 'Bates', position: 'K', nflTeam: 'CIN', points: 3 }
      ],
      scoresFinal: false
    }
    writeFileSync(
      join(dir, 'sideline-last-hud.json'),
      JSON.stringify({ at: Date.now(), displayWeek: 2, selectedKey, matchup: stale })
    )
    writeFileSync(
      join(dir, 'sideline-matchups.json'),
      JSON.stringify({ at: Date.now(), week: 2, byKey: { [selectedKey]: stale } })
    )
    writeFileSync(
      join(dir, 'sideline-espn-scores.json'),
      JSON.stringify({
        at: Date.now(),
        byId: {
          [leagueId]: {
            week: 2,
            payload: {
              scoringPeriodId: 2,
              currentMatchupPeriod: 2,
              latestScoringPeriod: 2,
              schedule: [
                {
                  matchupPeriodId: 2,
                  winner: 'UNDECIDED',
                  home: {
                    teamId: 1,
                    totalPoints: 0,
                    totalPointsLive: 17.2,
                    rosterForCurrentScoringPeriod: {
                      entries: [
                        {
                          lineupSlotId: 0,
                          playerId: 1,
                          playerPoolEntry: {
                            player: { fullName: 'Hurts', defaultPositionId: 1, proTeamId: 21 }
                          }
                        },
                        {
                          lineupSlotId: 6,
                          playerId: 4,
                          playerPoolEntry: {
                            player: { fullName: 'LaPorta', defaultPositionId: 3, proTeamId: 8 }
                          }
                        }
                      ]
                    }
                  },
                  away: {
                    teamId: 2,
                    totalPoints: 0,
                    totalPointsLive: 3,
                    rosterForCurrentScoringPeriod: {
                      entries: [
                        {
                          lineupSlotId: 0,
                          playerId: 3,
                          playerPoolEntry: {
                            player: { fullName: 'Allen', defaultPositionId: 1, proTeamId: 2 }
                          }
                        },
                        {
                          lineupSlotId: 17,
                          playerId: 5,
                          playerPoolEntry: {
                            player: { fullName: 'Bates', defaultPositionId: 5, proTeamId: 7 }
                          }
                        }
                      ]
                    }
                  }
                }
              ]
            }
          }
        }
      })
    )
    warmupPollerCaches()
    expect(currentState().matchup?.myPoints).toBe(17.2)
    expect(currentState().matchup?.oppPoints).toBe(3)

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/state/nfl')) {
          return jsonOk({
            week: 2,
            display_week: 2,
            season: '2026',
            league_season: '2026',
            season_type: 'regular'
          })
        }
        if (url.includes('mLiveScoring') && !url.includes('mMatchupScore')) {
          return jsonOk({
            scoringPeriodId: 2,
            liveScoring: {
              teams: [
                {
                  teamId: 1,
                  totalPointsLive: 17.2,
                  players: [{ playerId: 4, totalPointsLive: 17.2, lineupSlotId: 6 }]
                },
                {
                  teamId: 2,
                  totalPointsLive: 3,
                  players: [{ playerId: 5, totalPointsLive: 3, lineupSlotId: 17 }]
                }
              ]
            }
          })
        }
        if (url.includes('scoreboard')) return jsonOk({ events: [] })
        return jsonOk({ teams: [], schedule: [] })
      })
    )

    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().matchup?.myPoints).toBe(17.2)
    await expect.poll(() => currentState().matchup?.oppPoints).toBe(3)
    expect(currentState().boards.find((board) => board.key === selectedKey)?.myPoints).toBe(17.2)
    expect(currentState().boards.find((board) => board.key === selectedKey)?.oppPoints).toBe(3)
    await expect.poll(() => {
      try {
        const hud = JSON.parse(readFileSync(join(dir, 'sideline-last-hud.json'), 'utf8')) as {
          matchup?: { myPoints?: number; oppPoints?: number }
        }
        return hud.matchup?.myPoints
      } catch {
        return null
      }
    }).toBe(17.2)
    await expect.poll(() => {
      try {
        const row = JSON.parse(readFileSync(join(dir, 'sideline-matchups.json'), 'utf8')) as {
          byKey?: Record<string, { myPoints?: number; oppPoints?: number }>
        }
        return row.byKey?.[selectedKey]?.oppPoints
      } catch {
        return null
      }
    }).toBe(3)
  })

  it('does not hold inFlight on last HUD while /matchups is still in flight', async () => {
    const dir = app.getPath('userData')
    const leagueId = '123456789'
    const selectedKey = leagueKey('sleeper', leagueId)
    saveSettings({
      sleeperUsername: 'tester',
      sleeperUserId: 'me',
      selectedLeagueKey: selectedKey,
      espnLeagueIds: [],
      pinnedLeagueKeys: []
    })
    writeNfl(dir)
    writeFileSync(
      join(dir, 'sideline-last-hud.json'),
      JSON.stringify({
        at: Date.now(),
        displayWeek: 1,
        selectedKey,
        matchup: hudMatchup
      })
    )
    warmupPollerCaches()

    let releaseMatchups: () => void = () => undefined
    const held = new Promise<void>((resolve) => {
      releaseMatchups = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/matchups/')) {
          await held
          return jsonOk(sleeperMatchups)
        }
        if (url.includes('/state/nfl')) {
          return jsonOk({
            week: 1,
            display_week: 1,
            season: '2026',
            league_season: '2026',
            season_type: 'regular'
          })
        }
        if (url.includes('/leagues/')) return jsonOk([])
        if (url.includes('scoreboard')) return jsonOk({ events: [] })
        return jsonOk([])
      })
    )

    let settled = false
    const pending = refresh().then((state) => {
      settled = true
      return state
    })
    await expect.poll(() => settled).toBe(true)
    expect((await pending).matchup?.myPoints).toBe(10)
    releaseMatchups()
    await expect.poll(() => currentState().matchup?.myPoints).toBe(12.5)
  })

  it('starts /matchups before GET /user when the Sleeper id is not cached', async () => {
    const dir = app.getPath('userData')
    const leagueId = '123456789'
    saveSettings({
      sleeperUsername: 'tester',
      sleeperUserId: null,
      selectedLeagueKey: leagueKey('sleeper', leagueId),
      espnLeagueIds: [],
      pinnedLeagueKeys: []
    })
    writeNfl(dir)
    const hudPath = join(dir, 'sideline-last-hud.json')
    if (existsSync(hudPath)) unlinkSync(hudPath)
    warmupPollerCaches()

    const urls: string[] = []
    let releaseUser: () => void = () => undefined
    const heldUser = new Promise<void>((resolve) => {
      releaseUser = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url)
        if (url.includes('/user/tester')) {
          await heldUser
          return jsonOk({ user_id: 'me', username: 'tester' })
        }
        if (url.includes('/matchups/')) return jsonOk(sleeperMatchups)
        if (url.includes('/rosters')) {
          return jsonOk([
            { roster_id: 1, owner_id: 'me', settings: { wins: 1, losses: 0 } },
            { roster_id: 2, owner_id: 'them', settings: { wins: 0, losses: 1 } }
          ])
        }
        if (url.includes('/league/') && url.includes('/users')) {
          return jsonOk([
            { user_id: 'me', display_name: 'Me', metadata: { team_name: 'Mine' } },
            { user_id: 'them', display_name: 'You', metadata: { team_name: 'Yours' } }
          ])
        }
        if (url.includes('/state/nfl')) {
          return jsonOk({
            week: 1,
            display_week: 1,
            season: '2026',
            league_season: '2026',
            season_type: 'regular'
          })
        }
        if (url.includes('/leagues/')) return jsonOk([])
        if (url.includes('scoreboard')) return jsonOk({ events: [] })
        return jsonOk([])
      })
    )

    const pending = refresh({ waitForBoards: true })
    await expect.poll(() => urls.some((url) => url.includes('/matchups/'))).toBe(true)
    const matchupsAt = urls.findIndex((url) => url.includes('/matchups/'))
    const userAt = urls.findIndex((url) => url.includes('/user/tester'))
    expect(urls[0]).toContain('/state/nfl')
    expect(matchupsAt).toBeGreaterThan(0)
    if (userAt >= 0) expect(matchupsAt).toBeLessThanOrEqual(userAt)
    releaseUser()
    await pending
    await expect.poll(() => currentState().matchup?.myPoints).toBe(12.5)
  })

  it('keeps distinct starters when switching a linked Sleeper league and ESPN league with empty byKey', async () => {
    const dir = app.getPath('userData')
    const sleeperId = '1333470459076804608'
    const espnId = '543268341'
    const sleeperKey = leagueKey('sleeper', sleeperId)
    const espnKey = leagueKey('espn', espnId)
    const espnHud = {
      ...hudMatchup,
      myTeam: { id: '1', name: 'Dawg House', owner: 'Kevin', record: '1-0' },
      oppTeam: { id: '2', name: 'Them', owner: 'You', record: '0-1' },
      starters: [{ playerId: '1', name: 'Hurts', position: 'QB', nflTeam: 'PHI', points: 10 }],
      oppStarters: [{ playerId: '3', name: 'Allen', position: 'QB', nflTeam: 'BUF', points: 8 }]
    }
    saveSettings({
      sleeperUsername: 'ketheridge',
      sleeperUserId: '578604586021982208',
      selectedLeagueKey: espnKey,
      espnLeagueIds: [espnId],
      pinnedLeagueKeys: []
    })
    writeNfl(dir)
    writeFileSync(join(dir, 'sideline-matchups.json'), JSON.stringify({ at: Date.now(), week: 1, byKey: {} }))
    writeFileSync(
      join(dir, 'sideline-last-hud.json'),
      JSON.stringify({
        at: Date.now(),
        displayWeek: 1,
        selectedKey: espnKey,
        matchup: espnHud
      })
    )
    writeFileSync(
      join(dir, 'sideline-sleeper-leagues.json'),
      JSON.stringify({
        at: Date.now(),
        username: 'ketheridge',
        season: '2026',
        leagues: [
          {
            id: sleeperId,
            name: 'Gucci Gang Dynasty',
            provider: 'sleeper',
            season: '2026',
            week: 1
          }
        ]
      })
    )
    writeFileSync(
      join(dir, 'sideline-espn-leagues.json'),
      JSON.stringify({
        at: Date.now(),
        season: '2026',
        ids: espnId,
        leagues: [{ id: espnId, name: 'Dawg Pound', provider: 'espn', season: '2026', week: 1 }]
      })
    )
    warmupPollerCaches()

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('mLiveScoring')) {
          return jsonOk({
            scoringPeriodId: 1,
            settings: { name: 'Dawg Pound' },
            teams: [
              { id: 1, location: 'Dawg', nickname: 'House', primaryOwner: '{11111111-1111-1111-1111-111111111111}' },
              { id: 2, location: 'Them', nickname: 'Squad' }
            ],
            schedule: [
              {
                matchupPeriodId: 1,
                home: { teamId: 1, totalPointsLive: 12.5 },
                away: { teamId: 2, totalPointsLive: 9 }
              }
            ],
            liveScoring: {
              teams: [
                {
                  teamId: 1,
                  totalPointsLive: 12.5,
                  players: [{ playerId: 1, totalPointsLive: 12.5 }]
                },
                {
                  teamId: 2,
                  totalPointsLive: 9,
                  players: [{ playerId: 3, totalPointsLive: 9 }]
                }
              ]
            }
          })
        }
        if (url.includes(`/league/${sleeperId}/matchups/`)) {
          return jsonOk([
            {
              roster_id: 1,
              matchup_id: 7,
              points: 88.2,
              starters: ['4046'],
              players: ['4046'],
              players_points: { '4046': 88.2 }
            },
            {
              roster_id: 2,
              matchup_id: 7,
              points: 70,
              starters: ['6794'],
              players: ['6794'],
              players_points: { '6794': 70 }
            }
          ])
        }
        if (url.includes(`/league/${sleeperId}/rosters`)) {
          return jsonOk([
            { roster_id: 1, owner_id: '578604586021982208', settings: { wins: 1, losses: 0 } },
            { roster_id: 2, owner_id: 'them', settings: { wins: 0, losses: 1 } }
          ])
        }
        if (url.includes(`/league/${sleeperId}/users`)) {
          return jsonOk([
            { user_id: '578604586021982208', display_name: 'ketheridge', metadata: { team_name: 'Gucci Gang' } },
            { user_id: 'them', display_name: 'Opp', metadata: { team_name: 'Them' } }
          ])
        }
        if (url.includes('/leagues/nfl')) {
          return jsonOk([{ league_id: sleeperId, name: 'Gucci Gang Dynasty', season: '2026' }])
        }
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

    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().selectedLeagueKey).toBe(espnKey)
    await expect.poll(() => currentState().matchup?.starters[0]?.playerId).toBe('1')
    const espnStarters = currentState().matchup?.starters.map((row) => row.playerId) ?? []
    expect(currentState().leagues.map((row) => leagueKey(row.provider, row.id)).sort()).toEqual(
      [espnKey, sleeperKey].sort()
    )

    saveSettings({ selectedLeagueKey: sleeperKey })
    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().selectedLeagueKey).toBe(sleeperKey)
    await expect.poll(() => currentState().matchup?.starters[0]?.playerId).toBe('4046')
    const sleeperStarters = currentState().matchup?.starters.map((row) => row.playerId) ?? []
    expect(sleeperStarters).not.toEqual(espnStarters)
    expect(currentState().matchup?.myTeam.name).toBe('Gucci Gang')

    const espnBoard = currentState().boards.find((row) => row.key === espnKey)
    const sleeperBoard = currentState().boards.find((row) => row.key === sleeperKey)
    expect(espnBoard?.leagueName).toBe('Dawg Pound')
    expect(sleeperBoard?.leagueName).toBe('Gucci Gang Dynasty')
    expect(espnBoard?.myName).toBe('Dawg House')
    expect(sleeperBoard?.myName).toBe('Gucci Gang')
    expect(espnBoard?.lastScorers.some((chip) => chip.playerId === '4046')).toBe(false)

    const hud = toOverlayHud(currentState())
    expect(hud.provider).toBe('sleeper')
    expect(hud.leagueName).toBe('Gucci Gang Dynasty')
    expect(hud.myStarters[0]?.playerId).toBe('4046')

    saveSettings({ selectedLeagueKey: espnKey })
    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().selectedLeagueKey).toBe(espnKey)
    await expect.poll(() => currentState().matchup?.starters[0]?.playerId).toBe('1')
    expect(toOverlayHud(currentState()).myStarters[0]?.playerId).toBe('1')
    expect(toOverlayHud(currentState()).provider).toBe('espn')
  })

  it('picks Kevin ESPN team 8 by SWID, not Harrison id 1, and keeps Sleeper roster 11 separate', async () => {
    const dir = app.getPath('userData')
    const sleeperId = '1333470459076804608'
    const espnId = '543268341'
    const sleeperKey = leagueKey('sleeper', sleeperId)
    const espnKey = leagueKey('espn', espnId)
    const kevinSwid = '{F203DEEE-D22E-4EC9-A095-40196C2FC577}'
    espnAuth.cookies = { espn_s2: 'live-s2', SWID: kevinSwid }
    saveSettings({
      sleeperUsername: 'ketheridge',
      sleeperUserId: '578604586021982208',
      selectedLeagueKey: espnKey,
      espnLeagueIds: [espnId],
      pinnedLeagueKeys: []
    })
    writeNfl(dir)
    writeFileSync(join(dir, 'sideline-matchups.json'), JSON.stringify({ at: Date.now(), week: 1, byKey: {} }))
    writeFileSync(
      join(dir, 'sideline-last-hud.json'),
      JSON.stringify({
        at: Date.now(),
        displayWeek: 1,
        selectedKey: espnKey,
        matchup: {
          myTeam: { id: '1', name: 'Team Harrison', owner: 'TH', record: '0-0' },
          oppTeam: { id: '2', name: 'KDT', owner: 'KDT', record: '0-0' },
          myPoints: 0,
          oppPoints: 0,
          starters: [
            { playerId: '', name: '', position: '', nflTeam: '' },
            { playerId: '', name: '', position: '', nflTeam: '' }
          ],
          bench: [],
          oppStarters: [],
          oppBench: []
        }
      })
    )
    writeFileSync(
      join(dir, 'sideline-espn-teams.json'),
      JSON.stringify({
        at: Date.now(),
        byId: {
          [espnId]: [
            {
              id: 1,
              location: 'Team',
              nickname: 'Harrison',
              abbrev: 'TH',
              primaryOwner: '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}'
            },
            {
              id: 8,
              location: 'Team',
              nickname: 'Etheridge',
              abbrev: 'KE',
              primaryOwner: kevinSwid
            }
          ]
        }
      })
    )
    writeFileSync(
      join(dir, 'sideline-sleeper-leagues.json'),
      JSON.stringify({
        at: Date.now(),
        username: 'ketheridge',
        season: '2026',
        leagues: [
          { id: sleeperId, name: 'Gucci Gang Dynasty', provider: 'sleeper', season: '2026', week: 1 }
        ]
      })
    )
    writeFileSync(
      join(dir, 'sideline-espn-leagues.json'),
      JSON.stringify({
        at: Date.now(),
        season: '2026',
        ids: espnId,
        leagues: [{ id: espnId, name: 'Dawg Pound', provider: 'espn', season: '2026', week: 1 }]
      })
    )
    warmupPollerCaches()

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('mLiveScoring') || url.includes('mMatchupScore') || url.includes('mTeam')) {
          return jsonOk({
            scoringPeriodId: 1,
            settings: { name: 'Dawg Pound' },
            members: [{ id: kevinSwid, displayName: 'Kevin Etheridge' }],
            teams: [
              {
                id: 1,
                location: 'Team',
                nickname: 'Harrison',
                abbrev: 'TH',
                primaryOwner: '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}'
              },
              {
                id: 8,
                location: 'Team',
                nickname: 'Etheridge',
                abbrev: 'KE',
                primaryOwner: kevinSwid
              }
            ],
            schedule: [
              {
                matchupPeriodId: 1,
                home: {
                  teamId: 8,
                  totalPointsLive: 18.4,
                  rosterForCurrentScoringPeriod: {
                    entries: [
                      {
                        lineupSlotId: 0,
                        playerId: 3139477,
                        playerPoolEntry: {
                          player: {
                            fullName: 'Patrick Mahomes',
                            defaultPositionId: 1,
                            proTeamId: 12
                          }
                        }
                      }
                    ]
                  }
                },
                away: { teamId: 3, totalPointsLive: 11 }
              },
              {
                matchupPeriodId: 1,
                home: { teamId: 1, totalPointsLive: 1 },
                away: { teamId: 2, totalPointsLive: 2 }
              }
            ]
          })
        }
        if (url.includes(`/league/${sleeperId}/matchups/`)) {
          return jsonOk([
            {
              roster_id: 11,
              matchup_id: 7,
              points: 88.2,
              starters: ['4046'],
              players: ['4046'],
              players_points: { '4046': 88.2 }
            },
            {
              roster_id: 2,
              matchup_id: 7,
              points: 70,
              starters: ['6794'],
              players: ['6794'],
              players_points: { '6794': 70 }
            }
          ])
        }
        if (url.includes(`/league/${sleeperId}/rosters`)) {
          return jsonOk([
            { roster_id: 11, owner_id: '578604586021982208', settings: { wins: 1, losses: 0 } },
            { roster_id: 2, owner_id: 'them', settings: { wins: 0, losses: 1 } }
          ])
        }
        if (url.includes(`/league/${sleeperId}/users`)) {
          return jsonOk([
            {
              user_id: '578604586021982208',
              display_name: 'ketheridge',
              metadata: { team_name: 'Gibbs Me Head' }
            },
            { user_id: 'them', display_name: 'Opp', metadata: { team_name: 'Them' } }
          ])
        }
        if (url.includes('/leagues/nfl')) {
          return jsonOk([{ league_id: sleeperId, name: 'Gucci Gang Dynasty', season: '2026' }])
        }
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

    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().matchup?.myTeam.id).toBe('8')
    expect(currentState().matchup?.myTeam.name).toBe('Team Etheridge')
    expect(currentState().matchup?.starters[0]?.name).toBe('Patrick Mahomes')
    expect(currentState().matchup?.starters[0]?.playerId).toBe('3139477')
    expect(currentState().matchup?.myTeam.id).not.toBe('1')

    saveSettings({ selectedLeagueKey: sleeperKey })
    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().selectedLeagueKey).toBe(sleeperKey)
    await expect.poll(() => currentState().matchup?.myTeam.name).toBe('Gibbs Me Head')
    expect(currentState().matchup?.myTeam.id).toBe('11')
    expect(currentState().matchup?.starters[0]?.playerId).toBe('4046')
    expect(toOverlayHud(currentState()).provider).toBe('sleeper')
    expect(toOverlayHud(currentState()).myStarters[0]?.playerId).toBe('4046')

    const espnBoard = currentState().boards.find((row) => row.key === espnKey)
    const sleeperBoard = currentState().boards.find((row) => row.key === sleeperKey)
    expect(espnBoard?.myName).toBe('Team Etheridge')
    expect(sleeperBoard?.myName).toBe('Gibbs Me Head')
    expect(espnBoard?.lastScorers.some((chip) => chip.playerId === '4046')).toBe(false)
  })

  it('does not paint a Sleeper roster onto ESPN when cookies are missing', async () => {
    const dir = app.getPath('userData')
    const sleeperId = '1333470459076804608'
    const espnId = '543268341'
    const sleeperKey = leagueKey('sleeper', sleeperId)
    const espnKey = leagueKey('espn', espnId)
    espnAuth.cookies = null
    saveSettings({
      sleeperUsername: 'ketheridge',
      sleeperUserId: '578604586021982208',
      selectedLeagueKey: espnKey,
      espnLeagueIds: [espnId],
      pinnedLeagueKeys: []
    })
    writeNfl(dir)
    writeFileSync(
      join(dir, 'sideline-last-hud.json'),
      JSON.stringify({
        at: Date.now(),
        displayWeek: 1,
        selectedKey: sleeperKey,
        matchup: {
          myTeam: { id: '11', name: 'Gibbs Me Head', owner: 'Me', record: '1-0' },
          oppTeam: { id: '2', name: 'Them', owner: 'You', record: '0-1' },
          myPoints: 88.2,
          oppPoints: 70,
          starters: [{ playerId: '4046', name: 'Amon-Ra St. Brown', position: 'WR', nflTeam: 'DET', points: 88.2 }],
          bench: [],
          oppStarters: [{ playerId: '6794', name: 'Them', position: 'RB', nflTeam: 'SF', points: 70 }],
          oppBench: []
        }
      })
    )
    writeFileSync(
      join(dir, 'sideline-sleeper-leagues.json'),
      JSON.stringify({
        at: Date.now(),
        username: 'ketheridge',
        season: '2026',
        leagues: [
          { id: sleeperId, name: 'Gucci Gang Dynasty', provider: 'sleeper', season: '2026', week: 1 }
        ]
      })
    )
    writeFileSync(
      join(dir, 'sideline-espn-leagues.json'),
      JSON.stringify({
        at: Date.now(),
        season: '2026',
        ids: espnId,
        leagues: [{ id: espnId, name: 'Dawg Pound', provider: 'espn', season: '2026', week: 1 }]
      })
    )
    writeFileSync(
      join(dir, 'sideline-espn-teams.json'),
      JSON.stringify({
        at: Date.now(),
        byId: {
          [espnId]: [
            {
              id: 1,
              location: 'Team',
              nickname: 'Harrison',
              primaryOwner: '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}'
            },
            {
              id: 8,
              location: 'Team',
              nickname: 'Etheridge',
              primaryOwner: '{F203DEEE-D22E-4EC9-A095-40196C2FC577}'
            }
          ]
        }
      })
    )
    warmupPollerCaches()

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('mLiveScoring') || url.includes('mMatchupScore') || url.includes('mTeam')) {
          return jsonOk({
            scoringPeriodId: 1,
            settings: { name: 'Dawg Pound' },
            teams: [
              {
                id: 1,
                location: 'Team',
                nickname: 'Harrison',
                primaryOwner: '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}'
              },
              {
                id: 8,
                location: 'Team',
                nickname: 'Etheridge',
                primaryOwner: '{F203DEEE-D22E-4EC9-A095-40196C2FC577}'
              }
            ],
            schedule: [
              {
                matchupPeriodId: 1,
                home: { teamId: 1, totalPointsLive: 10 },
                away: { teamId: 2, totalPointsLive: 8 }
              }
            ]
          })
        }
        if (url.includes(`/league/${sleeperId}/matchups/`)) {
          return jsonOk([
            {
              roster_id: 11,
              matchup_id: 7,
              points: 88.2,
              starters: ['4046'],
              players: ['4046'],
              players_points: { '4046': 88.2 }
            }
          ])
        }
        if (url.includes(`/league/${sleeperId}/rosters`)) {
          return jsonOk([{ roster_id: 11, owner_id: '578604586021982208', settings: { wins: 1, losses: 0 } }])
        }
        if (url.includes(`/league/${sleeperId}/users`)) {
          return jsonOk([
            {
              user_id: '578604586021982208',
              display_name: 'ketheridge',
              metadata: { team_name: 'Gibbs Me Head' }
            }
          ])
        }
        if (url.includes('/leagues/nfl')) {
          return jsonOk([{ league_id: sleeperId, name: 'Gucci Gang Dynasty', season: '2026' }])
        }
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

    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().selectedLeagueKey).toBe(espnKey)
    expect(currentState().matchup?.myTeam.name).not.toBe('Gibbs Me Head')
    expect(currentState().matchup?.starters[0]?.playerId).not.toBe('4046')
    expect(currentState().matchup?.myTeam.name).not.toBe('Team Harrison')
    const hud = toOverlayHud(currentState())
    expect(hud.provider).toBe('espn')
    expect(hud.myStarters[0]?.playerId).not.toBe('4046')
  })

  it('loads Kevin team 8 + opponent + starters from mMatchupScore when compact live is stubs', async () => {
    const dir = app.getPath('userData')
    const espnId = '543268341'
    const espnKey = leagueKey('espn', espnId)
    const kevinSwid = '{F203DEEE-D22E-4EC9-A095-40196C2FC577}'
    espnAuth.cookies = { espn_s2: 'live-s2', SWID: kevinSwid }
    saveSettings({
      sleeperUsername: null,
      sleeperUserId: null,
      selectedLeagueKey: espnKey,
      espnLeagueIds: [espnId],
      pinnedLeagueKeys: []
    })
    writeNfl(dir)
    writeFileSync(join(dir, 'sideline-matchups.json'), JSON.stringify({ at: Date.now(), week: 1, byKey: {} }))
    writeFileSync(join(dir, 'sideline-espn-scores.json'), JSON.stringify({ at: Date.now(), byId: {} }))
    const hudPath = join(dir, 'sideline-last-hud.json')
    if (existsSync(hudPath)) unlinkSync(hudPath)
    writeFileSync(
      join(dir, 'sideline-espn-leagues.json'),
      JSON.stringify({
        at: Date.now(),
        season: '2026',
        ids: espnId,
        leagues: [{ id: espnId, name: 'Dawg Pound', provider: 'espn', season: '2026', week: 1 }]
      })
    )
    warmupPollerCaches()

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('mLiveScoring') && !url.includes('mMatchupScore')) {
          return jsonOk({
            scoringPeriodId: 1,
            id: Number(espnId),
            schedule: [{ matchupPeriodId: 1 }, { matchupPeriodId: 1 }]
          })
        }
        if (url.includes('mMatchupScore')) {
          return jsonOk({
            scoringPeriodId: 1,
            id: Number(espnId),
            schedule: [
              {
                matchupPeriodId: 1,
                home: {
                  teamId: 8,
                  totalPointsLive: 18.4,
                  rosterForCurrentScoringPeriod: {
                    entries: [
                      {
                        lineupSlotId: 0,
                        playerId: 3139477,
                        playerPoolEntry: {
                          player: { fullName: 'Patrick Mahomes', defaultPositionId: 1, proTeamId: 12 }
                        }
                      }
                    ]
                  }
                },
                away: {
                  teamId: 3,
                  totalPointsLive: 11,
                  rosterForCurrentScoringPeriod: {
                    entries: [
                      {
                        lineupSlotId: 0,
                        playerId: 4241479,
                        playerPoolEntry: {
                          player: { fullName: 'Josh Allen', defaultPositionId: 1, proTeamId: 2 }
                        }
                      }
                    ]
                  }
                }
              }
            ]
          })
        }
        if (url.includes('mTeam') || url.includes('mSettings')) {
          return jsonOk({
            scoringPeriodId: 1,
            settings: { name: 'Dawg Pound' },
            members: [{ id: kevinSwid, displayName: 'Kevin Etheridge' }],
            teams: [
              {
                id: 1,
                name: 'Team Harrison',
                abbrev: 'TH',
                primaryOwner: '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}'
              },
              {
                id: 8,
                name: 'Team Etheridge',
                abbrev: 'KE',
                primaryOwner: kevinSwid
              },
              {
                id: 3,
                name: 'The Other Guys',
                abbrev: 'TOG',
                primaryOwner: '{bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb}'
              }
            ]
          })
        }
        if (url.includes('scoreboard')) return jsonOk({ events: [] })
        return jsonOk([])
      })
    )

    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().matchup?.starters[0]?.playerId).toBe('3139477')
    expect(currentState().matchup?.myTeam.id).toBe('8')
    expect(currentState().matchup?.myTeam.name).toBe('Team Etheridge')
    expect(currentState().matchup?.oppTeam).not.toBeNull()
    expect(currentState().matchup?.oppTeam?.id).toBe('3')
    expect(currentState().matchup?.oppStarters[0]?.name).toBe('Josh Allen')
    expect(toOverlayHud(currentState()).oppName).not.toBe('BYE')
    const board = currentState().boards.find((row) => row.key === espnKey)
    expect(board?.myName).toBe('Team Etheridge')
    expect(board?.oppName).not.toBeNull()
  })

  it('after Sign in, Dawg Pound writes named starters from mScoreboard instead of blank mMatchupScore rows', async () => {
    const dir = app.getPath('userData')
    const espnId = '543268341'
    const espnKey = leagueKey('espn', espnId)
    const sleeperId = '1333470459076804608'
    const sleeperKey = leagueKey('sleeper', sleeperId)
    const kevinSwid = '{F203DEEE-D22E-4EC9-A095-40196C2FC577}'
    saveSettings({
      sleeperUsername: 'ketheridge',
      sleeperUserId: '578604586021982208',
      selectedLeagueKey: espnKey,
      espnLeagueIds: [espnId],
      pinnedLeagueKeys: []
    })
    writeNfl(dir)
    writeFileSync(join(dir, 'sideline-matchups.json'), JSON.stringify({ at: Date.now(), week: 1, byKey: {} }))
    writeFileSync(join(dir, 'sideline-espn-scores.json'), JSON.stringify({ at: Date.now(), byId: {} }))
    writeFileSync(
      join(dir, 'sideline-last-hud.json'),
      JSON.stringify({
        at: Date.now(),
        displayWeek: 1,
        selectedKey: sleeperKey,
        matchup: {
          ...hudMatchup,
          myTeam: { id: '11', name: 'Gibbs Me Head', owner: 'ketheridge', record: '1-0' },
          starters: [{ playerId: '4046', name: 'Amon-Ra St. Brown', position: 'WR', nflTeam: 'DET', points: 10 }]
        }
      })
    )
    writeFileSync(
      join(dir, 'sideline-espn-leagues.json'),
      JSON.stringify({
        at: Date.now(),
        season: '2026',
        ids: espnId,
        leagues: [{ id: espnId, name: 'Dawg Pound', provider: 'espn', season: '2026', week: 1 }]
      })
    )
    warmupPollerCaches()
    espnAuth.cookies = { espn_s2: 'live-s2', SWID: kevinSwid }
    invalidateEspnSession()
    await primeEspnCookies()

    const urls: string[] = []
    const cookies: Array<string | undefined> = []
    const statsOnlyBox = {
      scoringPeriodId: 1,
      id: Number(espnId),
      schedule: [
        {
          matchupPeriodId: 1,
          home: {
            teamId: 8,
            totalPointsLive: 0,
            rosterForCurrentScoringPeriod: {
              entries: [
                {
                  lineupSlotId: 0,
                  playerPoolEntry: {
                    player: { stats: [{ statSourceId: 1, statSplitTypeId: 1, appliedTotal: 18.4 }] }
                  }
                }
              ]
            }
          },
          away: {
            teamId: 3,
            totalPointsLive: 0,
            rosterForCurrentScoringPeriod: {
              entries: [
                {
                  lineupSlotId: 2,
                  playerPoolEntry: {
                    player: { stats: [{ statSourceId: 1, statSplitTypeId: 1, appliedTotal: 11 }] }
                  }
                }
              ]
            }
          }
        }
      ]
    }
    const namedBox = {
      scoringPeriodId: 1,
      id: Number(espnId),
      teams: [
        { id: 8, name: 'Team Etheridge', primaryOwner: kevinSwid },
        { id: 3, name: "Django Achane'd", primaryOwner: '{bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb}' }
      ],
      schedule: [
        {
          matchupPeriodId: 1,
          home: {
            teamId: 8,
            totalPointsLive: 0,
            rosterForCurrentScoringPeriod: {
              entries: [
                {
                  injuryStatus: 'NORMAL',
                  lineupSlotId: 0,
                  playerId: 3139477,
                  playerPoolEntry: {
                    id: 3139477,
                    player: {
                      id: 3139477,
                      fullName: 'Patrick Mahomes',
                      defaultPositionId: 1,
                      proTeamId: 12
                    }
                  }
                }
              ]
            }
          },
          away: {
            teamId: 3,
            totalPointsLive: 0,
            rosterForCurrentScoringPeriod: {
              entries: [
                {
                  injuryStatus: 'NORMAL',
                  lineupSlotId: 2,
                  playerId: 4427366,
                  playerPoolEntry: {
                    id: 4427366,
                    player: {
                      id: 4427366,
                      fullName: "De'Von Achane",
                      defaultPositionId: 2,
                      proTeamId: 15
                    }
                  }
                }
              ]
            }
          }
        }
      ]
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
        urls.push(url)
        cookies.push(init?.headers?.Cookie)
        if (url.includes('mLiveScoring') && !url.includes('mMatchupScore')) {
          return jsonOk({
            scoringPeriodId: 1,
            id: Number(espnId),
            schedule: [{ matchupPeriodId: 1 }]
          })
        }
        if (url.includes('mMatchupScore') || url.includes('mScoreboard')) {
          return jsonOk(url.includes('view=mScoreboard') ? namedBox : statsOnlyBox)
        }
        if (url.includes('mTeam') || url.includes('mSettings')) {
          return jsonOk({
            scoringPeriodId: 1,
            settings: { name: 'Dawg Pound' },
            members: [{ id: kevinSwid, displayName: 'Kevin Etheridge' }],
            teams: [
              {
                id: 8,
                name: 'Team Etheridge',
                abbrev: 'KE',
                primaryOwner: kevinSwid
              },
              {
                id: 3,
                name: "Django Achane'd",
                abbrev: 'DA',
                primaryOwner: '{bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb}'
              }
            ]
          })
        }
        if (url.includes(`/league/${sleeperId}/matchups/`)) return jsonOk([])
        if (url.includes('scoreboard')) return jsonOk({ events: [] })
        return jsonOk([])
      })
    )

    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().matchup?.starters[0]?.name).toBe('Patrick Mahomes')
    expect(currentState().espnConnected).toBe(true)
    expect(currentState().espnNeedsRelogin).toBe(false)
    expect(espnIndicatorHealthy(currentState())).toBe(true)
    expect(
      espnBoardUx({
        provider: 'espn',
        espnConnected: currentState().espnConnected,
        espnNeedsRelogin: currentState().espnNeedsRelogin,
        matchup: currentState().matchup
      })
    ).toBe('healthy-lineup')
    expect(currentState().matchup?.myTeam.name).toBe('Team Etheridge')
    expect(currentState().matchup?.oppTeam?.name).toBe("Django Achane'd")
    expect(currentState().matchup?.oppStarters[0]?.name).toBe("De'Von Achane")
    const boxUrl = urls.find((url) => url.includes('view=mMatchupScore'))
    expect(boxUrl).toContain('view=mScoreboard')
    expect(boxUrl).toContain('lm-api-reads.fantasy.espn.com')
    const boxAt = urls.findIndex((url) => url.includes('view=mMatchupScore'))
    expect(cookies[boxAt]).toContain('espn_s2=live-s2')
    expect(urls.some((url) => url.includes('view=mLiveScoring') && url.includes('view=mScoreboard'))).toBe(
      false
    )
    await expect
      .poll(() => {
        try {
          const disk = JSON.parse(readFileSync(join(dir, 'sideline-matchups.json'), 'utf8')) as {
            byKey?: Record<string, { starters?: Array<{ name?: string }> }>
          }
          return disk.byKey?.[espnKey]?.starters?.[0]?.name
        } catch {
          return undefined
        }
      })
      .toBe('Patrick Mahomes')
    await expect
      .poll(() => {
        try {
          const disk = JSON.parse(readFileSync(join(dir, 'sideline-espn-scores.json'), 'utf8')) as {
            byId?: Record<string, { payload?: unknown }>
          }
          return Boolean(disk.byId?.[espnId])
        } catch {
          return false
        }
      })
      .toBe(true)
  })

  it('does not paint a false ESPN bye or Sleeper lineup when the ESPN fetch 401s', async () => {
    const dir = app.getPath('userData')
    const sleeperId = '1333470459076804608'
    const espnId = '543268341'
    const sleeperKey = leagueKey('sleeper', sleeperId)
    const espnKey = leagueKey('espn', espnId)
    espnAuth.cookies = { espn_s2: 'stale-s2', SWID: '{F203DEEE-D22E-4EC9-A095-40196C2FC577}' }
    saveSettings({
      sleeperUsername: 'ketheridge',
      sleeperUserId: '578604586021982208',
      selectedLeagueKey: espnKey,
      espnLeagueIds: [espnId],
      pinnedLeagueKeys: []
    })
    writeNfl(dir)
    writeFileSync(
      join(dir, 'sideline-sleeper-leagues.json'),
      JSON.stringify({
        at: Date.now(),
        username: 'ketheridge',
        season: '2026',
        leagues: [{ id: sleeperId, name: 'Gucci Gang Dynasty', provider: 'sleeper', season: '2026', week: 1 }]
      })
    )
    writeFileSync(
      join(dir, 'sideline-espn-leagues.json'),
      JSON.stringify({
        at: Date.now(),
        season: '2026',
        ids: espnId,
        leagues: [{ id: espnId, name: 'Dawg Pound', provider: 'espn', season: '2026', week: 1 }]
      })
    )
    warmupPollerCaches()

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('lm-api-reads.fantasy.espn.com')) {
          return {
            ok: false,
            status: 401,
            headers: { get: () => 'application/json' },
            json: async () => ({ messages: ['You are not authorized to view this League.'] })
          }
        }
        if (url.includes(`/league/${sleeperId}/matchups/`)) {
          return jsonOk([
            {
              roster_id: 11,
              matchup_id: 7,
              points: 88.2,
              starters: ['4046'],
              players: ['4046'],
              players_points: { '4046': 88.2 }
            }
          ])
        }
        if (url.includes(`/league/${sleeperId}/rosters`)) {
          return jsonOk([{ roster_id: 11, owner_id: '578604586021982208', settings: { wins: 1, losses: 0 } }])
        }
        if (url.includes(`/league/${sleeperId}/users`)) {
          return jsonOk([
            {
              user_id: '578604586021982208',
              display_name: 'ketheridge',
              metadata: { team_name: 'Gibbs Me Head' }
            }
          ])
        }
        if (url.includes('/leagues/nfl')) {
          return jsonOk([{ league_id: sleeperId, name: 'Gucci Gang Dynasty', season: '2026' }])
        }
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

    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().selectedLeagueKey).toBe(espnKey)
    expect(currentState().espnNeedsRelogin).toBe(true)
    expect(currentState().espnConnected).toBe(false)
    expect(espnIndicatorHealthy(currentState())).toBe(false)
    expect(
      espnBoardUx({
        provider: 'espn',
        espnConnected: currentState().espnConnected,
        espnNeedsRelogin: currentState().espnNeedsRelogin,
        matchup: currentState().matchup
      })
    ).toBe('auth-fail')
    expect(currentState().matchup?.myTeam.name).not.toBe('Gibbs Me Head')
    expect(currentState().matchup?.starters[0]?.playerId).not.toBe('4046')
    expect(currentState().matchup?.oppTeam).not.toBeNull()
    const hud = toOverlayHud(currentState())
    expect(hud.provider).toBe('espn')
    expect(hud.oppName).not.toBe('BYE')
    expect(hud.myStarters[0]?.playerId).not.toBe('4046')
    expect(hud.pollingLive).toBe(false)
  })

  it('treats cookies + empty named starters as empty-roster, not a healthy on-air board', async () => {
    const dir = app.getPath('userData')
    const espnId = '543268341'
    const espnKey = leagueKey('espn', espnId)
    const kevinSwid = '{F203DEEE-D22E-4EC9-A095-40196C2FC577}'
    saveSettings({
      sleeperUsername: null,
      selectedLeagueKey: espnKey,
      espnLeagueIds: [espnId],
      pinnedLeagueKeys: []
    })
    writeNfl(dir)
    writeFileSync(join(dir, 'sideline-matchups.json'), JSON.stringify({ at: Date.now(), week: 1, byKey: {} }))
    writeFileSync(join(dir, 'sideline-espn-scores.json'), JSON.stringify({ at: Date.now(), byId: {} }))
    writeFileSync(
      join(dir, 'sideline-espn-leagues.json'),
      JSON.stringify({
        at: Date.now(),
        season: '2026',
        ids: espnId,
        leagues: [{ id: espnId, name: 'Dawg Pound', provider: 'espn', season: '2026', week: 1 }]
      })
    )
    warmupPollerCaches()
    espnAuth.cookies = { espn_s2: 'live-s2', SWID: kevinSwid }
    await primeEspnCookies()

    const namesWithoutStarters = {
      scoringPeriodId: 1,
      id: Number(espnId),
      teams: [
        { id: 8, name: 'Team Etheridge', primaryOwner: kevinSwid },
        { id: 3, name: "Django Achane'd", primaryOwner: '{bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb}' }
      ],
      schedule: [
        {
          matchupPeriodId: 1,
          home: { teamId: 8, totalPointsLive: 0 },
          away: { teamId: 3, totalPointsLive: 0 }
        }
      ]
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('mLiveScoring') && !url.includes('mMatchupScore')) {
          return jsonOk({ scoringPeriodId: 1, id: Number(espnId), schedule: [{ matchupPeriodId: 1 }] })
        }
        if (url.includes('mMatchupScore') || url.includes('mScoreboard') || url.includes('mTeam')) {
          return jsonOk(namesWithoutStarters)
        }
        if (url.includes('scoreboard')) return jsonOk({ events: [] })
        return jsonOk([])
      })
    )

    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().matchup?.myTeam.name).toBe('Team Etheridge')
    expect(currentState().espnConnected).toBe(true)
    expect(currentState().espnNeedsRelogin).toBe(false)
    expect(currentState().matchup?.starters ?? []).toEqual([])
    expect(
      espnBoardUx({
        provider: 'espn',
        espnConnected: currentState().espnConnected,
        espnNeedsRelogin: currentState().espnNeedsRelogin,
        matchup: currentState().matchup
      })
    ).toBe('empty-roster')
    expect(toOverlayHud(currentState()).pollingLive).toBe(false)
    expect(toOverlayHud(currentState()).myStarters).toEqual([])
  })

  it('confirms live NFL week on cold launch before treating ESPN disk scores as current', async () => {
    const dir = app.getPath('userData')
    const leagueId = '543268341'
    const selectedKey = leagueKey('espn', leagueId)
    saveSettings({
      sleeperUsername: null,
      sleeperUserId: null,
      selectedLeagueKey: selectedKey,
      espnLeagueIds: [leagueId]
    })
    writeNfl(dir)
    const stale = {
      ...hudMatchup,
      myPoints: 117.86,
      oppPoints: 122.22,
      starters: [{ ...hudMatchup.starters[0], points: 24.1 }],
      oppStarters: [{ ...hudMatchup.oppStarters[0], points: 28.4 }]
    }
    writeFileSync(
      join(dir, 'sideline-last-hud.json'),
      JSON.stringify({
        at: Date.now(),
        displayWeek: 1,
        selectedKey,
        matchup: stale
      })
    )
    writeFileSync(
      join(dir, 'sideline-espn-leagues.json'),
      JSON.stringify({
        at: Date.now(),
        season: '2026',
        ids: leagueId,
        leagues: [{ id: leagueId, name: 'Dawg Pound', provider: 'espn', season: '2026', week: 1 }]
      })
    )
    writeFileSync(
      join(dir, 'sideline-espn-scores.json'),
      JSON.stringify({
        at: Date.now(),
        byId: {
          [leagueId]: {
            week: 1,
            payload: {
              scoringPeriodId: 1,
              teams: [
                { id: 1, location: 'Mine', nickname: 'Team', primaryOwner: '{11111111-1111-1111-1111-111111111111}' },
                { id: 2, location: 'Yours', nickname: 'Club' }
              ],
              schedule: [
                {
                  matchupPeriodId: 1,
                  home: {
                    teamId: 1,
                    totalPointsLive: 117.86,
                    totalPoints: 117.86,
                    rosterForCurrentScoringPeriod: {
                      entries: [
                        {
                          lineupSlotId: 0,
                          playerId: 1,
                          playerPoolEntry: {
                            player: { fullName: 'Hurts', defaultPositionId: 1, proTeamId: 21 }
                          }
                        }
                      ]
                    }
                  },
                  away: {
                    teamId: 2,
                    totalPointsLive: 122.22,
                    totalPoints: 122.22,
                    rosterForCurrentScoringPeriod: {
                      entries: [
                        {
                          lineupSlotId: 0,
                          playerId: 3,
                          playerPoolEntry: {
                            player: { fullName: 'Allen', defaultPositionId: 1, proTeamId: 2 }
                          }
                        }
                      ]
                    }
                  }
                }
              ]
            }
          }
        }
      })
    )
    warmupPollerCaches()
    expect(currentState().nfl?.displayWeek).toBe(1)
    expect(currentState().matchup?.myPoints).toBe(117.86)
    expect(currentState().boards.some((board) => board.refreshing)).toBe(true)

    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url)
        if (url.includes('/state/nfl')) {
          return jsonOk({
            week: 2,
            display_week: 2,
            season: '2026',
            league_season: '2026',
            season_type: 'regular'
          })
        }
        if (url.includes('scoringPeriodId=1') && url.includes('lm-api-reads')) {
          throw new Error('must not fetch ESPN week 1 after live week 2 is confirmed')
        }
        if (url.includes('mLiveScoring') && !url.includes('mMatchupScore')) {
          return jsonOk({
            scoringPeriodId: 2,
            schedule: [
              {
                matchupPeriodId: 2,
                home: { teamId: 1, totalPointsLive: 8.4 },
                away: { teamId: 2, totalPointsLive: 3.1 }
              }
            ],
            liveScoring: {
              teams: [
                {
                  teamId: 1,
                  totalPointsLive: 8.4,
                  players: [{ playerId: 1, totalPointsLive: 8.4 }]
                },
                {
                  teamId: 2,
                  totalPointsLive: 3.1,
                  players: [{ playerId: 3, totalPointsLive: 3.1 }]
                }
              ]
            }
          })
        }
        if (url.includes('scoreboard')) return jsonOk({ events: [] })
        return jsonOk({
          scoringPeriodId: 2,
          status: { latestScoringPeriod: 2, currentMatchupPeriod: 2 },
          teams: [
            { id: 1, location: 'Mine', nickname: 'Team' },
            { id: 2, location: 'Yours', nickname: 'Club' }
          ],
          schedule: [
            {
              matchupPeriodId: 2,
              home: { teamId: 1, totalPointsLive: 8.4 },
              away: { teamId: 2, totalPointsLive: 3.1 }
            }
          ]
        })
      })
    )

    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().nfl?.displayWeek).toBe(2)
    await expect.poll(() => currentState().matchup?.myPoints).toBe(8.4)
    await expect.poll(() => currentState().matchup?.oppPoints).toBe(3.1)
    expect(currentState().boards[0]?.myPoints).toBe(8.4)
    expect(currentState().boards[0]?.oppPoints).toBe(3.1)
    expect(urls[0]).toContain('/state/nfl')
    expect(urls.some((url) => url.includes('scoringPeriodId=2'))).toBe(true)
    expect(urls.some((url) => url.includes('scoringPeriodId=1'))).toBe(false)
    expect(currentState().boards.every((board) => !board.refreshing)).toBe(true)
    expect(currentState().leagues[0]?.week).toBe(2)
  })

  it('falls back to ESPN scoring period on launch when Sleeper /state/nfl fails', async () => {
    const dir = app.getPath('userData')
    const leagueId = '543268341'
    const selectedKey = leagueKey('espn', leagueId)
    saveSettings({
      sleeperUsername: null,
      sleeperUserId: null,
      selectedLeagueKey: selectedKey,
      espnLeagueIds: [leagueId]
    })
    writeNfl(dir)
    writeFileSync(
      join(dir, 'sideline-last-hud.json'),
      JSON.stringify({
        at: Date.now(),
        displayWeek: 1,
        selectedKey,
        matchup: hudMatchup
      })
    )
    warmupPollerCaches()

    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url)
        if (url.includes('/state/nfl')) {
          return { ok: false, status: 500, headers: { get: () => 'application/json' }, json: async () => ({}) }
        }
        if (url.includes('scoringPeriodId=1') && url.includes('lm-api-reads')) {
          throw new Error('must not fetch ESPN week 1 after ESPN scoring period 2')
        }
        if (url.includes('mLiveScoring') && !url.includes('mMatchupScore')) {
          return jsonOk({
            scoringPeriodId: 2,
            schedule: [
              {
                matchupPeriodId: 2,
                home: { teamId: 1, totalPointsLive: 6.2 },
                away: { teamId: 2, totalPointsLive: 4.1 }
              }
            ],
            liveScoring: {
              teams: [
                { teamId: 1, totalPointsLive: 6.2, players: [{ playerId: 1, totalPointsLive: 6.2 }] },
                { teamId: 2, totalPointsLive: 4.1, players: [{ playerId: 3, totalPointsLive: 4.1 }] }
              ]
            }
          })
        }
        if (url.includes('scoreboard')) return jsonOk({ events: [] })
        return jsonOk({
          scoringPeriodId: 2,
          status: { latestScoringPeriod: 2, currentMatchupPeriod: 2 },
          teams: [
            { id: 1, location: 'Mine', nickname: 'Team' },
            { id: 2, location: 'Yours', nickname: 'Club' }
          ],
          schedule: [
            {
              matchupPeriodId: 2,
              home: { teamId: 1, totalPointsLive: 6.2 },
              away: { teamId: 2, totalPointsLive: 4.1 }
            }
          ]
        })
      })
    )

    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().nfl?.displayWeek).toBe(2)
    await expect.poll(() => currentState().matchup?.myPoints).toBe(6.2)
    expect(urls[0]).toContain('/state/nfl')
    expect(urls.some((url) => url.includes('view=mSettings') || url.includes('view=mStatus'))).toBe(true)
    expect(urls.some((url) => url.includes('scoringPeriodId=2'))).toBe(true)
    expect(currentState().error).toBeNull()
  })
})

describe('setOverlayVisible', () => {
  it('clones companion AppState so the TopBar HUD slider can sync', async () => {
    const sendState = vi.spyOn(runtime, 'sendState')
    const sendTick = vi.spyOn(runtime, 'sendTick')
    const sendLive = vi.spyOn(runtime, 'sendLive')
    setOverlayVisible(true)
    await Promise.resolve()
    expect(currentState().overlayVisible).toBe(true)
    expect(sendTick).not.toHaveBeenCalled()
    expect(sendLive).not.toHaveBeenCalled()
    expect(sendState).toHaveBeenCalled()
    expect(sendState.mock.calls.at(-1)?.[0]?.overlayVisible).toBe(true)
    sendState.mockRestore()
    sendTick.mockRestore()
    sendLive.mockRestore()
  })
})

describe('poller ESPN multi-week playoff periods', () => {
  const playoff = JSON.parse(
    readFileSync(join(process.cwd(), 'fixtures/espn-playoff-two-week.json'), 'utf8')
  ) as Record<string, unknown> & { settings: { scheduleSettings: { matchupPeriods: Record<string, number[]> } } }
  const week16Nfl = { week: 16, display_week: 16, season: '2026', league_season: '2026', season_type: 'regular' }

  const setupWeek16 = (leagueId: string): string => {
    const dir = app.getPath('userData')
    const selectedKey = leagueKey('espn', leagueId)
    saveSettings({
      sleeperUsername: null,
      sleeperUserId: null,
      selectedLeagueKey: selectedKey,
      espnLeagueIds: [leagueId]
    })
    writeFileSync(
      join(dir, 'sideline-nfl.json'),
      JSON.stringify({
        at: Date.now(),
        nfl: { week: 16, displayWeek: 16, season: '2026', leagueSeason: '2026', seasonType: 'regular' }
      })
    )
    const hud = join(dir, 'sideline-last-hud.json')
    if (existsSync(hud)) unlinkSync(hud)
    espnAuth.cookies = { espn_s2: 'playoff-s2', SWID: '{11111111-1111-1111-1111-111111111111}' }
    return dir
  }

  const periodsPath = (dir: string): string => join(dir, 'sideline-espn-matchup-periods.json')

  /** Emulates ESPN's schedule filter: games only come back for the requested matchup period. */
  const stubEspn = (filters: number[][]) =>
    vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
      if (url.includes('/state/nfl')) return jsonOk(week16Nfl)
      if (url.includes('scoreboard')) return jsonOk({ events: [] })
      if (url.includes('fan.api')) return jsonOk({ preferences: [] })
      if (url.includes('view=mSettings')) {
        return jsonOk({ id: playoff.id, status: playoff.status, settings: playoff.settings, teams: playoff.teams })
      }
      const raw = init?.headers?.['X-Fantasy-Filter']
      if (url.includes('lm-api-reads') && raw) {
        const ids = (JSON.parse(raw) as { schedule?: { filterMatchupPeriodIds?: { value: number[] } } }).schedule
          ?.filterMatchupPeriodIds?.value
        if (ids) {
          filters.push(ids)
          if (!ids.includes(15)) return jsonOk({ ...playoff, schedule: [] })
          return jsonOk(playoff)
        }
      }
      if (url.includes('lm-api-reads')) return jsonOk({ teams: playoff.teams })
      return jsonOk([])
    })

  it('filters week 16 by matchup period 15 from cached league settings and paints the championship HUD', async () => {
    const leagueId = '77016001'
    const dir = setupWeek16(leagueId)
    writeFileSync(
      periodsPath(dir),
      JSON.stringify({
        at: Date.now(),
        season: '2026',
        byId: { [leagueId]: playoff.settings.scheduleSettings.matchupPeriods }
      })
    )
    warmupPollerCaches()
    const filters: number[][] = []
    vi.stubGlobal('fetch', stubEspn(filters))

    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().matchup?.myPoints).toBe(121.5)
    expect(currentState().matchup?.oppTeam?.name).toBe('Rival Club')
    expect(filters.length).toBeGreaterThan(0)
    expect(filters.every((ids) => ids.length === 1 && ids[0] === 15)).toBe(true)
    unlinkSync(periodsPath(dir))
  })

  it('learns matchup periods from league settings and persists them for the next launch', async () => {
    const leagueId = '77016002'
    const dir = setupWeek16(leagueId)
    if (existsSync(periodsPath(dir))) unlinkSync(periodsPath(dir))
    warmupPollerCaches()
    const filters: number[][] = []
    vi.stubGlobal('fetch', stubEspn(filters))

    await refresh({ waitForBoards: true })
    await expect
      .poll(async () => {
        await refresh({ waitForBoards: true })
        return currentState().matchup?.myPoints
      })
      .toBe(121.5)
    expect(filters.at(-1)).toEqual([15])
    await expect
      .poll(() =>
        existsSync(periodsPath(dir))
          ? (JSON.parse(readFileSync(periodsPath(dir), 'utf8')) as { byId: Record<string, unknown> }).byId[leagueId]
          : null
      )
      .toEqual(playoff.settings.scheduleSettings.matchupPeriods)
    unlinkSync(periodsPath(dir))
  })
})

describe('poller Sleeper Est. win% scoring kind', () => {
  it('projects a half-PPR league with pts_half_ppr, not the PPR column', async () => {
    const dir = app.getPath('userData')
    const leagueId = '880000000000000001'
    const selectedKey = leagueKey('sleeper', leagueId)
    saveSettings({
      sleeperUsername: 'halfppr',
      sleeperUserId: 'me',
      selectedLeagueKey: selectedKey,
      espnLeagueIds: []
    })
    writeNfl(dir)
    writeFileSync(
      join(dir, 'sideline-last-hud.json'),
      JSON.stringify({ at: Date.now(), displayWeek: 1, selectedKey, matchup: hudMatchup })
    )
    warmupPollerCaches()

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/state/nfl')) {
          return jsonOk({ week: 1, display_week: 1, season: '2026', league_season: '2026', season_type: 'regular' })
        }
        if (url.includes('/projections/')) {
          return jsonOk({
            '1': { pts_ppr: 20, pts_half_ppr: 17, pts_std: 14 },
            '3': { pts_ppr: 15, pts_half_ppr: 13, pts_std: 11 }
          })
        }
        if (url.includes('/matchups/')) return jsonOk(sleeperMatchups)
        if (url.includes('/leagues/')) {
          return jsonOk([{ league_id: leagueId, name: 'Half Stack', season: '2026', scoring_settings: { rec: 0.5 } }])
        }
        if (url.includes('/rosters')) {
          return jsonOk([
            { roster_id: 1, owner_id: 'me', players: ['1'], starters: ['1'] },
            { roster_id: 2, owner_id: 'them', players: ['3'], starters: ['3'] }
          ])
        }
        if (url.includes('/users')) {
          return jsonOk([
            { user_id: 'me', display_name: 'Me' },
            { user_id: 'them', display_name: 'You' }
          ])
        }
        if (url.includes('/user/')) return jsonOk({ user_id: 'me', username: 'halfppr' })
        if (url.includes('scoreboard')) return jsonOk({ events: [] })
        if (url.includes('/players/nfl')) return jsonOk({})
        return jsonOk([])
      })
    )

    await expect
      .poll(async () => {
        await refresh({ waitForBoards: true })
        return currentState().matchup?.myProjectedPoints
      })
      .toBe(17)
    expect(currentState().matchup?.oppProjectedPoints).toBe(13)
    expect(currentState().matchup?.winPctSource).toBe('estimated')
    const disk = JSON.parse(readFileSync(join(dir, 'sideline-sleeper-leagues.json'), 'utf8')) as {
      scoringKinds?: Record<string, string>
    }
    expect(disk.scoringKinds?.[leagueId]).toBe('half_ppr')
  })
})

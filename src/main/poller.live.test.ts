import { afterEach, describe, expect, it, vi } from 'vitest'
import { writeFileSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { leagueKey } from '@shared/types'

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

vi.mock('./windows/espnLogin', () => ({
  readEspnCookies: async () => null
}))

import { app } from 'electron'
import { saveSettings } from './store'
import { warmupPollerCaches, refresh, resetPollerForTests, currentState } from './poller'

afterEach(() => {
  resetPollerForTests()
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

    const matchupsAt = urls.findIndex((url) => url.includes('/matchups/'))
    const leaguesAt = urls.findIndex((url) => url.includes('/leagues/'))
    const playersAt = urls.findIndex((url) => url.includes('/players/nfl'))
    const scoreboardAt = urls.findIndex((url) => url.includes('scoreboard'))
    expect(matchupsAt).toBe(0)
    expect(inits[0]?.priority).toBe('high')
    expect(urls[0]).toContain(`/league/${leagueId}/matchups/1`)
    expect(urls[0]).toContain('?_=')
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
    expect(liveAt).toBe(0)
    expect(inits[0]?.priority).toBe('high')
    expect(urls[0]).toContain('lm-api-reads.fantasy.espn.com')
    expect(urls[0]).not.toContain('view=mTeam')
    expect(urls[0]).not.toContain('view=mScoreboard')
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
    expect(liveAt).toBe(0)
    expect(boxAt).toBeGreaterThan(liveAt)
    expect(inits[boxAt]?.priority).toBe('high')
    if (scoreboardAt >= 0) expect(boxAt).toBeLessThan(scoreboardAt)
  })

  it('kicks compact mLiveScoring first on a true-cold ESPN HUD and recovers mMatchupScore immediately', async () => {
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
    expect(liveAt).toBe(0)
    expect(boxAt).toBeGreaterThan(liveAt)
    expect(inits[boxAt]?.priority).toBe('high')
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
    expect(matchupsAt).toBe(0)
    expect(inits[0]?.priority).toBe('high')
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
        if (url.includes('scoreboard')) return jsonOk({ events: [] })
        return jsonOk({ teams: [], schedule: [] })
      })
    )

    await refresh({ waitForBoards: true })
    await expect.poll(() => currentState().matchup?.myPoints).toBe(12.5)
    await expect.poll(() => currentState().selectedLeagueKey).toBe(selectedKey)

    expect(urls[0]).toContain('view=mLiveScoring')
    expect(urls[0]).not.toContain('view=mMatchupScore')
    expect(urls[0]).not.toContain('view=mTeam')
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
    expect(matchupsAt).toBe(0)
    if (userAt >= 0) expect(matchupsAt).toBeLessThanOrEqual(userAt)
    releaseUser()
    await pending
    await expect.poll(() => currentState().matchup?.myPoints).toBe(12.5)
  })
})

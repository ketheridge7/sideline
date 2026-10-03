import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { emptyAppState, toOverlayHud, type LeagueBoardSnapshot, type Matchup } from '@shared/types'
import { espnScoreCacheKey } from './pollTargets'
import { HttpBackoffError } from './http'
import { EspnHttpError, weekScheduleFilter, weekTeamScheduleFilter } from './providers/espnClient'
import { LIVE_POLL_MS, IDLE_POLL_MS } from './liveWindow'
import { toSleeperLeaguePairs } from './providers/sleeperAdapter'
import {
  bindLeagueBrowse,
  espnBrowseFetchArgs,
  espnLeagueAllCacheKey,
  leagueBrowseBackoff,
  leagueBrowseEspnCacheKeys,
  leagueBrowseOpenArg,
  leagueBrowseSettled,
  leagueBrowseWeek,
  leagueBrowseWindowVisible,
  offerSleeperMatchups,
  pokeLeagueBrowse,
  refreshSleeperLeagueBoard,
  resetLeagueBrowse,
  setLeagueBrowseOpen,
  setLeagueBrowseScheduler,
  setLeagueBrowseVisible,
  type LeagueBrowseContext,
  type LeagueBrowseHost,
  type LeagueBrowseKind
} from './leagueBrowse'

const matchup: Matchup = {
  myTeam: { id: '1', name: 'Alpha', owner: 'Ada', record: '2-0' },
  oppTeam: { id: '2', name: 'Bravo', owner: 'Bo', record: '1-1' },
  myPoints: 10,
  oppPoints: 8,
  starters: [{ playerId: '10', name: 'Alpha QB', position: 'QB', nflTeam: 'DAL', points: 10 }],
  bench: [],
  oppStarters: [{ playerId: '20', name: 'Bravo QB', position: 'QB', nflTeam: 'KC', points: 8 }],
  oppBench: []
}

const espnBody = {
  scoringPeriodId: 1,
  teams: [
    { id: 1, name: 'Alpha' },
    { id: 2, name: 'Bravo' },
    { id: 7, name: 'Golf' }
  ],
  schedule: [
    {
      matchupPeriodId: 1,
      home: { teamId: 1, totalPointsLive: 10 },
      away: { teamId: 2, totalPointsLive: 8 }
    }
  ]
}

describe('espnBrowseFetchArgs', () => {
  it('asks for a week-wide low-priority read with a 3s abort and no team filter', () => {
    const box = espnBrowseFetchArgs('boxscore', 4)
    const live = espnBrowseFetchArgs('compact', 4)
    expect(box.views).toEqual(['mMatchupScore'])
    expect(live.views).toEqual(['mLiveScoring'])
    expect(box.filter).toEqual(weekScheduleFilter(4))
    expect(box.filter).not.toEqual(weekTeamScheduleFilter(4, 1))
    expect(box.timeoutMs).toBe(LIVE_POLL_MS)
    expect(box.priority).toBe('low')
    expect(box.retries).toBe(0)
    expect(leagueBrowseBackoff(new HttpBackoffError('https://lm-api-reads.fantasy.espn.com', Date.now()))).toBe(true)
    expect(leagueBrowseBackoff(new EspnHttpError(429, 'wrapped'))).toBe(true)
    expect(espnLeagueAllCacheKey('1', 4)).toBe('1:4:all')
    expect(espnLeagueAllCacheKey('1', 4)).not.toBe(espnScoreCacheKey('1', 4))
    expect(leagueBrowseWeek('espn', { displayWeek: 16, seasonType: 'regular', leg: 16 })).toBe(16)
    expect(leagueBrowseWeek('sleeper', { displayWeek: 19, seasonType: 'post', leg: 16 })).toBe(16)
    expect(leagueBrowseOpenArg({ open: true })).toBe(true)
    expect(leagueBrowseOpenArg({ open: false })).toBe(false)
    expect(leagueBrowseOpenArg({ open: 'false' })).toBeNull()
    expect(leagueBrowseOpenArg(true)).toBeNull()
    expect(leagueBrowseOpenArg(null)).toBeNull()
    const shown = { isDestroyed: () => false, isVisible: () => true, isMinimized: () => false }
    expect(leagueBrowseWindowVisible(shown)).toBe(true)
    expect(leagueBrowseWindowVisible({ ...shown, isMinimized: () => true })).toBe(false)
    expect(leagueBrowseWindowVisible({ ...shown, isVisible: () => false })).toBe(false)
    expect(leagueBrowseWindowVisible({ ...shown, isDestroyed: () => true })).toBe(false)
  })
})

describe('league browse isolation', () => {
  let fetches: LeagueBrowseKind[] = []
  let published: LeagueBoardSnapshot[] = []
  let queued: { fn: () => void; ms: number } | null = null
  let now = 1_000
  let failNext = false
  let ctx: LeagueBrowseContext
  const hudCache = new Map<string, string>([['1', 'hud-boxscore']])

  const state = (): ReturnType<typeof emptyAppState> => {
    const next = emptyAppState()
    next.selectedLeagueKey = 'espn:1'
    next.matchup = matchup
    next.nfl = { week: 1, displayWeek: 1, season: '2026', leagueSeason: '2026', seasonType: 'regular' }
    return next
  }

  const host = (): LeagueBrowseHost => ({
    now: () => now,
    context: () => ctx,
    publish: (snapshot) => {
      published.push(snapshot)
    },
    fetchEspn: async (args) => {
      fetches.push(args.kind)
      if (failNext) throw new HttpBackoffError('https://lm-api-reads.fantasy.espn.com', now + 10_000)
      return espnBody
    },
    sleeperBuild: () => [
      {
        id: 'm:1',
        mine: true,
        matchup,
        left: 0,
        oppLeft: 1
      }
    ],
    replayPairs: () => [
      { id: 'replay', mine: true, matchup, left: 2, oppLeft: 3 }
    ],
    espnTeams: () => [],
    myEspnTeamId: () => 1
  })

  beforeEach(() => {
    resetLeagueBrowse()
    fetches = []
    published = []
    queued = null
    now = 1_000
    failNext = false
    ctx = {
      leagueKey: 'espn:1',
      leagueName: 'Gridiron',
      provider: 'espn',
      leagueId: '1',
      season: '2026',
      week: 1,
      matchupPeriod: { matchupPeriodId: 1, scoringPeriodIds: [1] },
      pollingLive: true,
      replay: false,
      ticker: []
    }
    setLeagueBrowseScheduler((fn, ms) => {
      queued = { fn, ms }
      return {
        cancel: () => {
          if (queued?.fn === fn) queued = null
        }
      }
    })
    bindLeagueBrowse(host())
  })

  afterEach(() => {
    delete process.env.SIDELINE_REPLAY_BOARD
    resetLeagueBrowse()
  })

  it('does not change HUD state, the overlay payload, or the HUD ESPN cache', async () => {
    const app = state()
    const beforeOverlay = JSON.stringify(toOverlayHud(app))
    const beforeMatchup = JSON.stringify(app.matchup)
    const beforeKey = app.selectedLeagueKey
    const beforeCache = JSON.stringify([...hudCache])
    setLeagueBrowseVisible(true)
    setLeagueBrowseOpen(true)
    await leagueBrowseSettled()
    expect(fetches).toEqual(['boxscore'])
    expect(leagueBrowseEspnCacheKeys()).toEqual([espnLeagueAllCacheKey('1', 1)])
    expect(hudCache.has(espnLeagueAllCacheKey('1', 1))).toBe(false)
    expect(JSON.stringify(toOverlayHud(app))).toBe(beforeOverlay)
    expect(JSON.stringify(app.matchup)).toBe(beforeMatchup)
    expect(app.selectedLeagueKey).toBe(beforeKey)
    expect(JSON.stringify([...hudCache])).toBe(beforeCache)
    expect(published[0]?.leagueKey).toBe('espn:1')
    expect(published[0]).not.toBe(app)
  })

  it('makes no ESPN request while the view is closed or the window is hidden', async () => {
    setLeagueBrowseVisible(true)
    setLeagueBrowseOpen(false)
    await leagueBrowseSettled()
    setLeagueBrowseVisible(false)
    setLeagueBrowseOpen(true)
    await leagueBrowseSettled()
    expect(fetches).toEqual([])
    expect(leagueBrowseEspnCacheKeys()).toEqual([])
  })

  it('polls compact live after the opening boxscore and not on that same 3s tick', async () => {
    setLeagueBrowseVisible(true)
    setLeagueBrowseOpen(true)
    await leagueBrowseSettled()
    expect(fetches).toEqual(['boxscore'])
    expect(queued?.ms).toBe(LIVE_POLL_MS)
    now += LIVE_POLL_MS
    queued?.fn()
    await leagueBrowseSettled()
    expect(fetches).toEqual(['boxscore', 'compact'])
  })

  it('refreshes the idle boxscore on the 30s cadence and skips compact live', async () => {
    ctx = { ...ctx, pollingLive: false }
    setLeagueBrowseVisible(true)
    setLeagueBrowseOpen(true)
    await leagueBrowseSettled()
    expect(queued?.ms).toBe(IDLE_POLL_MS)
    now += IDLE_POLL_MS
    queued?.fn()
    await leagueBrowseSettled()
    expect(fetches).toEqual(['boxscore', 'boxscore'])
  })

  it('stops on HttpBackoffError and keeps the last snapshot', async () => {
    setLeagueBrowseVisible(true)
    setLeagueBrowseOpen(true)
    await leagueBrowseSettled()
    const painted = published.at(-1)
    failNext = true
    now += LIVE_POLL_MS
    queued?.fn()
    await leagueBrowseSettled()
    expect(fetches).toEqual(['boxscore', 'compact'])
    const failed = published.at(-1)
    expect(failed?.status).toBe('error')
    expect(failed?.pairs).toEqual(painted?.pairs)
    expect(queued).toBeNull()
    now += LIVE_POLL_MS
    await leagueBrowseSettled()
    expect(fetches).toEqual(['boxscore', 'compact'])
  })

  it('reuses a Sleeper matchup array that arrived while the view is open and does not fetch when it is closed', async () => {
    ctx = { ...ctx, provider: 'sleeper', leagueKey: 'sleeper:9', leagueId: '9' }
    offerSleeperMatchups('9', 1, [])
    setLeagueBrowseVisible(true)
    setLeagueBrowseOpen(true)
    await leagueBrowseSettled()
    expect(fetches).toEqual([])
    expect(published.at(-1)?.status).toBe('loading')
    offerSleeperMatchups('9', 1, [
      { roster_id: 1, matchup_id: 1, points: 90 },
      { roster_id: 2, matchup_id: 1, points: 80 }
    ])
    expect(fetches).toEqual([])
    expect(published.at(-1)?.status).toBe('ready')
    expect(published.at(-1)?.pairs[0]?.matchup.myTeam.name).toBe('Alpha')
  })

  it('does not start a second fetch when open is repeated, and drops the timer when the window hides', async () => {
    setLeagueBrowseVisible(true)
    setLeagueBrowseOpen(true)
    setLeagueBrowseOpen(true)
    await leagueBrowseSettled()
    expect(fetches).toEqual(['boxscore'])
    expect(queued).not.toBeNull()
    setLeagueBrowseVisible(false)
    expect(queued).toBeNull()
  })

  it('drops a late response after the league or week changes', async () => {
    const waits: Array<(value: unknown) => void> = []
    bindLeagueBrowse({
      ...host(),
      fetchEspn: (args) => {
        fetches.push(args.kind)
        return new Promise((resolve) => {
          waits.push(resolve)
        })
      }
    })
    setLeagueBrowseVisible(true)
    setLeagueBrowseOpen(true)
    expect(waits).toHaveLength(1)
    ctx = { ...ctx, leagueKey: 'espn:2', leagueId: '2', leagueName: 'Other' }
    pokeLeagueBrowse()
    expect(waits).toHaveLength(2)
    waits[1]?.({ ...espnBody })
    waits[0]?.({ ...espnBody, scoringPeriodId: 99 })
    await leagueBrowseSettled()
    expect(published.filter((row) => row.leagueKey === 'espn:1' && row.status === 'ready')).toEqual([])
    expect(published.at(-1)?.leagueKey).toBe('espn:2')
    expect(published.at(-1)?.status).toBe('ready')

    ctx = { ...ctx, week: 2 }
    pokeLeagueBrowse()
    expect(waits).toHaveLength(3)
    waits[2]?.({ ...espnBody, scoringPeriodId: 2 })
    await leagueBrowseSettled()
    expect(published.at(-1)?.week).toBe(2)
    expect(published.some((row) => row.leagueKey === 'espn:2' && row.week === 2 && row.status === 'loading' && row.pairs.length === 0)).toBe(
      true
    )
  })

  it('does not fetch in replay', async () => {
    ctx = { ...ctx, replay: true }
    setLeagueBrowseVisible(true)
    setLeagueBrowseOpen(true)
    await leagueBrowseSettled()
    expect(fetches).toEqual([])
    expect(published.at(-1)?.pairs[0]?.id).toBe('replay')
  })

  it('can hold a replay board on a loading skeleton or an error banner', async () => {
    ctx = { ...ctx, replay: true }
    process.env.SIDELINE_REPLAY_BOARD = 'loading'
    setLeagueBrowseVisible(true)
    setLeagueBrowseOpen(true)
    await leagueBrowseSettled()
    expect(published.at(-1)?.status).toBe('loading')
    expect(published.at(-1)?.pairs).toEqual([])

    resetLeagueBrowse()
    published = []
    process.env.SIDELINE_REPLAY_BOARD = 'error'
    setLeagueBrowseVisible(true)
    setLeagueBrowseOpen(true)
    await leagueBrowseSettled()
    expect(published.at(-1)?.status).toBe('error')
    expect(published.at(-1)?.error).toContain('rate limit')
    expect(published.at(-1)?.pairs[0]?.id).toBe('replay')
    delete process.env.SIDELINE_REPLAY_BOARD
  })

  it('repaints Sleeper Est. win% when projections arrive, which a same-league poke does not', async () => {
    let projections: Record<string, number> | null = null
    ctx = { ...ctx, provider: 'sleeper', leagueKey: 'sleeper:9', leagueId: '9', leagueName: 'Median' }
    bindLeagueBrowse({
      ...host(),
      sleeperBuild: (_leagueId, _week, rows) =>
        toSleeperLeaguePairs({
          userId: 'u1',
          rosters: [
            { roster_id: 1, owner_id: 'u1', settings: { wins: 1, losses: 0 } },
            { roster_id: 2, owner_id: 'u2', settings: { wins: 0, losses: 1 } }
          ],
          users: [
            { user_id: 'u1', display_name: 'Ada', metadata: { team_name: 'Alpha' } },
            { user_id: 'u2', display_name: 'Bo', metadata: { team_name: 'Bravo' } }
          ],
          matchups: rows,
          players: {
            '10': { name: 'Alpha QB', position: 'QB', nflTeam: 'DAL' },
            '20': { name: 'Bravo QB', position: 'QB', nflTeam: 'KC' }
          },
          projections
        })
    })
    setLeagueBrowseVisible(true)
    setLeagueBrowseOpen(true)
    await leagueBrowseSettled()
    offerSleeperMatchups('9', 1, [
      { roster_id: 1, matchup_id: 1, points: 0, starters: ['10'], players: ['10'], players_points: { '10': 0 } },
      { roster_id: 2, matchup_id: 1, points: 0, starters: ['20'], players: ['20'], players_points: { '20': 0 } }
    ])
    expect(published.at(-1)?.pairs[0]?.matchup.myWinPct).toBeUndefined()
    projections = { '10': 18, '20': 12 }
    pokeLeagueBrowse()
    expect(published.at(-1)?.pairs[0]?.matchup.myWinPct).toBeUndefined()
    refreshSleeperLeagueBoard()
    expect(published.at(-1)?.pairs[0]?.matchup.winPctSource).toBe('estimated')
    expect(published.at(-1)?.pairs[0]?.matchup.myWinPct).toEqual(expect.any(Number))
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getLeague,
  getLeagueUsers,
  getMatchups,
  getNflState,
  getPlayersNfl,
  getRosters,
  getTransactions,
  getUser,
  getUserLeagues,
  parseSleeperLeague,
  parseSleeperLeagueUser,
  parseSleeperMatchup,
  parseSleeperNflState,
  parseSleeperRoster,
  parseSleeperTransaction,
  parseSleeperUser,
  parseWeekProjections,
  getWeekProjections,
  toProjectionPtsMap,
  sleeperScoringKind,
  SleeperHttpError
} from './sleeperClient'
import { resetHostBackoff } from '../http'

afterEach(() => {
  vi.unstubAllGlobals()
  resetHostBackoff()
})

describe('sleeperClient', () => {
  it('sends every official GET through fetchJson with an abort timeout', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        week: 1,
        display_week: 1,
        season: '2026',
        league_season: '2026',
        season_type: 'regular',
        user_id: 'u1',
        league_id: '123',
        name: 'Test',
        roster_id: 1,
        owner_id: 'u1',
        matchup_id: 1
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    await getNflState()
    await getUser('bob')
    await getUserLeagues('u1', '2026')
    await getLeague('123')
    await getRosters('123')
    await getLeagueUsers('123')
    await getMatchups('123', 3)
    await getTransactions('123', 3)
    await getPlayersNfl()
    const urls = fetchMock.mock.calls.map((call) => call[0] as string)
    const playerDumpDay = String(Math.floor(Date.now() / 86_400_000))
    expect(urls[0]).toMatch(/^https:\/\/api\.sleeper\.app\/v1\/state\/nfl\?_=\d+$/)
    expect(urls[1]).toMatch(/^https:\/\/api\.sleeper\.app\/v1\/user\/bob\?_=\d+$/)
    expect(urls[2]).toMatch(/^https:\/\/api\.sleeper\.app\/v1\/user\/u1\/leagues\/nfl\/2026\?_=\d+$/)
    expect(urls[3]).toMatch(/^https:\/\/api\.sleeper\.app\/v1\/league\/123\?_=\d+$/)
    expect(urls[4]).toMatch(/^https:\/\/api\.sleeper\.app\/v1\/league\/123\/rosters\?_=\d+$/)
    expect(urls[5]).toMatch(/^https:\/\/api\.sleeper\.app\/v1\/league\/123\/users\?_=\d+$/)
    expect(urls[6]).toMatch(/^https:\/\/api\.sleeper\.app\/v1\/league\/123\/matchups\/3\?_=\d+$/)
    expect(urls[7]).toMatch(/^https:\/\/api\.sleeper\.app\/v1\/league\/123\/transactions\/3\?_=\d+$/)
    expect(urls[8]).toBe(`https://api.sleeper.app/v1/players/nfl?_=${playerDumpDay}`)
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ signal: expect.any(AbortSignal) })
  })

  it('maps 404 onto SleeperHttpError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({})
      })
    )
    await expect(getUser('nobody')).rejects.toBeInstanceOf(SleeperHttpError)
    await expect(getUser('nobody')).rejects.toMatchObject({ status: 404 })
  })

  it('does not look up a blank Sleeper username', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(getUser('  ', { retries: 0 })).rejects.toMatchObject({ status: 400 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('defaults every Sleeper GET to a 5s live budget with no retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({})
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(getMatchups('123', 1)).rejects.toBeInstanceOf(SleeperHttpError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      cache: 'no-store',
      signal: expect.any(AbortSignal)
    })
  })

  it('appends a cache-bust query on live matchups so Cloudflare cannot serve a 5-minute HIT', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => []
    })
    vi.stubGlobal('fetch', fetchMock)
    await getMatchups('123', 1, { retries: 0, cacheBust: '4' })
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.sleeper.app/v1/league/123/matchups/1?_=4')
  })

  it('marks live /matchups as Chromium high priority', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => []
    })
    vi.stubGlobal('fetch', fetchMock)
    await getMatchups('123', 1, { retries: 0, cacheBust: '4', priority: 'high' })
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ priority: 'high', cache: 'no-store' })
  })

  it('marks live /transactions as Chromium low priority', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => []
    })
    vi.stubGlobal('fetch', fetchMock)
    await getTransactions('123', 1, { retries: 0, cacheBust: 'tx', priority: 'low' })
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ priority: 'low', cache: 'no-store' })
  })

  it('cache-busts transactions, league lists, roster identity, and /user the same way', async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => (String(url).includes('/user/bob') ? { user_id: 'u1' } : [])
    }))
    vi.stubGlobal('fetch', fetchMock)
    await getTransactions('123', 1, { retries: 0, cacheBust: 'tx' })
    await getUserLeagues('u1', '2026', { retries: 0, cacheBust: 'lg' })
    await getRosters('123', { retries: 0, cacheBust: 'rs' })
    await getLeagueUsers('123', { retries: 0, cacheBust: 'us' })
    await getUser('bob', { retries: 0, cacheBust: 'u' })
    const urls = fetchMock.mock.calls.map((call) => call[0] as string)
    expect(urls).toEqual([
      'https://api.sleeper.app/v1/league/123/transactions/1?_=tx',
      'https://api.sleeper.app/v1/user/u1/leagues/nfl/2026?_=lg',
      'https://api.sleeper.app/v1/league/123/rosters?_=rs',
      'https://api.sleeper.app/v1/league/123/users?_=us',
      'https://api.sleeper.app/v1/user/bob?_=u'
    ])
  })

  it('cache-busts /state/nfl so a week rollover is not stuck on a 60s CDN HIT', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        week: 1,
        display_week: 1,
        season: '2026',
        league_season: '2026',
        season_type: 'regular'
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    await getNflState({ retries: 0, cacheBust: 'st' })
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.sleeper.app/v1/state/nfl?_=st')
  })

  it('can skip retries on the live transaction path', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({})
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(getTransactions('123', 1, { retries: 0 })).rejects.toBeInstanceOf(SleeperHttpError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('can skip retries on live roster, user, and NFL state fetches', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({})
    })
    vi.stubGlobal('fetch', fetchMock)
    const calls = [
      () => getRosters('123', { retries: 0 }),
      () => getLeagueUsers('123', { retries: 0 }),
      () => getNflState({ retries: 0 }),
      () => getUser('bob', { retries: 0 }),
      () => getUserLeagues('u1', '2026', { retries: 0 }),
      () => getLeague('123', { retries: 0 })
    ]
    for (const call of calls) {
      // Isolate the retry count from the 5xx host breaker.
      resetHostBackoff()
      await expect(call()).rejects.toBeInstanceOf(SleeperHttpError)
    }
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })

  it('stops calling api.sleeper.app after repeated 5xx and surfaces a 429-style hold', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    for (let i = 0; i < 5; i++) {
      await expect(getMatchups('123', 1, { retries: 0 })).rejects.toBeInstanceOf(SleeperHttpError)
    }
    expect(fetchMock).toHaveBeenCalledTimes(3)
    await expect(getRosters('123', { retries: 0 })).rejects.toMatchObject({ status: 429 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('retries a connect /user lookup once on 5xx', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({})
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ user_id: 'u1', username: 'bob' })
      })
    vi.stubGlobal('fetch', fetchMock)
    await expect(getUser('bob', { retries: 1, cacheBust: 'u' })).resolves.toMatchObject({
      user_id: 'u1',
      username: 'bob'
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry the daily /players/nfl dump', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({})
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(getPlayersNfl()).rejects.toBeInstanceOf(SleeperHttpError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not call /matchups or /transactions for a non-scoring week', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(getMatchups('lg', 0, { retries: 0 })).resolves.toEqual([])
    await expect(getTransactions('lg', 0, { retries: 0 })).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not call league GETs for a non-numeric id', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(getMatchups('fourth-drunken', 1, { retries: 0 })).resolves.toEqual([])
    await expect(getTransactions('fourth-drunken', 1, { retries: 0 })).resolves.toEqual([])
    await expect(getRosters('fourth-drunken', { retries: 0 })).resolves.toEqual([])
    await expect(getLeagueUsers('fourth-drunken', { retries: 0 })).resolves.toEqual([])
    await expect(getLeague('fourth-drunken', { retries: 0 })).rejects.toMatchObject({ status: 400 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('treats a non-array matchup payload as empty instead of throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ error: 'nope' })
      })
    )
    await expect(getMatchups('123', 1, { retries: 0 })).resolves.toEqual([])
    await expect(getRosters('123', { retries: 0 })).resolves.toEqual([])
  })

  it('treats an empty or invalid JSON list body as empty instead of throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => {
          throw new SyntaxError('Unexpected end of JSON input')
        }
      })
    )
    await expect(getMatchups('123', 1, { retries: 0 })).resolves.toEqual([])
    await expect(getRosters('123', { retries: 0 })).resolves.toEqual([])
    await expect(getTransactions('123', 1, { retries: 0 })).resolves.toEqual([])
  })

  it('unwraps wrapped matchup and roster list bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => ({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () =>
          String(url).includes('/matchups/')
            ? { matchups: [{ roster_id: 1, matchup_id: 7, points: 41.2 }] }
            : { rosters: [{ roster_id: 2, owner_id: 'u1' }] }
      }))
    )
    await expect(getMatchups('123', 1, { retries: 0 })).resolves.toMatchObject([
      { roster_id: 1, matchup_id: 7, points: 41.2 }
    ])
    await expect(getRosters('123', { retries: 0 })).resolves.toMatchObject([
      { roster_id: 2, owner_id: 'u1' }
    ])
  })

  it('unwraps items and payload list envelopes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => ({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () =>
          String(url).includes('/matchups/')
            ? { items: [{ roster_id: 1, matchup_id: 7, points: 18.4 }] }
            : { payload: [{ roster_id: 2, owner_id: 'u1' }] }
      }))
    )
    await expect(getMatchups('123', 1, { retries: 0 })).resolves.toMatchObject([
      { roster_id: 1, matchup_id: 7, points: 18.4 }
    ])
    await expect(getRosters('123', { retries: 0 })).resolves.toMatchObject([
      { roster_id: 2, owner_id: 'u1' }
    ])
  })

  it('unwraps index-keyed and wrapped-map Sleeper list bodies so HUD cannot miss /matchups', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => ({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () =>
          String(url).includes('/matchups/')
            ? { '0': { roster_id: 1, matchup_id: 7, points: 41.2 } }
            : { rosters: { '1': { roster_id: 2, owner_id: 'u1' } } }
      }))
    )
    await expect(getMatchups('123', 1, { retries: 0 })).resolves.toMatchObject([
      { roster_id: 1, matchup_id: 7, points: 41.2 }
    ])
    await expect(getRosters('123', { retries: 0 })).resolves.toMatchObject([
      { roster_id: 2, owner_id: 'u1' }
    ])
  })

  it('unwraps singular matchup and roster list keys so HUD cannot miss /matchups', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => ({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () =>
          String(url).includes('/matchups/')
            ? { matchup: [{ roster_id: 1, matchup_id: 7, points: 41.2 }] }
            : { roster: [{ roster_id: 2, owner_id: 'u1' }] }
      }))
    )
    await expect(getMatchups('123', 1, { retries: 0 })).resolves.toMatchObject([
      { roster_id: 1, matchup_id: 7, points: 41.2 }
    ])
    await expect(getRosters('123', { retries: 0 })).resolves.toMatchObject([
      { roster_id: 2, owner_id: 'u1' }
    ])
  })

  it('fills display_week, league_season, and season_type when Sleeper omits them', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ week: 1, season: '2026' })
      })
    )
    await expect(getNflState({ retries: 0 })).resolves.toEqual({
      week: 1,
      display_week: 1,
      season: '2026',
      league_season: '2026',
      season_type: 'regular'
    })
  })

  it('parses Sleeper NFL state when week and season are numeric strings', () => {
    expect(
      parseSleeperNflState({
        week: '1',
        display_week: '1',
        season: 2026,
        league_season: '2026',
        season_type: 'regular'
      })
    ).toEqual({
      week: 1,
      display_week: 1,
      season: '2026',
      league_season: '2026',
      season_type: 'regular'
    })
  })

  it('unwraps wrapped /state/nfl and /user envelopes so a shape change cannot stall week or identity', () => {
    expect(
      parseSleeperNflState({
        data: {
          week: '1',
          display_week: 1,
          season: '2026',
          league_season: '2026',
          season_type: 'regular'
        }
      })
    ).toMatchObject({ week: 1, display_week: 1, season: '2026' })
    expect(parseSleeperUser({ user: { user_id: 12345, username: 'bob' } })).toEqual({
      user_id: '12345',
      username: 'bob',
      display_name: undefined
    })
    expect(parseSleeperMatchup({ matchup: { roster_id: 1, matchup_id: 7, points: 12.4 } })).toMatchObject({
      roster_id: 1,
      matchup_id: 7,
      points: 12.4
    })
    expect(parseSleeperLeague({ league: { league_id: 11, name: 'Test', season: 2026 } })).toEqual({
      league_id: '11',
      name: 'Test',
      season: '2026'
    })
    expect(parseSleeperRoster({ roster: { roster_id: 2, owner_id: 'u1' } })).toMatchObject({
      roster_id: 2,
      owner_id: 'u1'
    })
    expect(
      parseSleeperTransaction({ transaction: { transaction_id: '99', type: 'waiver', adds: { '1': 1 } } })
    ).toMatchObject({
      transaction_id: '99',
      type: 'waiver',
      adds: { '1': 1 }
    })
  })

  it('uses league_id as the board name when Sleeper omits name', () => {
    expect(parseSleeperLeague({ league_id: 11, season: 2026 })).toEqual({
      league_id: '11',
      name: '11',
      season: '2026'
    })
  })

  it('coerces a numeric Sleeper user_id so HUD identity cannot miss the roster', () => {
    expect(parseSleeperUser({ user_id: 12345, username: 'bob' })).toEqual({
      user_id: '12345',
      username: 'bob',
      display_name: undefined
    })
  })

  it('coerces a numeric Sleeper transaction_id so tape rows keep a stable id', () => {
    expect(
      parseSleeperTransaction({
        transaction_id: 99,
        type: 'waiver',
        status: 'complete',
        status_updated: '1710000000000',
        adds: { '1': 1 }
      })
    ).toEqual({
      transaction_id: '99',
      type: 'waiver',
      status: 'complete',
      status_updated: 1710000000000,
      created: undefined,
      adds: { '1': 1 },
      drops: null
    })
  })

  it('coerces quoted Sleeper add and drop roster ids', () => {
    expect(
      parseSleeperTransaction({
        transaction_id: '99',
        type: 'waiver',
        adds: { '4046': '1', 6797: '2' },
        drops: { '9': '1' }
      })
    ).toEqual({
      transaction_id: '99',
      type: 'waiver',
      status: undefined,
      status_updated: undefined,
      created: undefined,
      adds: { '4046': 1, '6797': 2 },
      drops: { '9': 1 }
    })
  })

  it('reads adds and drops when Sleeper sends player/roster rows as an array', () => {
    expect(
      parseSleeperTransaction({
        transaction_id: '99',
        type: 'waiver',
        adds: [
          { player_id: '4046', roster_id: '1' },
          { playerId: 6797, rosterId: 2 }
        ],
        drops: [{ id: '9', roster_id: 1 }]
      })
    ).toEqual({
      transaction_id: '99',
      type: 'waiver',
      status: undefined,
      status_updated: undefined,
      created: undefined,
      adds: { '4046': 1, '6797': 2 },
      drops: { '9': 1 }
    })
  })

  it('reads nested roster_id objects on Sleeper adds maps', () => {
    expect(
      parseSleeperTransaction({
        transaction_id: '99',
        type: 'waiver',
        adds: { '4046': { roster_id: '1' }, '0': { player_id: '6797', roster_id: 2 } }
      })
    ).toMatchObject({
      adds: { '4046': 1, '6797': 2 }
    })
  })

  it('treats empty Sleeper add and drop objects as null', () => {
    expect(
      parseSleeperTransaction({
        transaction_id: '99',
        type: 'waiver',
        adds: {},
        drops: { nope: 'x' }
      })
    ).toMatchObject({
      adds: null,
      drops: null
    })
  })

  it('coerces quoted matchup points, starter ids, and players_points', () => {
    expect(
      parseSleeperMatchup({
        roster_id: '1',
        matchup_id: '7',
        points: '41.2',
        custom_points: null,
        starters: [4046, '6797'],
        players: [4046, 6797, 9],
        players_points: { '4046': '22.4', '6797': 18.8 },
        starters_points: ['22.4', 18.8]
      })
    ).toEqual({
      roster_id: 1,
      matchup_id: 7,
      points: 41.2,
      custom_points: null,
      starters: ['4046', '6797'],
      players: ['4046', '6797', '9'],
      players_points: { '4046': 22.4, '6797': 18.8 },
      starters_points: [22.4, 18.8]
    })
  })

  it('zips array players_points onto player ids and index-keyed starters_points', () => {
    expect(
      parseSleeperMatchup({
        roster_id: 1,
        matchup_id: 7,
        points: 41.2,
        starters: ['4046', '6797'],
        players: ['4046', '6797', '9'],
        players_points: ['22.4', 18.8, 1],
        starters_points: { '0': '22.4', '1': 18.8 }
      })
    ).toEqual({
      roster_id: 1,
      matchup_id: 7,
      points: 41.2,
      custom_points: null,
      starters: ['4046', '6797'],
      players: ['4046', '6797', '9'],
      players_points: { '4046': 22.4, '6797': 18.8, '9': 1 },
      starters_points: [22.4, 18.8]
    })
  })

  it('zips a starter-length players_points array onto starters, not the full roster', () => {
    expect(
      parseSleeperMatchup({
        roster_id: 1,
        matchup_id: 7,
        starters: ['4046', '6797'],
        players: ['9', '4046', '6797'],
        players_points: [22.4, 18.8]
      })
    ).toMatchObject({
      players_points: { '4046': 22.4, '6797': 18.8 }
    })
  })

  it('reads dense index-keyed starters and players objects', () => {
    expect(
      parseSleeperMatchup({
        roster_id: 1,
        matchup_id: 7,
        starters: { '0': 4046, '1': '6797' },
        players: { '0': '4046', '1': 6797, '2': 9 },
        players_points: [22.4, 18.8, 1]
      })
    ).toMatchObject({
      starters: ['4046', '6797'],
      players: ['4046', '6797', '9'],
      players_points: { '4046': 22.4, '6797': 18.8, '9': 1 }
    })
  })

  it('does not treat player-id keyed starters as a sparse index list', () => {
    expect(
      parseSleeperMatchup({
        roster_id: 1,
        matchup_id: 7,
        starters: { '4046': true, '6797': true }
      })?.starters
    ).toEqual(['4046', '6797'])
  })

  it('reads starters as player_id objects instead of dropping them as an empty lineup', () => {
    expect(
      parseSleeperMatchup({
        roster_id: 1,
        matchup_id: 7,
        starters: [{ player_id: 4046 }, { playerId: '6797' }],
        players: [{ id: '4046' }, { player_id: 6797 }, { playerId: '9' }]
      })
    ).toMatchObject({
      starters: ['4046', '6797'],
      players: ['4046', '6797', '9']
    })
  })

  it('keeps last-HUD starters when object ids cannot be coerced, instead of painting an empty lineup', () => {
    expect(
      parseSleeperMatchup({
        roster_id: 1,
        matchup_id: 7,
        starters: [{ slot: 0 }, { slot: 1 }]
      })?.starters
    ).toBeUndefined()
  })

  it('aligns player-id keyed starters_points onto starters and does not treat ids as indexes', () => {
    const parsed = parseSleeperMatchup({
      roster_id: 1,
      matchup_id: 7,
      starters: ['4046', '6797'],
      players: ['4046', '6797'],
      starters_points: { '4046': 22.4, '6797': 18.8 }
    })
    expect(parsed?.starters_points).toEqual([22.4, 18.8])
    expect(parsed?.starters_points?.length).toBe(2)
  })

  it('reads player-id keyed starters_points into players_points when starters are omitted', () => {
    expect(
      parseSleeperMatchup({
        roster_id: 1,
        matchup_id: 7,
        points: 41.2,
        starters_points: { '4046': 22.4, '6797': '18.8' }
      })
    ).toMatchObject({
      starters_points: undefined,
      players_points: { '4046': 22.4, '6797': 18.8 }
    })
  })

  it('reads nested points objects on players_points and starters_points', () => {
    expect(
      parseSleeperMatchup({
        roster_id: 1,
        matchup_id: 7,
        points: 41.2,
        starters: ['4046', '6797'],
        players: ['4046', '6797', '9'],
        players_points: {
          '4046': { points: '22.4' },
          '6797': { pts: 18.8 },
          '9': { score: 1 }
        },
        starters_points: [{ liveScore: 22.4 }, { points: 18.8 }]
      })
    ).toMatchObject({
      players_points: { '4046': 22.4, '6797': 18.8, '9': 1 },
      starters_points: [22.4, 18.8]
    })
  })

  it('reads nested points objects on matchup totals', () => {
    expect(
      parseSleeperMatchup({
        roster_id: 1,
        matchup_id: 7,
        points: { liveScore: '41.2' },
        custom_points: { points: 0 }
      })
    ).toMatchObject({
      points: 41.2,
      custom_points: 0
    })
    expect(parseSleeperMatchup({ roster_id: 1, matchup_id: 7, points: { fpts: '41.2' } })?.points).toBe(41.2)
    expect(parseSleeperMatchup({ roster_id: 1, matchup_id: 7, fpts: '41.2' })?.points).toBe(41.2)
  })

  it('keys array players_points objects by player_id instead of zipping roster order', () => {
    expect(
      parseSleeperMatchup({
        roster_id: 1,
        matchup_id: 7,
        starters: ['4046', '6797'],
        players: ['9', '4046', '6797'],
        players_points: [
          { player_id: '4046', points: 22.4 },
          { playerId: 6797, pts: 18.8 },
          { id: '9', score: 1 }
        ]
      })
    ).toMatchObject({
      players_points: { '4046': 22.4, '6797': 18.8, '9': 1 }
    })
  })

  it('aligns array starters_points objects onto starters by player id', () => {
    expect(
      parseSleeperMatchup({
        roster_id: 1,
        matchup_id: 7,
        starters: ['4046', '6797'],
        starters_points: [
          { player_id: '6797', points: 18.8 },
          { player_id: '4046', points: 22.4 }
        ]
      })?.starters_points
    ).toEqual([22.4, 18.8])
  })

  it('reads pts, live_points, and nested pointsLive as the matchup total', () => {
    expect(parseSleeperMatchup({ roster_id: 1, matchup_id: 7, pts: '41.2' })?.points).toBe(41.2)
    expect(parseSleeperMatchup({ roster_id: 1, matchup_id: 7, live_points: 18.8 })?.points).toBe(18.8)
    expect(
      parseSleeperMatchup({ roster_id: 1, matchup_id: 7, points: { pointsLive: 12.4 } })?.points
    ).toBe(12.4)
  })

  it('reads a published win_probability without treating it as points', () => {
    expect(
      parseSleeperMatchup({
        roster_id: 1,
        matchup_id: 7,
        points: 41.2,
        win_probability: 0.62
      })
    ).toMatchObject({ roster_id: 1, points: 41.2, win_probability: 0.62 })
    expect(
      parseSleeperMatchup({
        roster_id: 1,
        matchup_id: 7,
        points: 41.2,
        chance_to_win: 62
      })?.win_probability
    ).toBe(0.62)
    expect(parseSleeperMatchup({ roster_id: 1, matchup_id: 7, points: 41.2 })?.win_probability).toBeUndefined()
  })

  it('reads player_points and starter_points as players_points / starters_points', () => {
    expect(
      parseSleeperMatchup({
        roster_id: 1,
        starters: ['4046'],
        player_points: { '4046': 12.4 },
        starter_points: [12.4]
      })
    ).toMatchObject({
      players_points: { '4046': 12.4 },
      starters_points: [12.4]
    })
  })

  it('coerces numeric roster starter and player ids', () => {
    expect(
      parseSleeperRoster({
        roster_id: '2',
        owner_id: 99,
        starters: [4046, 6797],
        players: [4046, 6797, 9]
      })
    ).toMatchObject({
      roster_id: 2,
      owner_id: '99',
      starters: ['4046', '6797'],
      players: ['4046', '6797', '9']
    })
  })

  it('reads player-id keyed roster starters and players as id lists', () => {
    expect(
      parseSleeperRoster({
        roster_id: 2,
        owner_id: 'u1',
        starters: { '4046': 1, '6797': 1 },
        players: { '4046': 1, '6797': 1, '9': 1 }
      })
    ).toMatchObject({
      starters: ['4046', '6797'],
      players: ['9', '4046', '6797']
    })
  })

  it('coerces quoted Sleeper roster wins and losses', () => {
    expect(
      parseSleeperRoster({
        roster_id: 1,
        owner_id: 'u1',
        settings: { wins: '5', losses: '2', ties: '1' }
      })
    ).toMatchObject({
      roster_id: 1,
      owner_id: 'u1',
      settings: { wins: 5, losses: 2, ties: 1 }
    })
  })

  it('coerces a numeric Sleeper league user team_name', () => {
    expect(
      parseSleeperLeagueUser({
        user_id: 11,
        display_name: 7,
        metadata: { team_name: 99 }
      })
    ).toEqual({
      user_id: '11',
      display_name: '7',
      metadata: { team_name: '99' }
    })
  })
})

describe('week projections', () => {
  it('parses sleeper.app player-id maps and community array rows, dropping ADP-only keys', () => {
    expect(
      parseWeekProjections({
        '4046': { adp_dd_ppr: 12, gp: 1, pts_ppr: 17.49, pts_half_ppr: 14.32, pts_std: 11.15 },
        '6462': { adp_dd_ppr: 1000 },
        SF: { gp: 1, pts_ppr: 5.66, pts_std: 5.66 }
      })
    ).toEqual({
      '4046': { pts_ppr: 17.49, pts_half_ppr: 14.32, pts_std: 11.15 },
      SF: { pts_ppr: 5.66, pts_std: 5.66 }
    })
    expect(
      parseWeekProjections([
        { player_id: '4881', stats: { pts_ppr: 19.56, pts_half_ppr: 19.56, pts_std: 19.56 } }
      ])
    ).toEqual({ '4881': { pts_ppr: 19.56, pts_half_ppr: 19.56, pts_std: 19.56 } })
    expect(toProjectionPtsMap({ '4046': { pts_ppr: 17.49, pts_std: 11.15 } })).toEqual({ '4046': 17.49 })
    expect(toProjectionPtsMap({ '4046': { pts_ppr: 17.49, pts_std: 11.15 } }, 'std')).toEqual({ '4046': 11.15 })
  })

  it('GETs api.sleeper.app /projections/nfl/{season_type}/{season}/{week} at low priority with a 10 min bust', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ '4046': { pts_ppr: 17.4 } })
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(getWeekProjections('2026', 1, 'regular')).resolves.toEqual({
      '4046': { pts_ppr: 17.4 }
    })
    const url = fetchMock.mock.calls[0]?.[0] as string
    expect(url).toMatch(/^https:\/\/api\.sleeper\.app\/v1\/projections\/nfl\/regular\/2026\/1\?_=\d+$/)
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      signal: expect.any(AbortSignal),
      priority: 'low'
    })
    await expect(getWeekProjections('2026', 0)).resolves.toEqual({})
  })
})


describe('Sleeper league scoring kind', () => {
  it('keeps scoring_settings.rec on parsed leagues', () => {
    expect(
      parseSleeperLeague({ league_id: '1', name: 'L', season: '2026', scoring_settings: { rec: '0.5', pass_td: 4 } })
    ).toEqual({ league_id: '1', name: 'L', season: '2026', scoring_settings: { rec: 0.5 } })
    expect(parseSleeperLeague({ league_id: '1', name: 'L', season: '2026' })).toEqual({
      league_id: '1',
      name: 'L',
      season: '2026'
    })
  })

  it('snaps the reception weight to the ppr / half_ppr / std projection column', () => {
    expect(sleeperScoringKind({ scoring_settings: { rec: 1 } })).toBe('ppr')
    expect(sleeperScoringKind({ scoring_settings: { rec: 0.5 } })).toBe('half_ppr')
    expect(sleeperScoringKind({ scoring_settings: { rec: 0 } })).toBe('std')
    expect(sleeperScoringKind({ scoring_settings: {} })).toBe('std')
    expect(sleeperScoringKind({ scoring_settings: { rec: 0.25 } })).toBe('half_ppr')
    expect(sleeperScoringKind({ scoring_settings: { rec: 0.75 } })).toBe('ppr')
    expect(sleeperScoringKind({})).toBeUndefined()
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindEspnFetch, resetAppFetch } from '../http'
import { communicationUrl, fetchLeague, fetchTransactions, leagueUrl, LIVE_VIEWS, SCORE_VIEWS, SETTINGS_VIEWS, normalizeEspnCookies, weekScheduleFilter, weekTeamScheduleFilter } from './espnClient'

afterEach(() => {
  vi.unstubAllGlobals()
  resetAppFetch()
})

describe('espnClient', () => {
  it('builds the lm-api-reads league URL with the compact live view', () => {
    const url = leagueUrl('2026', '123', LIVE_VIEWS, 1)
    expect(url).toContain('lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2026/segments/0/leagues/123')
    expect(url).toContain('view=mLiveScoring')
    expect(url).not.toContain('view=mMatchupScore')
    expect(url).not.toContain('view=mTeam')
    expect(url).not.toContain('view=mBoxscore')
    expect(url).not.toContain('view=mScoreboard')
    expect(url).toContain('scoringPeriodId=1')
  })

  it('omits mLiveScoring, mTeam, mScoreboard, and mBoxscore from the cached score-only view set', () => {
    const url = leagueUrl('2026', '123', SCORE_VIEWS, 1)
    expect(url).toContain('view=mMatchupScore')
    expect(url).not.toContain('view=mLiveScoring')
    expect(url).not.toContain('view=mTeam')
    expect(url).not.toContain('view=mScoreboard')
    expect(url).not.toContain('view=mBoxscore')
    expect(url).not.toContain('view=mRoster')
    expect(url).not.toContain('view=mMatchup&')
    expect(url).not.toContain('view=mSettings')
    expect(LIVE_VIEWS).not.toEqual(SCORE_VIEWS)
  })

  it('keeps settings discovery off the live scoring views', () => {
    const url = leagueUrl('2026', '123', SETTINGS_VIEWS)
    expect(url).toContain('view=mSettings')
    expect(url).toContain('view=mStatus')
    expect(url).not.toContain('view=mTeam')
    expect(url).not.toContain('view=mScoreboard')
  })

  it('scopes transaction fetches to the scoring period', () => {
    const url = leagueUrl('2026', '123', ['mTransactions2'], 4)
    expect(url).toContain('view=mTransactions2')
    expect(url).toContain('scoringPeriodId=4')
  })

  it('filters schedule to the current scoring period', () => {
    expect(weekScheduleFilter(3)).toEqual({
      schedule: { filterMatchupPeriodIds: { value: [3] } }
    })
  })

  it('narrows the live boxscore to one team matchup', () => {
    expect(weekTeamScheduleFilter(1, 7)).toEqual({
      schedule: {
        filterMatchupPeriodIds: { value: [1] },
        filterTeamIds: { value: [7] }
      }
    })
  })

  it('hits the communication view for kona activity', () => {
    expect(communicationUrl('2026', '123')).toContain(
      '/leagues/123/communication/?view=kona_league_communication'
    )
  })

  it('does not retry a live score fetch when retries is 0', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({})
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      fetchLeague({
        season: '2026',
        leagueId: '123',
        cookies: null,
        views: SCORE_VIEWS,
        retries: 0
      })
    ).rejects.toMatchObject({ name: 'EspnHttpError', status: 500 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('defaults ESPN GETs to a 5s live budget with no retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({})
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      fetchLeague({
        season: '2026',
        leagueId: '123',
        cookies: null,
        views: SCORE_VIEWS
      })
    ).rejects.toMatchObject({ name: 'EspnHttpError', status: 500 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sends the week X-Fantasy-Filter on a live-only mLiveScoring fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ schedule: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    await fetchLeague({
      season: '2026',
      leagueId: '899513',
      cookies: null,
      views: ['mLiveScoring'],
      scoringPeriodId: 1,
      filter: weekScheduleFilter(1),
      retries: 0
    })
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }]
    expect(url).toContain('view=mLiveScoring')
    expect(url).not.toContain('view=mMatchupScore')
    expect(url).toContain('scoringPeriodId=1')
    expect(JSON.parse(init.headers['X-Fantasy-Filter'])).toEqual(weekScheduleFilter(1))
  })

  it('marks compact mLiveScoring as Chromium high priority', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ schedule: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    await fetchLeague({
      season: '2026',
      leagueId: '899513',
      cookies: null,
      views: ['mLiveScoring'],
      priority: 'high'
    })
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ priority: 'high', cache: 'no-store' })
  })

  it('marks mTransactions2 as Chromium low priority', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ transactions: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    await fetchTransactions({
      season: '2026',
      leagueId: '899513',
      cookies: null,
      scoringPeriodId: 1,
      priority: 'low'
    })
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ priority: 'low', cache: 'no-store' })
  })

  it('decodes percent-encoded ESPN cookies before the first live GET', async () => {
    expect(
      normalizeEspnCookies({
        espn_s2: 's2%2Dtoken',
        SWID: '%7B11111111-1111-1111-1111-111111111111%7D'
      })
    ).toEqual({
      espn_s2: 's2-token',
      SWID: '{11111111-1111-1111-1111-111111111111}'
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ schedule: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    await fetchLeague({
      season: '2026',
      leagueId: '899513',
      cookies: {
        espn_s2: 's2%2Dtoken',
        SWID: '%7B11111111-1111-1111-1111-111111111111%7D'
      },
      views: ['mLiveScoring'],
      retries: 0
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> }
    expect(init.headers.Cookie).toBe(
      'espn_s2=s2-token; SWID={11111111-1111-1111-1111-111111111111}'
    )
  })

  it('keeps the Cookie header on persist:espn session.fetch so lm-api-reads is not cookie-domain gated', async () => {
    const espn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ schedule: [] })
    })
    bindEspnFetch(espn)
    await fetchLeague({
      season: '2026',
      leagueId: '899513',
      cookies: {
        espn_s2: 's2-token',
        SWID: '{11111111-1111-1111-1111-111111111111}'
      },
      views: ['mLiveScoring']
    })
    expect(espn).toHaveBeenCalledTimes(1)
    expect(espn.mock.calls[0]?.[1].headers.Cookie).toBe(
      'espn_s2=s2-token; SWID={11111111-1111-1111-1111-111111111111}'
    )
  })

  it('does not fetch a non-numeric ESPN league id', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      fetchLeague({
        season: '2026',
        leagueId: 'fourth-drunken',
        cookies: null,
        retries: 0
      })
    ).rejects.toMatchObject({ name: 'EspnHttpError', status: 400 })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

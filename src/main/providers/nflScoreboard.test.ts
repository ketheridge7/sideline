import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchNflScoreboard,
  nflGamesInProgress,
  nflTickerFromPayload,
  nflScoreboardHostPlan,
  nflScoreboardState,
  NFL_SCOREBOARD_URLS,
  NFL_SCOREBOARD_TTL_MS,
  NFL_SCOREBOARD_PRE_TTL_MS,
  NFL_SCOREBOARD_TIMEOUT_MS,
  nflScoreboardTtlMs,
  nflKickoffSoon,
  nflPreKickoffs,
  nflScoreboardReachable,
  KICKOFF_LATE_MS,
  KICKOFF_SOON_MS,
  NFL_SCOREBOARD_REACHABLE_MS,
  resetNflScoreboardCache
} from './nflScoreboard'
import { cacheFresh } from '../pollTargets'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  resetNflScoreboardCache()
})

describe('nflGamesInProgress', () => {
  it('is true when any event is in progress', () => {
    expect(
      nflGamesInProgress({
        events: [
          { status: { type: { state: 'pre' } } },
          { status: { type: { state: 'in' } } }
        ]
      })
    ).toBe(true)
  })

  it('is false when the slate is pre or post', () => {
    expect(
      nflGamesInProgress({
        events: [
          { status: { type: { state: 'pre' } } },
          { status: { type: { state: 'post' } } }
        ]
      })
    ).toBe(false)
  })

  it('does not treat a full pre-kickoff Sunday slate as live', () => {
    expect(
      nflGamesInProgress({
        events: Array.from({ length: 16 }, () => ({ status: { type: { state: 'pre' } } }))
      })
    ).toBe(false)
  })

  it('reads the header API sports[].leagues[].events status string', () => {
    expect(
      nflGamesInProgress({
        sports: [
          {
            leagues: [
              {
                events: [{ shortName: 'KC @ BUF', status: 'pre' }, { shortName: 'DAL @ NYG', status: 'in' }]
              }
            ]
          }
        ]
      })
    ).toBe(true)
    expect(
      nflGamesInProgress({
        sports: [{ leagues: [{ events: [{ status: 'pre' }, { status: 'post' }] }] }]
      })
    ).toBe(false)
  })

  it('is false on junk payloads', () => {
    expect(nflGamesInProgress(null)).toBe(false)
    expect(nflGamesInProgress({})).toBe(false)
  })
})

describe('nflTickerFromPayload', () => {
  it('reads in-progress and final games from the site v2 scoreboard', () => {
    const ticker = nflTickerFromPayload({
      events: [
        {
          id: 'pre-1',
          status: { type: { state: 'pre' } },
          competitions: [
            {
              competitors: [
                { homeAway: 'away', score: '0', team: { abbreviation: 'KC' } },
                { homeAway: 'home', score: '0', team: { abbreviation: 'LAC' } }
              ]
            }
          ]
        },
        {
          id: 'live-1',
          status: { type: { state: 'in', shortDetail: 'Q2 4:12' } },
          competitions: [
            {
              competitors: [
                { homeAway: 'away', score: '14', team: { abbreviation: 'DET' } },
                { homeAway: 'home', score: '21', team: { abbreviation: 'KC' } }
              ]
            }
          ]
        },
        {
          id: 'final-1',
          status: { type: { state: 'post' } },
          competitions: [
            {
              competitors: [
                { homeAway: 'away', score: '28', team: { abbreviation: 'DAL' } },
                { homeAway: 'home', score: '14', team: { abbreviation: 'NYG' } }
              ]
            }
          ]
        }
      ]
    })
    expect(ticker).toEqual([
      { id: 'live-1', away: 'DET', awayScore: 14, home: 'KC', homeScore: 21, clock: 'Q2 4:12' },
      { id: 'final-1', away: 'DAL', awayScore: 28, home: 'NYG', homeScore: 14, clock: 'FINAL', final: true }
    ])
  })

  it('coerces a numeric ESPN event id so ticker rows keep a stable id', () => {
    const ticker = nflTickerFromPayload({
      events: [
        {
          id: 401547390,
          status: { type: { state: 'in', shortDetail: 'Q2 4:12' } },
          competitions: [
            {
              competitors: [
                { homeAway: 'away', score: '14', team: { abbreviation: 'DET' } },
                { homeAway: 'home', score: '21', team: { abbreviation: 'KC' } }
              ]
            }
          ]
        }
      ]
    })
    expect(ticker[0]?.id).toBe('401547390')
  })

  it('reads header-API events that put competitors on the event', () => {
    const ticker = nflTickerFromPayload({
      sports: [
        {
          leagues: [
            {
              events: [
                {
                  id: 'hdr-1',
                  status: 'in',
                  competitors: [
                    { abbreviation: 'BUF', homeAway: 'away', score: '31' },
                    { abbreviation: 'MIA', homeAway: 'home', score: '10' }
                  ]
                }
              ]
            }
          ]
        }
      ]
    })
    expect(ticker).toEqual([
      { id: 'hdr-1', away: 'BUF', awayScore: 31, home: 'MIA', homeScore: 10, clock: 'LIVE' }
    ])
  })
})

describe('fetchNflScoreboard', () => {
  it('tries the working site.web.api host first', () => {
    expect(NFL_SCOREBOARD_URLS[0]).toContain('site.web.api.espn.com/apis/site/v2')
  })

  it('falls over from a 403 to the next host', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ events: [{ status: { type: { state: 'in' } } }] })
      })
    vi.stubGlobal('fetch', fetchMock)
    const payload = await fetchNflScoreboard()
    expect(nflGamesInProgress(payload)).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('tries the last successful host first so a hung primary cannot 2s-block every tick', async () => {
    const ok = {
      ok: true,
      status: 200,
      json: async () => ({ events: [{ status: { type: { state: 'in' } } }] })
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) })
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce(ok)
    vi.stubGlobal('fetch', fetchMock)
    await fetchNflScoreboard()
    await fetchNflScoreboard()
    expect(fetchMock.mock.calls[0]?.[0]).toBe(NFL_SCOREBOARD_URLS[0])
    expect(fetchMock.mock.calls[1]?.[0]).toBe(NFL_SCOREBOARD_URLS[1])
    expect(fetchMock.mock.calls[2]?.[0]).toBe(NFL_SCOREBOARD_URLS[1])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not walk remaining hosts on a live tick when last-good already failed', async () => {
    const ok = {
      ok: true,
      status: 200,
      json: async () => ({ events: [{ status: { type: { state: 'in' } } }] })
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) })
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    await fetchNflScoreboard()
    await expect(fetchNflScoreboard(true)).rejects.toMatchObject({ status: 403 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[2]?.[0]).toBe(NFL_SCOREBOARD_URLS[1])
  })
})

describe('nflScoreboardHostPlan', () => {
  it('tries every host until a live tick has a sticky host or ticker cache', () => {
    expect(
      nflScoreboardHostPlan({ liveTick: false, hasStickyHost: true, hasCache: true })
    ).toBe('all-hosts')
    expect(
      nflScoreboardHostPlan({ liveTick: true, hasStickyHost: false, hasCache: false })
    ).toBe('all-hosts')
    expect(
      nflScoreboardHostPlan({ liveTick: true, hasStickyHost: true, hasCache: false })
    ).toBe('one-host')
    expect(
      nflScoreboardHostPlan({ liveTick: true, hasStickyHost: false, hasCache: true })
    ).toBe('one-host')
  })
})

describe('nflScoreboardState', () => {
  it('maps an in-progress slate to live ticker state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          events: [
            {
              id: 'live-1',
              status: { type: { state: 'in', shortDetail: 'Q2 4:12' } },
              competitions: [
                {
                  competitors: [
                    { homeAway: 'away', score: '14', team: { abbreviation: 'DET' } },
                    { homeAway: 'home', score: '21', team: { abbreviation: 'KC' } }
                  ]
                }
              ]
            }
          ]
        })
      })
    )
    await expect(nflScoreboardState(false)).resolves.toEqual({
      live: true,
      reachable: true,
      ticker: [
        { id: 'live-1', away: 'DET', awayScore: 14, home: 'KC', homeScore: 21, clock: 'Q2 4:12' }
      ]
    })
  })

  it('falls back to the calendar live flag when every host fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) })
    )
    await expect(nflScoreboardState(true)).resolves.toEqual({ live: true, ticker: [], reachable: false })
    await expect(nflScoreboardState(false)).resolves.toEqual({ live: false, ticker: [], reachable: false })
    expect(nflScoreboardReachable()).toBe(false)
  })

  const preSlate = (kickoffIso: string) => ({
    ok: true,
    status: 200,
    json: async () => ({
      events: [{ id: 'pre-1', date: kickoffIso, status: { type: { state: 'pre' } } }]
    })
  })

  it('stays idle in the calendar window when the next kickoff is hours away', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-13T13:00:00Z'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(preSlate('2026-09-13T17:00Z')))
    await expect(nflScoreboardState(true)).resolves.toEqual({ live: false, ticker: [], reachable: true })
    expect(nflScoreboardReachable()).toBe(true)
    vi.useRealTimers()
  })

  it('goes live about ten minutes before kickoff, re-evaluated from the cached kickoff time', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-13T16:45:00Z'))
    const fetchMock = vi.fn().mockResolvedValue(preSlate('2026-09-13T17:00Z'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(nflScoreboardState(false)).resolves.toMatchObject({ live: false })
    vi.setSystemTime(new Date('2026-09-13T16:50:00Z'))
    await expect(nflScoreboardState(false)).resolves.toMatchObject({ live: true })
    vi.useRealTimers()
  })

  it('keeps a weather-delayed pre game live after its scheduled kickoff', () => {
    const kickoff = Date.parse('2026-09-13T17:00Z')
    expect(nflKickoffSoon([kickoff], kickoff - KICKOFF_SOON_MS - 1)).toBe(false)
    expect(nflKickoffSoon([kickoff], kickoff - KICKOFF_SOON_MS)).toBe(true)
    expect(nflKickoffSoon([kickoff], kickoff + 60 * 60_000)).toBe(true)
    expect(nflKickoffSoon([kickoff], kickoff + KICKOFF_LATE_MS + 1)).toBe(false)
  })

  it('reads kickoff times from event.date or the first competition', () => {
    expect(
      nflPreKickoffs({
        events: [
          { date: '2026-09-13T17:00Z', status: { type: { state: 'pre' } } },
          { status: { type: { state: 'pre' } }, competitions: [{ date: '2026-09-13T20:25Z' }] },
          { date: '2026-09-13T13:30Z', status: { type: { state: 'in' } } }
        ]
      })
    ).toEqual([Date.parse('2026-09-13T17:00Z'), Date.parse('2026-09-13T20:25Z')])
    expect(
      nflPreKickoffs({ sports: [{ leagues: [{ events: [{ date: '2026-09-14T00:20Z', status: 'pre' }] }] }] })
    ).toEqual([Date.parse('2026-09-14T00:20Z')])
  })

  it('keeps the cached slate briefly after a failed refresh, then falls back to the calendar', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-13T13:00:00Z'))
    const fetchMock = vi.fn().mockResolvedValue(preSlate('2026-09-13T17:00Z'))
    vi.stubGlobal('fetch', fetchMock)
    await nflScoreboardState(true)
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })
    vi.advanceTimersByTime(NFL_SCOREBOARD_PRE_TTL_MS)
    await expect(nflScoreboardState(true)).resolves.toEqual({ live: false, ticker: [], reachable: true })
    vi.advanceTimersByTime(NFL_SCOREBOARD_REACHABLE_MS)
    await expect(nflScoreboardState(true)).resolves.toEqual({ live: true, ticker: [], reachable: false })
    vi.useRealTimers()
  })

  it('reuses a fresh scoreboard so a 3s scoring tick does not re-download 251KB', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ events: [{ status: { type: { state: 'in' } } }] })
    })
    vi.stubGlobal('fetch', fetchMock)
    const first = await nflScoreboardState(false)
    const second = await nflScoreboardState(false)
    expect(first).toEqual(second)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(cacheFresh(0, NFL_SCOREBOARD_TTL_MS - 1, NFL_SCOREBOARD_TTL_MS)).toBe(true)
    expect(cacheFresh(0, NFL_SCOREBOARD_TTL_MS, NFL_SCOREBOARD_TTL_MS)).toBe(false)
    vi.advanceTimersByTime(NFL_SCOREBOARD_TTL_MS)
    await nflScoreboardState(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('holds a pre slate at the idle interval so Sunday morning cannot re-download 251KB every 10s', async () => {
    expect(nflScoreboardTtlMs(true)).toBe(NFL_SCOREBOARD_TTL_MS)
    expect(nflScoreboardTtlMs(false)).toBe(NFL_SCOREBOARD_PRE_TTL_MS)
    expect(NFL_SCOREBOARD_PRE_TTL_MS).toBe(30_000)
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ events: [{ status: { type: { state: 'pre' } } }] })
    })
    vi.stubGlobal('fetch', fetchMock)
    await nflScoreboardState(true)
    vi.advanceTimersByTime(NFL_SCOREBOARD_TTL_MS)
    await nflScoreboardState(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(NFL_SCOREBOARD_PRE_TTL_MS - NFL_SCOREBOARD_TTL_MS)
    await nflScoreboardState(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('downloads the 251KB scoreboard as Chromium low priority with a 2s host budget', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ events: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    await fetchNflScoreboard()
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ priority: 'low', cache: 'no-store' })
    expect(timeoutSpy).toHaveBeenCalledWith(NFL_SCOREBOARD_TIMEOUT_MS)
    expect(NFL_SCOREBOARD_TIMEOUT_MS).toBe(2_000)
    timeoutSpy.mockRestore()
  })
})

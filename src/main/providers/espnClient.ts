import { fetchJson, HttpError, type FetchPriority } from '../http'

export type EspnCookies = {
  espn_s2: string
  SWID: string
}

export type EspnFantasyFilter = Record<string, unknown>

export class EspnHttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'EspnHttpError'
  }
}

const READ_HOST = 'https://lm-api-reads.fantasy.espn.com'
const FAN_HOST = 'https://fan.api.espn.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export const normalizeEspnCookies = (cookies: EspnCookies): EspnCookies => ({
  espn_s2: safeDecode(cookies.espn_s2),
  SWID: safeDecode(cookies.SWID)
})

export type EspnCookieRow = {
  name: string
  value: string
  domain?: string
}

const cookieDomainScore = (domain: string | undefined): number => {
  const host = (domain ?? '').replace(/^\./, '').toLowerCase()
  if (host.includes('fantasy.espn.com') || host.includes('lm-api-reads')) return 3
  if (host === 'espn.com' || host.endsWith('.espn.com')) return 2
  if (host.includes('espn')) return 1
  return 0
}

const bestCookie = (rows: EspnCookieRow[]): EspnCookieRow | undefined => {
  if (rows.length === 0) return undefined
  return [...rows].sort((left, right) => {
    const byDomain = cookieDomainScore(right.domain) - cookieDomainScore(left.domain)
    if (byDomain !== 0) return byDomain
    return right.value.length - left.value.length
  })[0]
}

/** Prefer fantasy.espn.com / longer espn_s2 so a leftover www.espn.com name cannot win the session. */
export const pickEspnCookies = (cookies: EspnCookieRow[]): EspnCookies | null => {
  const espnS2 = bestCookie(cookies.filter((row) => row.name === 'espn_s2' && row.value.trim() !== ''))
  const swid = bestCookie(cookies.filter((row) => row.name === 'SWID' && row.value.trim() !== ''))
  if (!espnS2 || !swid) return null
  return normalizeEspnCookies({ espn_s2: espnS2.value, SWID: swid.value })
}

const cookieHeader = (cookies: EspnCookies): string =>
  `espn_s2=${cookies.espn_s2}; SWID=${cookies.SWID}`

type FetchOpts = {
  url: string
  cookies: EspnCookies | null
  filter?: EspnFantasyFilter
  timeoutMs?: number
  retries?: number
  priority?: FetchPriority
}

const headersFor = (opts: FetchOpts): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': USER_AGENT
  }
  if (opts.cookies) headers.Cookie = cookieHeader(opts.cookies)
  if (opts.filter) headers['X-Fantasy-Filter'] = JSON.stringify(opts.filter)
  return headers
}

const fetchEspn = async (opts: FetchOpts): Promise<unknown> => {
  const request = (cookies: EspnCookies | null): Promise<unknown> =>
    fetchJson({
      url: opts.url,
      headers: headersFor({ ...opts, cookies }),
      timeoutMs: opts.timeoutMs ?? 5_000,
      retries: opts.retries ?? 0,
      priority: opts.priority,
      useEspnSession: true
    })

  const normalized = opts.cookies ? normalizeEspnCookies(opts.cookies) : null
  try {
    return await request(normalized)
  } catch (error) {
    if (error instanceof HttpError && error.status === 401 && opts.cookies && normalized) {
      const sameSession =
        opts.cookies.espn_s2 === normalized.espn_s2 && opts.cookies.SWID === normalized.SWID
      if (!sameSession) {
        try {
          return await request(opts.cookies)
        } catch (retryError) {
          if (retryError instanceof HttpError) {
            throw new EspnHttpError(retryError.status, `ESPN ${opts.url} failed (${retryError.status})`)
          }
          throw retryError
        }
      }
    }
    if (error instanceof HttpError) {
      throw new EspnHttpError(error.status, `ESPN ${opts.url} failed (${error.status})`)
    }
    throw error
  }
}

export const isEspnLeagueId = (id: string): boolean => /^\d+$/.test(id)

export const leagueUrl = (season: string, leagueId: string, views: string[], scoringPeriodId?: number): string => {
  const url = new URL(
    `${READ_HOST}/apis/v3/games/ffl/seasons/${encodeURIComponent(season)}/segments/0/leagues/${encodeURIComponent(leagueId)}`
  )
  for (const view of views) {
    url.searchParams.append('view', view)
  }
  if (scoringPeriodId != null) {
    url.searchParams.set('scoringPeriodId', String(scoringPeriodId))
  }
  return url.toString()
}

export const DISCOVERY_VIEWS = ['mSettings', 'mStatus', 'mTeam']

export const SETTINGS_VIEWS = ['mSettings', 'mStatus']

/** mMatchupScore alone now ships stats-only roster rows (no playerId/name). mScoreboard fills identity. */
export const SCORE_VIEWS = ['mMatchupScore', 'mScoreboard']

export const LIVE_VIEWS = ['mLiveScoring']

/** `matchupPeriodId` is ESPN's matchup period, not the NFL week — they diverge in multi-week playoff rounds. */
export const weekScheduleFilter = (matchupPeriodId: number): EspnFantasyFilter => ({
  schedule: { filterMatchupPeriodIds: { value: [matchupPeriodId] } }
})

export const weekTeamScheduleFilter = (
  matchupPeriodId: number,
  teamId: number
): EspnFantasyFilter => ({
  schedule: {
    filterMatchupPeriodIds: { value: [matchupPeriodId] },
    filterTeamIds: { value: [teamId] }
  }
})

export const ACTIVITY_FILTER: EspnFantasyFilter = {
  topics: {
    filterType: { value: ['ACTIVITY_TRANSACTIONS'] },
    limit: 25,
    limitPerMessageSet: { value: 25 },
    sortMessageDate: { sortPriority: 1, sortAsc: false }
  }
}

export const communicationUrl = (season: string, leagueId: string): string =>
  `${READ_HOST}/apis/v3/games/ffl/seasons/${encodeURIComponent(season)}/segments/0/leagues/${encodeURIComponent(leagueId)}/communication/?view=kona_league_communication`

const rejectLeagueId = (leagueId: string): Promise<never> =>
  Promise.reject(new EspnHttpError(400, `ESPN league ${leagueId} is not a live id`))

export const fetchLeague = (args: {
  season: string
  leagueId: string
  cookies: EspnCookies | null
  views?: string[]
  scoringPeriodId?: number
  filter?: EspnFantasyFilter
  timeoutMs?: number
  retries?: number
  priority?: FetchPriority
}): Promise<unknown> => {
  if (!isEspnLeagueId(args.leagueId)) return rejectLeagueId(args.leagueId)
  return fetchEspn({
    url: leagueUrl(args.season, args.leagueId, args.views ?? SCORE_VIEWS, args.scoringPeriodId),
    cookies: args.cookies,
    filter: args.filter,
    timeoutMs: args.timeoutMs,
    retries: args.retries,
    priority: args.priority
  })
}

export const fetchTransactions = (args: {
  season: string
  leagueId: string
  cookies: EspnCookies | null
  scoringPeriodId?: number
  timeoutMs?: number
  retries?: number
  priority?: FetchPriority
}): Promise<unknown> => {
  if (!isEspnLeagueId(args.leagueId)) return rejectLeagueId(args.leagueId)
  return fetchEspn({
    url: leagueUrl(args.season, args.leagueId, ['mTransactions2'], args.scoringPeriodId),
    cookies: args.cookies,
    timeoutMs: args.timeoutMs,
    retries: args.retries,
    priority: args.priority
  })
}

export const fetchActivity = (args: {
  season: string
  leagueId: string
  cookies: EspnCookies
  timeoutMs?: number
  retries?: number
  priority?: FetchPriority
}): Promise<unknown> => {
  if (!isEspnLeagueId(args.leagueId)) return rejectLeagueId(args.leagueId)
  return fetchEspn({
    url: communicationUrl(args.season, args.leagueId),
    cookies: args.cookies,
    filter: ACTIVITY_FILTER,
    timeoutMs: args.timeoutMs,
    retries: args.retries,
    priority: args.priority
  })
}

export const probeFanLeagues = async (
  cookies: EspnCookies,
  opts?: { timeoutMs?: number; retries?: number; priority?: FetchPriority }
): Promise<unknown> => {
  const encoded = encodeURIComponent(cookies.SWID)
  return fetchEspn({
    url: `${FAN_HOST}/apis/v2/fans/${encoded}`,
    cookies,
    timeoutMs: opts?.timeoutMs,
    retries: opts?.retries,
    priority: opts?.priority
  })
}

export type EspnCookies = {
  espn_s2: string
  SWID: string
}

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

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const cookieHeader = (cookies: EspnCookies): string =>
  `espn_s2=${cookies.espn_s2}; SWID=${cookies.SWID}`

type FetchOpts = {
  url: string
  cookies: EspnCookies | null
}

const fetchOnce = async (opts: FetchOpts): Promise<Response> => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': USER_AGENT
  }
  if (opts.cookies) headers.Cookie = cookieHeader(opts.cookies)
  return fetch(opts.url, { headers })
}

const fetchEspn = async (opts: FetchOpts): Promise<unknown> => {
  let res = await fetchOnce(opts)
  if (res.status === 401 && opts.cookies) {
    res = await fetchOnce({
      url: opts.url,
      cookies: { ...opts.cookies, espn_s2: safeDecode(opts.cookies.espn_s2) }
    })
  }
  if (res.status === 429) {
    await sleep(1500)
    res = await fetchOnce(opts)
  }
  if (!res.ok) {
    throw new EspnHttpError(res.status, `ESPN ${opts.url} failed (${res.status})`)
  }
  return res.json()
}

export const leagueUrl = (season: string, leagueId: string, views: string[], scoringPeriodId?: number): string => {
  const url = new URL(`${READ_HOST}/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}`)
  for (const view of views) {
    url.searchParams.append('view', view)
  }
  if (scoringPeriodId != null) {
    url.searchParams.set('scoringPeriodId', String(scoringPeriodId))
  }
  return url.toString()
}

export const MATCHUP_VIEWS = [
  'mTeam',
  'mRoster',
  'mMatchup',
  'mMatchupScore',
  'mLiveScoring',
  'mSettings',
  'mStatus'
]

export const fetchLeague = (args: {
  season: string
  leagueId: string
  cookies: EspnCookies | null
  views?: string[]
  scoringPeriodId?: number
}): Promise<unknown> => {
  return fetchEspn({
    url: leagueUrl(args.season, args.leagueId, args.views ?? MATCHUP_VIEWS, args.scoringPeriodId),
    cookies: args.cookies
  })
}

export const fetchTransactions = (args: {
  season: string
  leagueId: string
  cookies: EspnCookies | null
}): Promise<unknown> => {
  return fetchEspn({
    url: leagueUrl(args.season, args.leagueId, ['mTransactions2']),
    cookies: args.cookies
  })
}

export const probeFanLeagues = async (cookies: EspnCookies): Promise<unknown> => {
  const encoded = encodeURIComponent(cookies.SWID)
  return fetchEspn({
    url: `${FAN_HOST}/apis/v2/fans/${encoded}`,
    cookies
  })
}

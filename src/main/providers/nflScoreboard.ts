import type { NflTickerGame } from '@shared/types'
import { fetchJson } from '../http'
import { IDLE_POLL_MS } from '../liveWindow'
import { cacheFresh, scoreboardPollLive } from '../pollTargets'

export const NFL_SCOREBOARD_TTL_MS = 10_000
export const NFL_SCOREBOARD_PRE_TTL_MS = IDLE_POLL_MS
export const NFL_SCOREBOARD_TIMEOUT_MS = 2_000

/** A game `pre` whose kickoff is this close counts as live so the 3s cadence is armed at kickoff. */
export const KICKOFF_SOON_MS = 10 * 60_000
/** A `pre` game this far past its scheduled kickoff (weather delay) still counts as imminent. */
export const KICKOFF_LATE_MS = 4 * 60 * 60_000
/** A scoreboard older than this after failed refreshes is unreachable — fall back to the calendar window. */
export const NFL_SCOREBOARD_REACHABLE_MS = 5 * 60_000

export const nflScoreboardTtlMs = (gamesInProgress: boolean): number =>
  gamesInProgress ? NFL_SCOREBOARD_TTL_MS : NFL_SCOREBOARD_PRE_TTL_MS

let scoreboardCache: { at: number; gamesIn: boolean; kickoffs: number[]; ticker: NflTickerGame[] } | null = null
let lastGoodScoreboardUrl: string | null = null

export const nflScoreboardReachable = (now = Date.now()): boolean =>
  scoreboardCache != null && cacheFresh(scoreboardCache.at, now, NFL_SCOREBOARD_REACHABLE_MS)

export const resetNflScoreboardCache = (): void => {
  scoreboardCache = null
  lastGoodScoreboardUrl = null
}

export const NFL_SCOREBOARD_URLS = [
  'https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  'https://site.web.api.espn.com/apis/v2/scoreboard/header?sport=football&league=nfl',
  'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const eventState = (event: Record<string, unknown>): string | undefined => {
  const status = event.status
  if (typeof status === 'string') return status
  if (!isRecord(status)) return undefined
  const type = isRecord(status.type) ? status.type : null
  const state = type?.state ?? status.state
  return typeof state === 'string' ? state : undefined
}

const collectEvents = (payload: unknown): Record<string, unknown>[] => {
  if (!isRecord(payload)) return []
  if (Array.isArray(payload.events)) return payload.events.filter(isRecord)
  const sports = Array.isArray(payload.sports) ? payload.sports : []
  const events: Record<string, unknown>[] = []
  for (const sport of sports) {
    if (!isRecord(sport)) continue
    for (const league of Array.isArray(sport.leagues) ? sport.leagues : []) {
      if (!isRecord(league)) continue
      for (const event of Array.isArray(league.events) ? league.events : []) {
        if (isRecord(event)) events.push(event)
      }
    }
  }
  return events
}

const str = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim() !== '') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

const num = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

const competitorAbbr = (row: Record<string, unknown>): string => {
  const direct = str(row.abbreviation)
  if (direct) return direct
  const team = isRecord(row.team) ? row.team : null
  return str(team?.abbreviation) || str(team?.shortDisplayName) || ''
}

const competitorScore = (row: Record<string, unknown>): number => num(row.score) ?? 0

const isHomeCompetitor = (row: Record<string, unknown>): boolean =>
  row.homeAway === 'home' || row.isHome === true

const competitorsOf = (event: Record<string, unknown>): Record<string, unknown>[] => {
  if (Array.isArray(event.competitors)) return event.competitors.filter(isRecord)
  const competitions = Array.isArray(event.competitions) ? event.competitions : []
  const first = competitions.find(isRecord)
  if (first && Array.isArray(first.competitors)) return first.competitors.filter(isRecord)
  return []
}

const clockOf = (event: Record<string, unknown>): { clock: string; final?: boolean } => {
  const state = eventState(event)
  if (state === 'post') return { clock: 'FINAL', final: true }
  const status = event.status
  if (isRecord(status)) {
    const type = isRecord(status.type) ? status.type : null
    const shortDetail = str(type?.shortDetail) || str(status.shortDetail) || str(type?.detail)
    if (shortDetail) return { clock: shortDetail }
    const displayClock = str(status.displayClock)
    const period = num(status.period)
    if (displayClock && period != null) return { clock: `Q${period} ${displayClock}` }
    if (displayClock) return { clock: displayClock }
  }
  return { clock: state === 'in' ? 'LIVE' : '' }
}

export const nflTickerFromPayload = (payload: unknown): NflTickerGame[] => {
  const out: NflTickerGame[] = []
  for (const event of collectEvents(payload)) {
    const state = eventState(event)
    if (state === 'pre' || !state) continue
    const competitors = competitorsOf(event)
    const home = competitors.find(isHomeCompetitor) ?? competitors[1]
    const away = competitors.find((row) => !isHomeCompetitor(row)) ?? competitors[0]
    if (!home || !away) continue
    const homeAbbr = competitorAbbr(home)
    const awayAbbr = competitorAbbr(away)
    if (!homeAbbr || !awayAbbr) continue
    const { clock, final } = clockOf(event)
    out.push({
      id: str(event.id) || `${awayAbbr}-${homeAbbr}`,
      away: awayAbbr,
      awayScore: competitorScore(away),
      home: homeAbbr,
      homeScore: competitorScore(home),
      clock,
      final
    })
  }
  return out
}

export const nflGamesInProgress = (payload: unknown): boolean =>
  collectEvents(payload).some((event) => eventState(event) === 'in')

const eventKickoffMs = (event: Record<string, unknown>): number | undefined => {
  const competitions = Array.isArray(event.competitions) ? event.competitions : []
  const first = competitions.find(isRecord)
  const raw = str(event.date) ?? str(first?.date)
  const ms = raw ? Date.parse(raw) : Number.NaN
  return Number.isFinite(ms) ? ms : undefined
}

/** Scheduled kickoff times (epoch ms) of events still `pre`. */
export const nflPreKickoffs = (payload: unknown): number[] => {
  const out: number[] = []
  for (const event of collectEvents(payload)) {
    if (eventState(event) !== 'pre') continue
    const at = eventKickoffMs(event)
    if (at != null) out.push(at)
  }
  return out
}

export const nflKickoffSoon = (kickoffs: readonly number[], now: number, windowMs = KICKOFF_SOON_MS): boolean =>
  kickoffs.some((at) => at - now <= windowMs && now - at <= KICKOFF_LATE_MS)

/** Live ticks with a sticky host or last ticker try one host only so a 403/timeout cannot walk 251KB×2 beside HUD. */
export const nflScoreboardHostPlan = (opts: {
  liveTick: boolean
  hasStickyHost: boolean
  hasCache: boolean
}): 'one-host' | 'all-hosts' => {
  if (!opts.liveTick) return 'all-hosts'
  if (opts.hasStickyHost || opts.hasCache) return 'one-host'
  return 'all-hosts'
}

const scoreboardHostOrder = (): string[] => {
  if (!lastGoodScoreboardUrl || lastGoodScoreboardUrl === NFL_SCOREBOARD_URLS[0]) {
    return NFL_SCOREBOARD_URLS
  }
  if (!NFL_SCOREBOARD_URLS.includes(lastGoodScoreboardUrl)) return NFL_SCOREBOARD_URLS
  return [lastGoodScoreboardUrl, ...NFL_SCOREBOARD_URLS.filter((url) => url !== lastGoodScoreboardUrl)]
}

export const fetchNflScoreboard = async (liveTick = false): Promise<unknown> => {
  const plan = nflScoreboardHostPlan({
    liveTick,
    hasStickyHost: lastGoodScoreboardUrl != null,
    hasCache: scoreboardCache != null
  })
  const hosts =
    plan === 'one-host' ? scoreboardHostOrder().slice(0, 1) : scoreboardHostOrder()
  let lastError: unknown
  for (const url of hosts) {
    try {
      const payload = await fetchJson({
        url,
        headers: { Accept: 'application/json' },
        timeoutMs: NFL_SCOREBOARD_TIMEOUT_MS,
        retries: 0,
        priority: 'low',
        // Two scoreboard endpoints share site.web.api; back off per endpoint so the header API stays a fallback.
        backoffKey: url
      })
      lastGoodScoreboardUrl = url
      return payload
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('NFL scoreboard failed')
}

export type NflScoreboardState = {
  /** Poll at the live cadence: a game is `in` or kicks off soon; calendar window only when unreachable. */
  live: boolean
  ticker: NflTickerGame[]
  reachable: boolean
}

const fromCache = (
  cache: NonNullable<typeof scoreboardCache>,
  now: number,
  calendarLive: boolean
): NflScoreboardState => ({
  live: scoreboardPollLive({
    gamesIn: cache.gamesIn,
    kickoffSoon: nflKickoffSoon(cache.kickoffs, now),
    reachable: true,
    calendarLive
  }),
  ticker: cache.ticker,
  reachable: true
})

/** `calendarLive` is the raw calendar window; it only decides cadence when the scoreboard is unreachable. */
export const nflScoreboardState = async (
  calendarLive: boolean,
  liveTick = false
): Promise<NflScoreboardState> => {
  const now = Date.now()
  const ttlMs = scoreboardCache
    ? nflScoreboardTtlMs(scoreboardCache.gamesIn || nflKickoffSoon(scoreboardCache.kickoffs, now))
    : NFL_SCOREBOARD_TTL_MS
  if (scoreboardCache && cacheFresh(scoreboardCache.at, now, ttlMs)) {
    return fromCache(scoreboardCache, now, calendarLive)
  }
  try {
    const payload = await fetchNflScoreboard(liveTick)
    scoreboardCache = {
      at: Date.now(),
      gamesIn: nflGamesInProgress(payload),
      kickoffs: nflPreKickoffs(payload),
      ticker: nflTickerFromPayload(payload)
    }
    return fromCache(scoreboardCache, Date.now(), calendarLive)
  } catch {
    if (scoreboardCache && nflScoreboardReachable(Date.now())) {
      return fromCache(scoreboardCache, Date.now(), calendarLive)
    }
    return {
      live: scoreboardPollLive({ gamesIn: false, kickoffSoon: false, reachable: false, calendarLive }),
      ticker: scoreboardCache?.ticker ?? [],
      reachable: false
    }
  }
}

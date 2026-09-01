import type { NflTickerGame } from '@shared/types'
import { fetchJson } from '../http'
import { IDLE_POLL_MS } from '../liveWindow'
import { cacheFresh } from '../pollTargets'

export const NFL_SCOREBOARD_TTL_MS = 10_000
export const NFL_SCOREBOARD_PRE_TTL_MS = IDLE_POLL_MS
export const NFL_SCOREBOARD_TIMEOUT_MS = 2_000

export const nflScoreboardTtlMs = (gamesInProgress: boolean): number =>
  gamesInProgress ? NFL_SCOREBOARD_TTL_MS : NFL_SCOREBOARD_PRE_TTL_MS

let scoreboardCache: { at: number; live: boolean; ticker: NflTickerGame[] } | null = null
let lastGoodScoreboardUrl: string | null = null

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
        priority: 'low'
      })
      lastGoodScoreboardUrl = url
      return payload
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('NFL scoreboard failed')
}

export const nflScoreboardState = async (
  calendarLive: boolean,
  liveTick = false
): Promise<{ live: boolean; ticker: NflTickerGame[] }> => {
  const ttlMs = scoreboardCache
    ? nflScoreboardTtlMs(scoreboardCache.live)
    : NFL_SCOREBOARD_TTL_MS
  if (scoreboardCache && cacheFresh(scoreboardCache.at, Date.now(), ttlMs)) {
    return { live: scoreboardCache.live, ticker: scoreboardCache.ticker }
  }
  try {
    const payload = await fetchNflScoreboard(liveTick)
    const next = { live: nflGamesInProgress(payload), ticker: nflTickerFromPayload(payload) }
    scoreboardCache = { at: Date.now(), ...next }
    return next
  } catch {
    if (scoreboardCache) return { live: scoreboardCache.live, ticker: scoreboardCache.ticker }
    return { live: calendarLive, ticker: [] }
  }
}

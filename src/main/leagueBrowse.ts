import type { LeagueBoardSnapshot, LeaguePair, NflTickerGame, Provider } from '@shared/types'
import { IDLE_POLL_MS, LIVE_POLL_MS } from './liveWindow'
import { EspnHttpError, weekScheduleFilter, type EspnFantasyFilter } from './providers/espnClient'
import {
  espnLivePayloadIsStub,
  overlayLiveScoring,
  toEspnLeaguePairs,
  type EspnMatchupPeriod
} from './providers/espnAdapter'
import type { SleeperMatchup } from './providers/sleeperClient'
import { sleeperMatchupWeek } from './providers/sleeperAdapter'
import { HttpBackoffError, HttpError } from './http'

/**
 * League-wide scoreboard for the companion League view.
 * This module does not read or write selectedLeagueKey, lastState.matchup,
 * matchupCache, or the HUD ESPN score cache, and it does not publish AppState.
 */

export type LeagueBrowseKind = 'boxscore' | 'compact'

/** Replay-only board fixture for visual checks. Unset during a normal replay. */
const replayBoardFixture = (): 'loading' | 'error' | null => {
  const raw = process.env.SIDELINE_REPLAY_BOARD
  if (raw === 'loading' || raw === 'error') return raw
  return null
}

export type LeagueBrowseContext = {
  leagueKey: string
  leagueName: string
  provider: Provider
  leagueId: string
  season: string
  week: number
  matchupPeriod: EspnMatchupPeriod
  pollingLive: boolean
  replay: boolean
  ticker: readonly NflTickerGame[]
  /** NFL teams with a game this week, including pre-kickoff. Empty when the scoreboard has not landed. */
  slate?: readonly string[]
}

export type LeagueBrowseHost = {
  now: () => number
  context: () => LeagueBrowseContext | null
  publish: (snapshot: LeagueBoardSnapshot) => void
  fetchEspn: (args: {
    season: string
    leagueId: string
    week: number
    kind: LeagueBrowseKind
  }) => Promise<unknown>
  sleeperBuild: (leagueId: string, week: number, rows: SleeperMatchup[]) => LeaguePair[] | null
  replayPairs: (leagueKey: string) => LeaguePair[]
  espnTeams: (leagueId: string) => Record<string, unknown>[]
  myEspnTeamId: (leagueId: string) => number | undefined
}

type Scheduler = (fn: () => void, ms: number) => { cancel: () => void }

const defaultSchedule: Scheduler = (fn, ms) => {
  const id = setTimeout(fn, ms)
  return { cancel: () => clearTimeout(id) }
}

/**
 * Week-wide ESPN read. No `filterTeamIds`, so it cannot join the HUD boxscore.
 * `mRoster` supplies lineup slots and pro teams when `mMatchupScore` rows are stats-only.
 */
export const espnBrowseFetchArgs = (
  kind: LeagueBrowseKind,
  matchupPeriodId: number
): {
  views: ['mMatchupScore', 'mRoster'] | ['mLiveScoring']
  filter: EspnFantasyFilter
  timeoutMs: number
  retries: 0
  priority: 'low'
} => ({
  views: kind === 'boxscore' ? ['mMatchupScore', 'mRoster'] : ['mLiveScoring'],
  filter: weekScheduleFilter(matchupPeriodId),
  timeoutMs: LIVE_POLL_MS,
  retries: 0,
  priority: 'low'
})

export const espnLeagueAllCacheKey = (leagueId: string, week: number): string => `${leagueId}:${week}:all`

/**
 * Sleeper matchups are stored under `leg` once the NFL week runs ahead in the
 * postseason. ESPN keeps the NFL week and maps it to a matchup period separately.
 */
export const leagueBrowseWeek = (
  provider: Provider,
  nfl: { displayWeek: number; seasonType: string; leg?: number }
): number => (provider === 'sleeper' ? sleeperMatchupWeek(nfl) : nfl.displayWeek)

/** Renderer `setLeagueBrowse` payload. Anything else is ignored. */
export const leagueBrowseOpenArg = (args: unknown): boolean | null => {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return null
  if (!('open' in args)) return null
  const open = (args as { open?: unknown }).open
  if (typeof open !== 'boolean') return null
  return open
}

/** Hidden, minimized, and destroyed windows do not poll. */
export const leagueBrowseWindowVisible = (win: {
  isDestroyed: () => boolean
  isVisible: () => boolean
  isMinimized: () => boolean
}): boolean => !win.isDestroyed() && win.isVisible() && !win.isMinimized()

export const leagueBrowseBackoff = (error: unknown): boolean => {
  if (error instanceof HttpBackoffError) return true
  if (error instanceof HttpError && error.status === 429) return true
  if (error instanceof EspnHttpError && error.status === 429) return true
  return false
}

const espnSignInError = (error: unknown): boolean => error instanceof EspnHttpError && error.status === 401

type EspnAllEntry = {
  boxscore: unknown | null
  boxscoreAt: number | null
  compact: unknown | null
  compactAt: number | null
}

let host: LeagueBrowseHost | null = null
let schedule: Scheduler = defaultSchedule
let timer: { cancel: () => void } | null = null
let open = false
let windowVisible = true
let backedOff = false
let gen = 0
let pending: Promise<void> = Promise.resolve()
let last: LeagueBoardSnapshot | null = null
let seenKey = ''
const stash = new Map<string, SleeperMatchup[]>()
const espnAll = new Map<string, EspnAllEntry>()

const contextKey = (ctx: LeagueBrowseContext | null): string =>
  ctx ? `${ctx.leagueKey}:${ctx.week}:${ctx.replay ? 'replay' : 'live'}` : ''

const sleeperKey = (leagueId: string, week: number): string => `${leagueId}:${week}`

const active = (): boolean => open && windowVisible && !backedOff

const cancelTimer = (): void => {
  if (!timer) return
  timer.cancel()
  timer = null
}

const halt = (): void => {
  gen += 1
  cancelTimer()
}

export const bindLeagueBrowse = (next: LeagueBrowseHost): void => {
  host = next
}

export const setLeagueBrowseScheduler = (next: Scheduler | null): void => {
  schedule = next ?? defaultSchedule
}

export const resetLeagueBrowse = (): void => {
  halt()
  open = false
  windowVisible = true
  backedOff = false
  last = null
  seenKey = ''
  stash.clear()
  espnAll.clear()
  schedule = defaultSchedule
  pending = Promise.resolve()
}

export const leagueBrowseSettled = (): Promise<void> => pending

export const leagueBrowseEspnCacheKeys = (): string[] => [...espnAll.keys()]

export const setLeagueBrowseVisible = (next: boolean): void => {
  if (windowVisible === next) return
  windowVisible = next
  if (!next) {
    halt()
    return
  }
  if (open) void kick()
}

export const setLeagueBrowseOpen = (next: boolean): void => {
  if (!next) {
    if (!open) return
    open = false
    backedOff = false
    seenKey = ''
    halt()
    return
  }
  const key = contextKey(host?.context() ?? null)
  if (open && key === seenKey && active()) return
  open = true
  backedOff = false
  seenKey = key
  void kick()
}

/** Follow a HUD league or week change. Same context does not start another request. */
export const pokeLeagueBrowse = (): void => {
  if (!open || !windowVisible || !host) return
  const ctx = host.context()
  const key = contextKey(ctx)
  if (key === seenKey) return
  seenKey = key
  if (backedOff) {
    if (ctx) fail(ctx, 'League scores are paused after a rate limit. Your matchup is unchanged.')
    return
  }
  halt()
  void kick()
}

const arm = (token: number, ms: number): void => {
  if (token !== gen || !active()) return
  cancelTimer()
  timer = schedule(() => {
    void kick()
  }, ms)
}

const baseSnap = (ctx: LeagueBrowseContext, status: LeagueBoardSnapshot['status']): LeagueBoardSnapshot => ({
  leagueKey: ctx.leagueKey,
  leagueName: ctx.leagueName,
  provider: ctx.provider,
  week: ctx.week,
  status,
  pairs: last && last.leagueKey === ctx.leagueKey && last.week === ctx.week ? last.pairs : [],
  updatedAt: last && last.leagueKey === ctx.leagueKey ? last.updatedAt : null,
  pollingLive: ctx.pollingLive
})

const emit = (snapshot: LeagueBoardSnapshot): void => {
  last = snapshot
  host?.publish(snapshot)
}

const kick = (): void => {
  const token = gen
  const run = pump(token)
  pending = pending.then(
    () => run,
    () => run
  )
}

const attachTeams = (payload: unknown, teams: Record<string, unknown>[]): unknown => {
  if (teams.length === 0 || !payload || typeof payload !== 'object' || Array.isArray(payload)) return payload
  const row = payload as Record<string, unknown>
  const existing = row.teams
  if (Array.isArray(existing) && existing.length > 0) return payload
  return { ...row, teams }
}

const publishSleeper = (ctx: LeagueBrowseContext): void => {
  if (!host) return
  const rows = stash.get(sleeperKey(ctx.leagueId, ctx.week))
  if (!rows) {
    emit({ ...baseSnap(ctx, 'loading'), pairs: [] })
    return
  }
  const pairs = host.sleeperBuild(ctx.leagueId, ctx.week, rows)
  if (!pairs) {
    const snap = baseSnap(ctx, 'loading')
    emit(snap.pairs.length > 0 ? { ...snap, status: 'ready' } : snap)
    return
  }
  emit({
    ...baseSnap(ctx, 'ready'),
    pairs,
    updatedAt: host.now(),
    status: 'ready'
  })
}

const publishEspn = (ctx: LeagueBrowseContext, entry: EspnAllEntry | undefined): boolean => {
  if (!host || !entry) return false
  const teams = host.espnTeams(ctx.leagueId)
  let body: unknown = null
  if (entry.boxscore && entry.compact && !espnLivePayloadIsStub(entry.compact)) {
    body = overlayLiveScoring(entry.boxscore, entry.compact)
  } else if (entry.boxscore) {
    body = entry.boxscore
  } else if (entry.compact && !espnLivePayloadIsStub(entry.compact)) {
    body = entry.compact
  }
  if (body == null) return false
  const pairs = toEspnLeaguePairs({
    payload: attachTeams(body, teams),
    displayWeek: ctx.week,
    myTeamId: host.myEspnTeamId(ctx.leagueId),
    matchupPeriod: ctx.matchupPeriod,
    ticker: ctx.ticker,
    slate: ctx.slate
  })
  if (pairs.length === 0) return false
  emit({
    ...baseSnap(ctx, 'ready'),
    pairs,
    updatedAt: host.now(),
    status: 'ready'
  })
  return true
}

const fail = (ctx: LeagueBrowseContext, error: string, needsSignIn = false): void => {
  const snap = baseSnap(ctx, 'error')
  emit({
    ...snap,
    status: 'error',
    error,
    ...(needsSignIn ? { needsSignIn: true } : {})
  })
}

const pumpEspn = async (token: number, ctx: LeagueBrowseContext): Promise<void> => {
  if (!host) return
  const key = espnLeagueAllCacheKey(ctx.leagueId, ctx.week)
  const entry = espnAll.get(key) ?? { boxscore: null, boxscoreAt: null, compact: null, compactAt: null }
  const now = host.now()
  const live = ctx.pollingLive
  if (entry.boxscore || entry.compact) publishEspn(ctx, entry)
  let kind: LeagueBrowseKind | null = null
  if (!entry.boxscore) kind = 'boxscore'
  else if (live) {
    if (entry.compactAt == null || now - entry.compactAt >= LIVE_POLL_MS) kind = 'compact'
  } else if (entry.boxscoreAt == null || now - entry.boxscoreAt >= IDLE_POLL_MS) {
    kind = 'boxscore'
  }
  if (!kind) {
    arm(token, live ? LIVE_POLL_MS : IDLE_POLL_MS)
    return
  }
  try {
    const payload = await host.fetchEspn({
      season: ctx.season,
      leagueId: ctx.leagueId,
      week: ctx.week,
      kind
    })
    if (token !== gen || !active() || !sameContext(ctx)) return
    const next: EspnAllEntry = { ...entry }
    const at = host.now()
    switch (kind) {
      case 'boxscore':
        next.boxscore = payload
        next.boxscoreAt = at
        break
      case 'compact':
        next.compact = payload
        next.compactAt = at
        break
      default: {
        const _never: never = kind
        void _never
      }
    }
    espnAll.set(key, next)
    const painted = publishEspn(ctx, next)
    if (!painted) {
      const snap = baseSnap(ctx, next.boxscore ? 'ready' : 'loading')
      emit(snap)
    }
    if (token !== gen || !active() || !sameContext(ctx)) return
    arm(token, live ? LIVE_POLL_MS : IDLE_POLL_MS)
  } catch (error) {
    if (token !== gen || !sameContext(ctx)) return
    if (leagueBrowseBackoff(error)) {
      backedOff = true
      cancelTimer()
      fail(ctx, 'League scores are paused after a rate limit. Your matchup is unchanged.')
      return
    }
    if (espnSignInError(error)) {
      fail(ctx, 'ESPN needs a sign-in before this league can load.', true)
      if (token === gen && open && windowVisible) arm(token, IDLE_POLL_MS)
      return
    }
    fail(ctx, 'Could not load the rest of the league. Your matchup is unchanged.')
    if (token === gen && open && windowVisible && !backedOff) arm(token, IDLE_POLL_MS)
  }
}

const sameContext = (ctx: LeagueBrowseContext): boolean =>
  contextKey(host?.context() ?? null) === contextKey(ctx)

const noteSwitch = (ctx: LeagueBrowseContext): void => {
  if (!last || (last.leagueKey === ctx.leagueKey && last.week === ctx.week)) return
  emit({
    leagueKey: ctx.leagueKey,
    leagueName: ctx.leagueName,
    provider: ctx.provider,
    week: ctx.week,
    status: 'loading',
    pairs: [],
    updatedAt: null,
    pollingLive: ctx.pollingLive
  })
}

const pump = async (token: number): Promise<void> => {
  if (token !== gen || !host || !active()) return
  const ctx = host.context()
  if (!ctx) {
    emit({
      leagueKey: '',
      leagueName: '',
      provider: 'sleeper',
      week: 0,
      status: 'loading',
      pairs: [],
      updatedAt: null,
      pollingLive: false
    })
    return
  }
  noteSwitch(ctx)
  if (ctx.replay) {
    const fixture = replayBoardFixture()
    if (fixture === 'loading') {
      emit({ ...baseSnap(ctx, 'loading'), pairs: [], updatedAt: null })
      return
    }
    if (fixture === 'error') {
      emit({
        ...baseSnap(ctx, 'error'),
        pairs: host.replayPairs(ctx.leagueKey),
        updatedAt: host.now(),
        error: 'League scores are paused after a rate limit. Your matchup is unchanged.'
      })
      return
    }
    emit({
      ...baseSnap(ctx, 'ready'),
      pairs: host.replayPairs(ctx.leagueKey),
      updatedAt: host.now(),
      status: 'ready'
    })
    arm(token, ctx.pollingLive ? LIVE_POLL_MS : IDLE_POLL_MS)
    return
  }
  switch (ctx.provider) {
    case 'sleeper':
      publishSleeper(ctx)
      arm(token, ctx.pollingLive ? LIVE_POLL_MS : IDLE_POLL_MS)
      return
    case 'espn':
      await pumpEspn(token, ctx)
      return
    default: {
      const _never: never = ctx.provider
      void _never
    }
  }
}

/**
 * Hand off the array the HUD already fetched. No second GET.
 * A closed League view skips the copy. A hidden window keeps the copy but does not publish.
 */
export const offerSleeperMatchups = (leagueId: string, week: number, rows: SleeperMatchup[]): void => {
  if (!open || !host) return
  const ctx = host.context()
  if (!ctx || ctx.replay || ctx.provider !== 'sleeper') return
  if (ctx.leagueId !== leagueId || ctx.week !== week) return
  stash.set(sleeperKey(leagueId, week), rows.slice())
  if (!windowVisible || backedOff) return
  publishSleeper(ctx)
}

/**
 * Rebuild the open Sleeper board from the stashed week.
 * Projections land on their own fetch, after the matchup handoff. Mine
 * repaints on that fetch. The league list has to as well — `pokeLeagueBrowse`
 * ignores a league and week it has already seen.
 */
export const refreshSleeperLeagueBoard = (): void => {
  if (!active() || !host) return
  const ctx = host.context()
  if (!ctx || ctx.replay || ctx.provider !== 'sleeper') return
  if (!stash.has(sleeperKey(ctx.leagueId, ctx.week))) return
  publishSleeper(ctx)
}

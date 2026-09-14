import type { AppState, League, Matchup, NflState, OverlayHudState, TapeEvent, ToastPayload, Transaction } from '@shared/types'
import { emptyAppState, leagueKey, overlayHudUnchanged, parseLeagueKey, toOverlayHud } from '@shared/types'
import { parseOverlayLayout } from '@shared/overlayLayout'
import { transactionKindLabel } from '@shared/transactionKind'
import { matchupHasLineup, toMatchupBoard, upsertMatchupBoard, type MatchupBoardExtra } from '@shared/display'
import { injuryTapeFromDiff, mergeTape, scoreTapeFromDiff, transactionToTape, withTickDeltas } from '@shared/tape'
import { emptyScoreMemory, stabilizeMatchup, type MatchupScoreMemory } from '@shared/scoreStability'
import { isLikelyLive, LIVE_POLL_MS, nextPollDelayMs, pollIntervalMs } from './liveWindow'
import { recentFetchTimings } from './http'
import { getPlayerMap, hydratePlayerMapFromDisk, peekPlayerDumpReady, peekPlayerMap } from './providers/playerCache'
import {
  getSleeperProjectionPts,
  hydrateSleeperProjectionsFromDisk,
  peekSleeperProjectionPts,
  resetSleeperProjectionsCache
} from './providers/sleeperProjections'
import {
  getLeagueUsers,
  getMatchups,
  getNflState,
  getRosters,
  getTransactions,
  getUser,
  getUserLeagues,
  type CachedPlayer,
  type SleeperLeagueUser,
  type SleeperMatchup,
  type SleeperRoster,
  type SleeperUser
} from './providers/sleeperClient'
import { applyPlayerNames, applySleeperWinEstimate, overlaySleeperMatchups, toLeagues, toMatchup, toNflState, toTransactions } from './providers/sleeperAdapter'
import {
  DISCOVERY_VIEWS,
  EspnHttpError,
  fetchActivity,
  fetchLeague,
  fetchTransactions,
  SCORE_VIEWS,
  LIVE_VIEWS,
  SETTINGS_VIEWS,
  probeFanLeagues,
  weekScheduleFilter,
  weekTeamScheduleFilter,
  type EspnCookies
} from './providers/espnClient'
import { nflScoreboardState } from './providers/nflScoreboard'
import {
  leaguesFromFanPayload,
  espnTeamsFromPayload,
  espnTeamsHaveOwners,
  espnPayloadHasNamedLineup,
  findMyTeam,
  mergeEspnTeams,
  espnLivePayloadIsStub,
  overlayEspnMatchup,
  overlayLiveScoring,
    toEspnActivity,
    toEspnLeague,
    toEspnMatchup,
    toEspnTransactions
} from './providers/espnAdapter'
import {
  FEATURED_LEAGUE_KEY,
  bumpReplayTick,
  isReplayMode,
  replayBoardMeta,
  replayEspnLeagues,
  replayMatchup,
  replayNfl,
  replayNflTicker,
  replaySeedTape,
  replaySleeperLeagues,
  replayTransactions
} from './providers/replay'
import { runtime } from './runtime'
import { overlayLanState } from './server'
import { loadSettings, saveSettings } from './store'
import { readEspnCookies } from './windows/espnLogin'
import { cacheFresh, espnDiscoverySwrPlan, espnFanExtraIds, espnHudCookiePlan, espnHudLikelyPrivate, espnLeagueIdsToDiscover, espnLeaguesCachePlan, espnScoreKickOrder, liveScorePriority, sleeperIdentityPriority, sleeperIdentityTimeoutMs, hudScoreFetchTimeoutMs, espnLiveFullSwrPlan, espnDeferredBoxscoreDrainPlan, espnScoreRefreshKey, espnBoxscoreSwrFreshPlan, espnBoxscoreRecoverStale, backgroundGetPriority, espnFullSwrPaintPlan, espnHudFromScorePlan, espnOverlayPtsPlan, espnBoxscoreSwrPtsPlan, espnScoreOnLiveFail, espnScoreOverlayPlan, espnTeamIdFromMatchup, espnTeamIdOf, espnTeamFetchKey, espnTeamIdLookupPlan, espnLiveOverlayCachePlan, espnLiveDiskHydratePlan, espnTeamsHydrateAfterScorePlan, espnTeamsKickPlan, espnTxCookieRetryPlan, espnTxKickOrder, espnUncachedDiscoveryPlan, espnCookieRetryAfterScorePlan, gamedayLiveTick, scoreboardPollLive, restSettleSchedulePlan, holdForSelectedLive, isLiveLeagueId, isLiveLeagueKey, mapSettledLimit, mergeProviderLeagues, nflCalendarSeed, calendarNflFallback, nflWeekShifted, peekSettled, recentLiveCallMs, restConcurrency, restScoreTimeoutMs, restScoreFetchPriority, restLeaguesToPrefetch, restMatchupFlightKey, restHudJoinPlan, restPrefetchColdPlan, seedScoreboardState, selectedFallbackPlan, firstListHudPlan, firstListHudKickPlan, restPrefetchGate, companionStatePlan, companionFlagsUnchanged, companionBoardsUnchanged, overlayHudPushPlan, nflScoreboardKickPlan, nflScoreboardSettleOrder, leagueListSettlePlan, nflStateSwrPlan, nflTickStartPlan, espnCookieSwrPlan, restTxKickPlan, sleeperFatSwrPlan, sleeperFatSwrPartsPlan, sleeperCdnBustToken, sleeperMatchupsHoldKey, sleeperIdentityHoldKey, sleeperMatchupsReusePlan, sleeperMatchupsRestJoinHudPlan, espnCompactLiveHoldKey, espnHoldStaleKeys, espnCompactLiveJoinPlan, sleeperLeaguesLoadPlan, sleeperLeaguesSwrPlan, leagueListFetchPlan, matchupsDiskHydratePlan, playerDumpDiskPlan, afterSelectedSettlePlan, sleeperRestNameHydratePlan, sleeperRosterOverlayPlan, sleeperOverlayRosterSwrPlan, sleeperHudScorePlan, sleeperOverlayMissPlan, sleeperRosterDiskPlan, sleeperScoreNamePlan, sleeperTxNamePlan, sleeperPrevMatchup, sleeperUserSwrPlan, sleeperUserFetchJoinPlan, sleeperUserFromSettings, sleeperUserHudPlan, splitHotCold, stripReplayLeagueKeys, stubLeagueFromKey, hudHintKey, pickSelectedLeagueKey, warmupLeaguesFromDisk, warmupMatchupFromDisk, warmupNflCachePlan, weekShiftKickOrder, lastHudDiskPlan, liveDiskPersistPlan, broadcastOrderPlan, earlyDiskHudPlan, matchupsPersistPlan, liveMatchupsPersistPlan, matchupsPersistSig, settleMatchupPlan, seedHudMatchupPlan, refreshJoinPlan, espnConnectedPlan, espnCookiePrimePlan, settleSelectedKeyPlan, restPrefetchAwaitPlan, type LastHudSnapshot } from './pollTargets'
import { readEspnLeaguesDisk, readEspnScoresDisk, readEspnTeamsDisk, readLastHud, readMatchupsDisk, readNflDisk, readNflDiskStale, readSleeperLeaguesDisk, readSleeperRostersDisk, writeEspnLeaguesDisk, writeEspnScoresDisk, writeEspnTeamsDisk, writeLastHud, writeMatchupsDisk, writeNflDisk, writeSleeperLeaguesDisk, writeSleeperRostersDisk, clearLastHud } from './nflCache'

let timer: NodeJS.Timeout | null = null
let sleeperUser: SleeperUser | null = null
let sleeperUserVerified = false
const pendingRosterSwr = new Set<string>()
const pendingEspnFullSwr = new Set<string>()
let espnNeedsRelogin = false
const markEspnHttpAuth = (error: unknown): void => {
  if (error instanceof EspnHttpError && (error.status === 401 || error.status === 403)) {
    espnNeedsRelogin = true
  }
}
const markEspnSessionHealthy = (): void => {
  espnNeedsRelogin = false
}
const espnBoardExtra = (league: League, extra?: MatchupBoardExtra): MatchupBoardExtra => ({
  ...extra,
  ...(league.provider === 'espn' && espnNeedsRelogin ? { espnNeedsRelogin: true } : {})
})
let overlayVisible = false
let overlayEditMode = false
let lastToast: ToastPayload | null = null
const seenTx = new Map<string, Set<string>>()
const seededTx = new Set<string>()
const prevPlayerPts = new Map<string, number>()
const scoreDisplayByKey = new Map<string, MatchupScoreMemory>()
const prevInjury = new Map<string, string>()
let liveTape: TapeEvent[] = []
let lastState: AppState = emptyAppState()
let lastPushedHud: OverlayHudState | null = null
let inFlight: Promise<AppState> | null = null
let inFlightSelectedKey: string | null = null
let pollGen = 0
const LEAGUE_TTL_MS = 5 * 60_000
const ROSTER_TTL_MS = 5 * 60_000
const COLD_TTL_MS = 30_000
const TX_TTL_MS = 30_000
const NFL_TTL_MS = 60_000
const COOKIE_TTL_MS = 60_000
const LIVE_FETCH_MS = 5_000
const LIVE_FETCH = { timeoutMs: LIVE_FETCH_MS, retries: 0 } as const
const SCORE_FETCH = {
  ...LIVE_FETCH,
  timeoutMs: hudScoreFetchTimeoutMs(LIVE_POLL_MS),
  priority: 'high' as const
}
const BACKGROUND_FETCH = {
  ...LIVE_FETCH,
  timeoutMs: hudScoreFetchTimeoutMs(LIVE_POLL_MS),
  priority: backgroundGetPriority()
}
const backgroundFetch = (liveTick: boolean) => ({
  ...BACKGROUND_FETCH,
  timeoutMs: restScoreTimeoutMs({
    live: liveTick,
    livePollMs: LIVE_POLL_MS,
    restTimeoutMs: LIVE_FETCH_MS
  })
})
const restScoreFetch = (liveTick: boolean) => {
  const priority = restScoreFetchPriority(liveTick)
  return {
    ...LIVE_FETCH,
    timeoutMs: restScoreTimeoutMs({
      live: liveTick,
      livePollMs: LIVE_POLL_MS,
      restTimeoutMs: LIVE_FETCH_MS
    }),
    ...(priority ? { priority } : {})
  }
}
const SLEEPER_USER_CDN_MS = 120_000
let sleeperLeaguesCache: { at: number; username: string; season: string; leagues: League[] } | null = null
const sleeperRosterCache = new Map<
  string,
  { at: number; rosters: SleeperRoster[]; users: SleeperLeagueUser[] }
>()
const matchupCache = new Map<string, { at: number; matchup: Matchup }>()
const txCache = new Map<string, { at: number; rows: Transaction[] }>()
let nflStateCache: { at: number; nfl: NflState } | null = null
let nflStateInFlight: Promise<NflState> | null = null
let espnLeaguesCache: {
  at: number
  cookieKey: string
  ids: string
  season: string
  leagues: League[]
} | null = null
let espnTeamCache = new Map<string, Record<string, unknown>[]>()
const espnTeamFetch = new Map<string, Promise<Record<string, unknown>[]>>()
const espnScoreCache = new Map<string, { at: number; week: number; payload: unknown }>()
const espnLiveCache = new Map<string, unknown>()
const espnScoreRefresh = new Map<
  string,
  { promise: Promise<unknown>; settled: boolean; hud: boolean }
>()
const espnScoreFetchGen = new Map<string, number>()
const espnCompactLiveHit = new Map<string, boolean>()
const espnCompactLiveHold = new Map<
  string,
  { promise: Promise<unknown>; settled: boolean; hud: boolean }
>()
const ESPN_SCORE_TTL_MS = 30_000
let espnScoresHydrated = false
let espnTeamsHydrated = false
let espnLeaguesHydrated = false
let sleeperRostersHydrated = false
const sleeperIdentityHold = new Map<
  string,
  {
    bust: string
    promise: Promise<{ rosters: SleeperRoster[]; users: SleeperLeagueUser[] }>
    settled: boolean
  }
>()
const sleeperMatchupsHold = new Map<
  string,
  { bust: string; promise: Promise<SleeperMatchup[]>; settled: boolean }
>()
let sleeperLeaguesHydrated = false
let matchupsHydrated = false
let espnCookieCache: { at: number; cookies: EspnCookies | null } | null = null
let espnDiscoveryInFlight: Promise<League[]> | null = null
let espnDiscoveryGen = 0
let sleeperLeaguesInFlight: Promise<League[]> | null = null
let lastHudSig = ''
let lastHudMem: LastHudSnapshot | null | undefined
let lastMatchupsSig = ''

const peekLastHud = (): LastHudSnapshot | null => {
  if (lastHudDiskPlan(lastHudMem !== undefined) === 'memory') return lastHudMem ?? null
  lastHudMem = readLastHud()
  return lastHudMem
}

export const currentState = (): AppState => lastState

const lanFields = (): Pick<
  AppState,
  'lanOverlayEnabled' | 'lanOverlayHost' | 'overlayToken' | 'overlayPairingCode'
> => {
  const lan = overlayLanState()
  return {
    lanOverlayEnabled: lan.enabled,
    lanOverlayHost: lan.host,
    overlayToken: lan.token,
    overlayPairingCode: lan.pairingCode
  }
}

export const setOverlayVisible = (visible: boolean): void => {
  overlayVisible = visible
  lastState = { ...lastState, overlayVisible }
  broadcast(lastState)
}

export const setOverlayEditMode = (edit: boolean): void => {
  overlayEditMode = edit
  lastState = { ...lastState, overlayEditMode }
  broadcast(lastState)
}

export const applyOverlayLayout = (layout: AppState['overlayLayout']): void => {
  const next = parseOverlayLayout(layout)
  saveSettings({ overlayLayout: next })
  lastState = { ...lastState, overlayLayout: next }
  broadcast(lastState)
}

export const applyLanOverlay = (): void => {
  lastState = { ...lastState, overlayPort: runtime.overlayPort(), ...lanFields() }
  broadcast(lastState)
}

const broadcast = (state: AppState): void => {
  const prev = lastState
  lastState = state
  const order = broadcastOrderPlan()
  switch (order) {
    case 'hud-then-state': {
      const hud = toOverlayHud(state)
      const overlayUnchanged = Boolean(lastPushedHud && overlayHudUnchanged(lastPushedHud, hud))
      const push = overlayHudPushPlan(overlayUnchanged)
      switch (push) {
        case 'push':
          lastPushedHud = hud
          runtime.pushHud(hud)
          break
        case 'skip':
          break
        default: {
          const _never: never = push
          void _never
        }
      }
      const companion = companionStatePlan({
        overlaySkipped: overlayUnchanged,
        flagsUnchanged: companionFlagsUnchanged(prev, state),
        boardsUnchanged: companionBoardsUnchanged(prev, state)
      })
      switch (companion) {
        case 'tick':
          runtime.sendTick({
            lastUpdated: state.lastUpdated,
            pollMs: state.pollMs,
            liveCallMs: state.liveCallMs
          })
          return
        case 'boards':
          runtime.sendBoards({
            boards: state.boards,
            leagues: state.leagues,
            lastUpdated: state.lastUpdated,
            pollMs: state.pollMs,
            liveCallMs: state.liveCallMs
          })
          return
        case 'hud':
          runtime.sendLive({
            matchup: state.matchup,
            tape: state.tape,
            nflTicker: state.nflTicker,
            pollingLive: state.pollingLive,
            overlayEditMode: state.overlayEditMode,
            lastUpdated: state.lastUpdated,
            pollMs: state.pollMs,
            liveCallMs: state.liveCallMs
          })
          return
        case 'after-hud':
          queueMicrotask(() => runtime.sendState(state))
          return
        default: {
          const _never: never = companion
          void _never
        }
      }
      return
    }
    default: {
      const _never: never = order
      void _never
    }
  }
}

const emitNewTransactions = (league: League, rows: Transaction[]): void => {
  const key = leagueKey(league.provider, league.id)
  const seen = seenTx.get(key) ?? new Set<string>()
  if (!seededTx.has(key)) {
    for (const row of rows) seen.add(row.id)
    seenTx.set(key, seen)
    seededTx.add(key)
    return
  }
  for (const row of rows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    const toast: ToastPayload = {
      id: `${key}:${row.id}`,
      title: `${league.name} · ${transactionKindLabel(row.type)}`,
      body: row.players.filter(Boolean).join(', ') || 'New transaction'
    }
    lastToast = toast
    runtime.sendToast(toast)
  }
  seenTx.set(key, seen)
}

const loadNflFresh = async (liveTick = false): Promise<NflState> => {
  const nfl = toNflState(
    await getNflState({
      ...backgroundFetch(liveTick),
      cacheBust: sleeperCdnBustToken(Date.now(), NFL_TTL_MS)
    })
  )
  nflStateCache = { at: Date.now(), nfl }
  writeNflDisk(nfl)
  return nfl
}

const loadNfl = (): NflState => {
  if (isReplayMode()) return replayNfl()
  if (nflStateCache) return nflStateCache.nfl
  const disk = readNflDisk() ?? readNflDiskStale()
  if (disk) {
    nflStateCache = { at: Date.now() - NFL_TTL_MS, nfl: disk }
    return disk
  }
  const seed = nflCalendarSeed(new Date(), peekLastHud()?.displayWeek)
  nflStateCache = { at: Date.now() - NFL_TTL_MS, nfl: seed }
  return seed
}

const kickNflStateSwr = (onFresh: (nfl: NflState) => void, liveTick = false): void => {
  if (isReplayMode()) return
  const plan = nflStateSwrPlan({
    fresh: Boolean(nflStateCache && cacheFresh(nflStateCache.at, Date.now(), NFL_TTL_MS)),
    liveTick,
    cachedWeek: nflStateCache?.nfl.displayWeek,
    calendarWeek: calendarNflFallback(new Date()).displayWeek
  })
  switch (plan) {
    case 'return':
      return
    case 'swr':
      if (!nflStateInFlight) {
        nflStateInFlight = loadNflFresh(liveTick).finally(() => {
          nflStateInFlight = null
        })
      }
      void nflStateInFlight.then(onFresh).catch(() => undefined)
      return
    default: {
      const _never: never = plan
      void _never
    }
  }
}

let espnCookieInFlight: Promise<EspnCookies | null> | null = null

const loadEspnCookiesFresh = async (): Promise<EspnCookies | null> => {
  const cookies = await readEspnCookies()
  espnCookieCache = cookies ? { at: Date.now(), cookies } : { at: Date.now(), cookies: null }
  return cookies
}

const loadEspnCookies = async (): Promise<EspnCookies | null> => {
  if (espnCookieCache) return espnCookieCache.cookies
  if (!espnCookieInFlight) {
    espnCookieInFlight = loadEspnCookiesFresh().finally(() => {
      espnCookieInFlight = null
    })
  }
  return espnCookieInFlight
}

/** Sign-in invalidates the 60s session cache; reload the jar before the next scoring GET. */
export const primeEspnCookies = async (): Promise<EspnCookies | null> => {
  for (let attempt = 0; ; attempt += 1) {
    const cookies = await loadEspnCookiesFresh()
    const plan = espnCookiePrimePlan({ hasCookies: Boolean(cookies), attempt })
    switch (plan) {
      case 'done':
        return cookies
      case 'retry':
        await new Promise<void>((resolve) => setTimeout(resolve, 150 * (attempt + 1)))
        break
      default: {
        const _never: never = plan
        void _never
        return cookies
      }
    }
  }
}

const kickEspnCookieSwr = (liveTick = false): void => {
  if (isReplayMode()) return
  const plan = espnCookieSwrPlan({
    fresh: Boolean(espnCookieCache && cacheFresh(espnCookieCache.at, Date.now(), COOKIE_TTL_MS)),
    liveTick,
    hasSession: Boolean(espnCookieCache?.cookies)
  })
  switch (plan) {
    case 'return':
      return
    case 'swr':
      if (!espnCookieInFlight) {
        espnCookieInFlight = loadEspnCookiesFresh().finally(() => {
          espnCookieInFlight = null
        })
      }
      return
    default: {
      const _never: never = plan
      void _never
    }
  }
}

export const invalidateEspnSession = (): void => {
  espnNeedsRelogin = true
  espnCookieCache = null
  espnCookieInFlight = null
  espnLeaguesCache = null
  espnLeaguesHydrated = true
  writeEspnLeaguesDisk({ season: '', ids: '', leagues: [] })
  espnTeamCache.clear()
  espnScoreCache.clear()
  espnLiveCache.clear()
  espnScoreRefresh.clear()
  espnScoreFetchGen.clear()
  espnCompactLiveHit.clear()
  espnCompactLiveHold.clear()
  espnScoresHydrated = true
  pendingEspnFullSwr.clear()
  writeEspnScoresDisk({})
  espnTeamsHydrated = false
  dropCachedMatchups('espn')
  espnDiscoveryGen += 1
  espnDiscoveryInFlight = null
  const espnHud =
    lastState.selectedLeagueKey?.startsWith('espn:') || lastHudMem?.selectedKey?.startsWith('espn:')
  if (espnHud) {
    lastHudMem = null
    lastHudSig = ''
    clearLastHud()
  }
  lastState = {
    ...lastState,
    espnConnected: false,
    espnNeedsRelogin: true,
    matchup: lastState.selectedLeagueKey?.startsWith('espn:') ? null : lastState.matchup
  }
}

let sleeperUserInFlight: Promise<SleeperUser | null> | null = null

const rememberSleeperUser = (user: SleeperUser, username: string): void => {
  sleeperUser = { ...user, username }
  sleeperUserVerified = true
  if (loadSettings().sleeperUserId !== user.user_id) {
    saveSettings({ sleeperUserId: user.user_id })
  }
}

const fetchSleeperUser = (hud: boolean, liveTick: boolean): Promise<SleeperUser | null> => {
  const username = loadSettings().sleeperUsername
  if (!username) return Promise.resolve(null)
  const join = sleeperUserFetchJoinPlan(sleeperUserInFlight != null)
  switch (join) {
    case 'join':
      return sleeperUserInFlight ?? Promise.resolve(null)
    case 'kick': {
      const identityPriority = sleeperIdentityPriority(hud, liveTick)
      sleeperUserInFlight = getUser(username, {
        ...LIVE_FETCH,
        timeoutMs: sleeperIdentityTimeoutMs(hud, LIVE_POLL_MS, LIVE_FETCH_MS, liveTick),
        ...(identityPriority ? { priority: identityPriority } : {}),
        cacheBust: sleeperCdnBustToken(Date.now(), SLEEPER_USER_CDN_MS)
      })
        .then((user) => {
          rememberSleeperUser(user, username)
          return sleeperUser
        })
        .catch(() => sleeperUser)
        .finally(() => {
          sleeperUserInFlight = null
        })
      return sleeperUserInFlight
    }
    default: {
      const _never: never = join
      return _never
    }
  }
}

const ensureSleeperUser = async (hud = false, liveTick = false): Promise<SleeperUser | null> => {
  if (isReplayMode()) return sleeperUser
  const username = loadSettings().sleeperUsername
  if (!username) {
    sleeperUser = null
    sleeperUserVerified = false
    sleeperLeaguesCache = null
    sleeperRosterCache.clear()
    return null
  }
  const cachedId = loadSettings().sleeperUserId
  const plan = sleeperUserSwrPlan({
    hasVerifiedUser: Boolean(sleeperUser && sleeperUser.username === username && sleeperUserVerified),
    hasCachedId: Boolean(cachedId)
  })
  switch (plan) {
    case 'return':
      return sleeperUser
    case 'defer-swr':
      sleeperUser = { user_id: cachedId as string, username }
      return sleeperUser
    case 'await-fetch':
      return fetchSleeperUser(hud, liveTick)
    default: {
      const _never: never = plan
      return _never
    }
  }
}

const kickSleeperUserSwr = async (gen: number, liveTick = false): Promise<void> => {
  if (isReplayMode() || sleeperUserVerified) return
  const username = loadSettings().sleeperUsername
  if (!username) return
  await fetchSleeperUser(false, liveTick)
  if (gen !== pollGen) return
}

const kickPendingRosterSwr = async (limit: number, liveTick = false): Promise<void> => {
  if (isReplayMode() || pendingRosterSwr.size === 0) return
  const ids = [...pendingRosterSwr]
  pendingRosterSwr.clear()
  await mapSettledLimit(ids, limit, async (id) => {
    await refreshSleeperRosters(id, liveTick)
  })
}

const loadSleeperLeaguesFresh = async (nfl: NflState, user: SleeperUser, username: string): Promise<League[]> => {
  const leagues = toLeagues(
    await getUserLeagues(user.user_id, nfl.leagueSeason, {
      ...BACKGROUND_FETCH,
      cacheBust: sleeperCdnBustToken(Date.now(), LEAGUE_TTL_MS)
    }),
    nfl.leagueSeason,
    nfl.displayWeek
  )
  sleeperLeaguesCache = { at: Date.now(), username, season: nfl.leagueSeason, leagues }
  persistAfterPaint(() => {
    writeSleeperLeaguesDisk({ username, season: nfl.leagueSeason, leagues })
  })
  return leagues
}

const hydrateSleeperLeaguesFromDisk = (nfl: NflState): void => {
  if (sleeperLeaguesHydrated) return
  sleeperLeaguesHydrated = true
  const username = loadSettings().sleeperUsername
  if (!username) return
  const disk = readSleeperLeaguesDisk()
  if (!disk || disk.username !== username || disk.season !== nfl.leagueSeason) return
  if (sleeperLeaguesCache) return
  sleeperLeaguesCache = {
    at: Date.now() - LEAGUE_TTL_MS,
    username,
    season: nfl.leagueSeason,
    leagues: disk.leagues.map((league) => ({ ...league, week: nfl.displayWeek }))
  }
}

const loadSleeperLeagues = async (
  nfl: NflState,
  opts?: { waitForBoards?: boolean }
): Promise<League[]> => {
  if (isReplayMode()) return replaySleeperLeagues(nfl)
  const username = loadSettings().sleeperUsername
  if (!username) return []
  hydrateSleeperLeaguesFromDisk(nfl)
  const cached =
    sleeperLeaguesCache &&
    sleeperLeaguesCache.username === username &&
    sleeperLeaguesCache.season === nfl.leagueSeason
      ? sleeperLeaguesCache
      : null
  const loadPlan = sleeperLeaguesLoadPlan({
    hasFreshCache: Boolean(cached && cacheFresh(cached.at, Date.now(), LEAGUE_TTL_MS)),
    hasStaleCache: Boolean(cached)
  })
  const swr = sleeperLeaguesSwrPlan(loadPlan, Boolean(opts?.waitForBoards))
  switch (swr) {
    case 'return':
      return cached?.leagues ?? []
    case 'defer-swr':
      return cached?.leagues ?? []
    case 'await-fetch':
      if (!sleeperLeaguesInFlight) {
        sleeperLeaguesInFlight = ensureSleeperUser()
          .then((user) => (user ? loadSleeperLeaguesFresh(nfl, user, username) : cached?.leagues ?? []))
          .finally(() => {
            sleeperLeaguesInFlight = null
          })
      }
      return sleeperLeaguesInFlight
    default: {
      const _never: never = swr
      return _never
    }
  }
}

const kickSleeperLeaguesSwr = (nfl: NflState, gen: number): void => {
  if (isReplayMode() || sleeperLeaguesInFlight) return
  const username = loadSettings().sleeperUsername
  if (!username) return
  hydrateSleeperLeaguesFromDisk(nfl)
  const cached =
    sleeperLeaguesCache &&
    sleeperLeaguesCache.username === username &&
    sleeperLeaguesCache.season === nfl.leagueSeason
      ? sleeperLeaguesCache
      : null
  const loadPlan = sleeperLeaguesLoadPlan({
    hasFreshCache: Boolean(cached && cacheFresh(cached.at, Date.now(), LEAGUE_TTL_MS)),
    hasStaleCache: Boolean(cached)
  })
  if (loadPlan === 'return-cache') return
  sleeperLeaguesInFlight = ensureSleeperUser()
    .then((user) => (user ? loadSleeperLeaguesFresh(nfl, user, username) : cached?.leagues ?? []))
    .catch(() => cached?.leagues ?? [])
    .then((leagues) => {
      if (gen !== pollGen) return leagues
      broadcast({
        ...lastState,
        leagues: mergeProviderLeagues(lastState.leagues, 'sleeper', leagues),
        lastUpdated: Date.now()
      })
      return leagues
    })
    .finally(() => {
      sleeperLeaguesInFlight = null
    })
}

const persistAfterPaint = (write: () => void): void => {
  const plan = liveDiskPersistPlan()
  switch (plan) {
    case 'after-paint':
      queueMicrotask(write)
      return
    default: {
      const _never: never = plan
      void _never
    }
  }
}

const persistLiveSnapshot = (write: () => void): void => {
  const seasonType = lastState.nfl?.seasonType
  const calendarLive = seasonType != null && isLikelyLive(new Date(), seasonType)
  const plan = liveMatchupsPersistPlan(
    gamedayLiveTick({ pollingLive: lastState.pollingLive, calendarLive })
  )
  switch (plan) {
    case 'skip':
      return
    case 'after-paint':
      persistAfterPaint(write)
      return
    default: {
      const _never: never = plan
      void _never
    }
  }
}

const persistSleeperRosters = (): void => {
  persistLiveSnapshot(() => {
    const byId: Record<string, { rosters: Record<string, unknown>[]; users: Record<string, unknown>[] }> = {}
    for (const [id, row] of sleeperRosterCache) {
      byId[id] = {
        rosters: row.rosters as unknown as Record<string, unknown>[],
        users: row.users as unknown as Record<string, unknown>[]
      }
    }
    writeSleeperRostersDisk(byId)
  })
}

const hydrateSleeperRostersFromDisk = (): void => {
  if (sleeperRostersHydrated) return
  sleeperRostersHydrated = true
  const byId = readSleeperRostersDisk()
  if (!byId) return
  const now = Date.now()
  for (const [id, row] of Object.entries(byId)) {
    if (sleeperRosterCache.has(id)) continue
    sleeperRosterCache.set(id, {
      at: now - ROSTER_TTL_MS,
      rosters: row.rosters as unknown as SleeperRoster[],
      users: row.users as unknown as SleeperLeagueUser[]
    })
  }
}

const loadSleeperIdentity = (
  leagueId: string,
  opts: Parameters<typeof getRosters>[1]
): Promise<{ rosters: SleeperRoster[]; users: SleeperLeagueUser[] }> => {
  const bust = opts?.cacheBust ?? ''
  const hudKey = sleeperIdentityHoldKey({ leagueId, priority: 'low' })
  const key = sleeperIdentityHoldKey({ leagueId, priority: opts?.priority })
  if (key !== hudKey) {
    const hudHold = sleeperIdentityHold.get(hudKey)
    const restJoin = sleeperMatchupsRestJoinHudPlan({ hudHold: hudHold != null })
    switch (restJoin) {
      case 'join':
        return (
          hudHold?.promise ??
          Promise.all([getRosters(leagueId, opts), getLeagueUsers(leagueId, opts)]).then(([rosters, users]) => ({
            rosters,
            users
          }))
        )
      case 'own':
        break
      default: {
        const _never: never = restJoin
        return _never
      }
    }
  }
  const hold = sleeperIdentityHold.get(key)
  const reuse = sleeperMatchupsReusePlan({
    hasHold: hold != null,
    holdBust: hold?.bust ?? '',
    bust,
    settled: hold?.settled ?? false
  })
  switch (reuse) {
    case 'join':
      return (
        hold?.promise ??
        Promise.all([getRosters(leagueId, opts), getLeagueUsers(leagueId, opts)]).then(([rosters, users]) => ({
          rosters,
          users
        }))
      )
    case 'kick': {
      const row: {
        bust: string
        promise: Promise<{ rosters: SleeperRoster[]; users: SleeperLeagueUser[] }>
        settled: boolean
      } = {
        bust,
        promise: Promise.all([getRosters(leagueId, opts), getLeagueUsers(leagueId, opts)]).then(
          ([rosters, users]) => {
            sleeperRosterCache.set(leagueId, { at: Date.now(), rosters, users })
            persistSleeperRosters()
            return { rosters, users }
          }
        ),
        settled: false
      }
      row.promise = row.promise.finally(() => {
        row.settled = true
      })
      sleeperIdentityHold.set(key, row)
      return row.promise
    }
    default: {
      const _never: never = reuse
      return _never
    }
  }
}

const refreshSleeperRosters = (leagueId: string, liveTick = false): Promise<void> => {
  const fetch = backgroundFetch(liveTick)
  return loadSleeperIdentity(leagueId, {
    ...fetch,
    cacheBust: sleeperCdnBustToken(Date.now(), ROSTER_TTL_MS)
  }).then(() => undefined)
}

const persistMatchups = (week: number): void => {
  persistAfterPaint(() => {
    const byKey: Record<string, Matchup> = {}
    for (const [key, row] of matchupCache) {
      if (!isLiveLeagueKey(key)) continue
      byKey[key] = row.matchup
    }
    const sig = matchupsPersistSig(
      week,
      Object.entries(byKey).map(([key, matchup]) => ({
        key,
        myPoints: matchup.myPoints,
        oppPoints: matchup.oppPoints,
        starterSig: matchup.starters.map((player) => `${player.playerId}:${player.points ?? ''}`).join(',')
      }))
    )
    if (matchupsPersistPlan(sig, lastMatchupsSig) === 'skip') return
    lastMatchupsSig = sig
    writeMatchupsDisk({ week, byKey })
  })
}

const hydrateMatchupsFromDisk = (week: number): void => {
  if (matchupsHydrated) return
  matchupsHydrated = true
  const disk = readMatchupsDisk()
  if (!disk || disk.week !== week) return
  const now = Date.now()
  for (const [key, matchup] of Object.entries(disk.byKey)) {
    if (matchupCache.has(key)) continue
    matchupCache.set(key, { at: now - COLD_TTL_MS, matchup })
  }
}

const dropCachedMatchups = (provider: 'sleeper' | 'espn'): void => {
  for (const key of [...matchupCache.keys()]) {
    const parsed = parseLeagueKey(key)
    if (parsed?.provider === provider) matchupCache.delete(key)
  }
  for (const key of [...scoreDisplayByKey.keys()]) {
    const parsed = parseLeagueKey(key)
    if (parsed?.provider === provider) scoreDisplayByKey.delete(key)
  }
  const week = nflStateCache?.nfl.displayWeek ?? lastState.nfl?.displayWeek
  if (week != null) {
    lastMatchupsSig = ''
    persistMatchups(week)
  } else {
    lastMatchupsSig = ''
    writeMatchupsDisk({ week: 0, byKey: {} })
  }
}

const persistEspnScores = (): void => {
  persistAfterPaint(() => {
    const byId: Record<string, { week: number; payload: Record<string, unknown> }> = {}
    for (const [id, row] of espnScoreCache) {
      if (typeof row.payload !== 'object' || row.payload == null || Array.isArray(row.payload)) continue
      if (!espnPayloadHasNamedLineup(row.payload)) continue
      byId[id] = { week: row.week, payload: row.payload as Record<string, unknown> }
    }
    writeEspnScoresDisk(byId)
  })
}

const hydrateEspnScoresFromDisk = (): void => {
  if (espnScoresHydrated) return
  espnScoresHydrated = true
  const byId = readEspnScoresDisk()
  if (!byId) return
  const now = Date.now()
  for (const [id, row] of Object.entries(byId)) {
    if (espnScoreCache.has(id)) continue
    espnScoreCache.set(id, { at: now - ESPN_SCORE_TTL_MS, week: row.week, payload: row.payload })
  }
}

const rememberEspnScorePayload = (leagueId: string, week: number, payload: unknown): void => {
  if (!espnPayloadHasNamedLineup(payload)) return
  espnScoreCache.set(leagueId, { at: Date.now(), week, payload })
  persistEspnScores()
}

const rememberEspnLivePayload = (leagueId: string, payload: unknown): void => {
  espnLiveCache.set(leagueId, payload)
}

const hydrateEspnTeamsFromDisk = (): void => {
  if (espnTeamsHydrated) return
  espnTeamsHydrated = true
  const byId = readEspnTeamsDisk()
  if (!byId) return
  for (const [id, teams] of Object.entries(byId)) {
    if (espnTeamsHaveOwners(teams)) espnTeamCache.set(id, teams)
  }
}

const persistEspnTeams = (): void => {
  persistLiveSnapshot(() => {
    const byId: Record<string, Record<string, unknown>[]> = {}
    for (const [id, teams] of espnTeamCache) {
      if (espnTeamsHaveOwners(teams)) byId[id] = teams
    }
    writeEspnTeamsDisk(byId)
  })
}

const rememberEspnTeams = (leagueId: string, payload: unknown): void => {
  const teams = espnTeamsFromPayload(payload)
  if (!espnTeamsHaveOwners(teams)) return
  espnTeamCache.set(leagueId, teams)
  persistEspnTeams()
}

const paintEspnBoxscoreSwr = (opts: {
  leagueId: string
  payload: unknown
  prev: Matchup | null
  cookies: EspnCookies | null
  displayWeek: number
  recover?: boolean
  teams?: Record<string, unknown>[]
}): Matchup | null => {
  const compact = espnLiveCache.get(opts.leagueId)
  const plan = espnBoxscoreSwrPtsPlan({
    hasCompactLive: compact != null,
    recover: Boolean(opts.recover)
  })
  let body = opts.payload
  let overlaid: Matchup | null = null
  switch (plan) {
    case 'merge-compact':
      body = overlayLiveScoring(opts.payload, compact)
      overlaid = opts.prev ? overlayEspnMatchup(opts.prev, body, opts.displayWeek, true) : null
      break
    case 'boxscore':
      overlaid = opts.prev ? overlayEspnMatchup(opts.prev, body, opts.displayWeek) : null
      break
    case 'keep-prev':
      break
    default: {
      const _never: never = plan
      void _never
    }
  }
  rememberEspnScorePayload(opts.leagueId, opts.displayWeek, body)
  rememberEspnTeams(opts.leagueId, body)
  const parsed = toEspnMatchup({
    payload: mergeEspnTeams(body, espnTeamCache.get(opts.leagueId) ?? opts.teams),
    cookies: opts.cookies,
    displayWeek: opts.displayWeek,
    myTeamId: myEspnTeamId(opts.leagueId, opts.cookies)
  })
  return espnFullSwrPaintPlan({ prev: opts.prev, overlaid, parsed })
}

const ensureEspnTeams = (
  leagueId: string,
  nfl: NflState,
  cookies: EspnCookies | null,
  liveTick = false
): Promise<Record<string, unknown>[]> => {
  hydrateEspnTeamsFromDisk()
  const cached = espnTeamCache.get(leagueId)
  if (cached && espnTeamsHaveOwners(cached)) return Promise.resolve(cached)
  const key = espnTeamFetchKey(leagueId, Boolean(cookies))
  const pending = espnTeamFetch.get(key)
  if (pending) return pending
  let promise: Promise<Record<string, unknown>[]>
  promise = fetchLeague({
    season: nfl.leagueSeason,
    leagueId,
    cookies,
    views: ['mTeam'],
    ...backgroundFetch(liveTick)
  })
    .then((payload) => {
      rememberEspnTeams(leagueId, payload)
      return espnTeamCache.get(leagueId) ?? espnTeamsFromPayload(payload)
    })
    .finally(() => {
      if (espnTeamFetch.get(key) === promise) espnTeamFetch.delete(key)
    })
  espnTeamFetch.set(key, promise)
  return promise
}

const loadEspnLeague = async (
  id: string,
  nfl: NflState,
  cookies: EspnCookies | null
): Promise<League | null> => {
  try {
    const cached = espnTeamCache.get(id)
    const teamInFlight = espnTeamFetch.get(espnTeamFetchKey(id, Boolean(cookies)))
    const cachedOwners = Boolean(cached && espnTeamsHaveOwners(cached))
    if (teamInFlight || cachedOwners) {
      const [teams, settingsPayload] = await Promise.all([
        teamInFlight ?? Promise.resolve(cached ?? []),
        fetchLeague({
          season: nfl.leagueSeason,
          leagueId: id,
          cookies,
          views: SETTINGS_VIEWS,
          ...BACKGROUND_FETCH
        })
      ])
      return toEspnLeague({
        leagueId: id,
        payload: mergeEspnTeams(settingsPayload, teams),
        leagueSeason: nfl.leagueSeason,
        displayWeek: nfl.displayWeek
      })
    }
    const payload = await fetchLeague({
      season: nfl.leagueSeason,
      leagueId: id,
      cookies,
      views: DISCOVERY_VIEWS,
      ...BACKGROUND_FETCH
    })
    rememberEspnTeams(id, payload)
    return toEspnLeague({
      leagueId: id,
      payload,
      leagueSeason: nfl.leagueSeason,
      displayWeek: nfl.displayWeek
    })
  } catch (error) {
    if (error instanceof EspnHttpError && (error.status === 401 || error.status === 403)) {
      espnNeedsRelogin = true
    }
    return null
  }
}

const loadEspnLeaguesFresh = async (
  cookies: EspnCookies | null,
  nfl: NflState,
  cookieKey: string
): Promise<League[]> => {
  const gen = espnDiscoveryGen
  const knownIds = espnLeagueIdsToDiscover(loadSettings().espnLeagueIds, loadSettings().selectedLeagueKey)
  const fanPromise = cookies
    ? probeFanLeagues(cookies, BACKGROUND_FETCH)
        .then((payload) => leaguesFromFanPayload(payload, nfl.leagueSeason, nfl.displayWeek))
        .catch(() => [] as League[])
    : Promise.resolve([] as League[])
  const knownPromise = Promise.all(knownIds.map((id) => loadEspnLeague(id, nfl, cookies)))
  const extraPromise = fanPromise.then((probed) => {
    const extraIds = espnFanExtraIds(
      probed.map((league) => league.id),
      knownIds
    )
    if (extraIds.length === 0) return [] as (League | null)[]
    return Promise.all(extraIds.map((id) => loadEspnLeague(id, nfl, cookies)))
  })
  const [probed, knownLeagues, extraLeagues] = await Promise.all([fanPromise, knownPromise, extraPromise])
  const byId = new Map<string, League>()
  for (const league of [...knownLeagues, ...extraLeagues]) {
    if (league) byId.set(league.id, league)
  }
  const found = [...byId.values()]
  if (gen !== espnDiscoveryGen) return found
  const ids = [...knownIds]
  for (const league of probed) {
    if (!ids.includes(league.id)) ids.push(league.id)
  }
  if (ids.join(',') !== loadSettings().espnLeagueIds.join(',')) {
    saveSettings({ espnLeagueIds: ids })
  }
  espnLeaguesCache = {
    at: Date.now(),
    cookieKey,
    ids: loadSettings().espnLeagueIds.join(','),
    season: nfl.leagueSeason,
    leagues: found
  }
  const diskIds = espnLeaguesCache.ids
  persistAfterPaint(() => {
    writeEspnLeaguesDisk({
      season: nfl.leagueSeason,
      ids: diskIds,
      leagues: found
    })
  })
  return found
}

const hydrateEspnLeaguesFromDisk = (nfl: NflState): void => {
  if (espnLeaguesHydrated) return
  espnLeaguesHydrated = true
  const disk = readEspnLeaguesDisk()
  if (!disk || disk.season !== nfl.leagueSeason) return
  if (espnLeaguesCache) return
  espnLeaguesCache = {
    at: Date.now() - LEAGUE_TTL_MS,
    cookieKey: 'disk',
    ids: disk.ids,
    season: disk.season,
    leagues: disk.leagues.map((league) => ({ ...league, week: nfl.displayWeek }))
  }
}

const espnLeaguesLookupPlan = (
  cookies: EspnCookies | null,
  nfl: NflState
): { cookieKey: string; plan: ReturnType<typeof espnLeaguesCachePlan> } => {
  const ids = espnLeagueIdsToDiscover(loadSettings().espnLeagueIds, loadSettings().selectedLeagueKey)
  const cookieKey = cookies ? `${cookies.SWID}:${cookies.espn_s2.slice(0, 12)}` : 'none'
  return {
    cookieKey,
    plan: espnLeaguesCachePlan({
      cacheSeason: espnLeaguesCache?.season,
      cacheIds: espnLeaguesCache?.ids,
      cacheCookieKey: espnLeaguesCache?.cookieKey,
      cacheAt: espnLeaguesCache?.at,
      season: nfl.leagueSeason,
      ids: ids.join(','),
      cookieKey,
      now: Date.now(),
      ttlMs: LEAGUE_TTL_MS
    })
  }
}

const startEspnDiscovery = (
  cookies: EspnCookies | null,
  nfl: NflState,
  cookieKey: string
): Promise<League[]> => {
  if (espnDiscoveryInFlight) return espnDiscoveryInFlight
  espnDiscoveryInFlight = loadEspnLeaguesFresh(cookies, nfl, cookieKey).finally(() => {
    espnDiscoveryInFlight = null
  })
  return espnDiscoveryInFlight
}

const kickEspnDiscoverySwr = (cookies: EspnCookies | null, nfl: NflState, gen: number): void => {
  if (isReplayMode()) return
  hydrateEspnLeaguesFromDisk(nfl)
  const { cookieKey, plan } = espnLeaguesLookupPlan(cookies, nfl)
  if (plan === 'return-fresh') return
  void startEspnDiscovery(cookies, nfl, cookieKey)
    .then((leagues) => {
      if (gen !== pollGen) return
      broadcast({
        ...lastState,
        leagues: mergeProviderLeagues(lastState.leagues, 'espn', leagues),
        lastUpdated: Date.now()
      })
    })
    .catch(() => undefined)
}

const discoverEspnLeagues = async (
  cookies: EspnCookies | null,
  nfl: NflState,
  opts?: { waitForBoards?: boolean }
): Promise<League[]> => {
  if (isReplayMode()) return replayEspnLeagues(nfl)
  hydrateEspnLeaguesFromDisk(nfl)
  const { cookieKey, plan } = espnLeaguesLookupPlan(cookies, nfl)
  const swr = espnDiscoverySwrPlan(plan, Boolean(opts?.waitForBoards))
  switch (swr) {
    case 'return':
      return espnLeaguesCache?.leagues ?? []
    case 'defer-swr':
      return espnLeaguesCache?.leagues ?? []
    case 'await-fetch':
      return startEspnDiscovery(cookies, nfl, cookieKey)
    default: {
      const _never: never = swr
      return _never
    }
  }
}

const sleeperMemoryNames = (): Record<string, CachedPlayer> => {
  const namePlan = sleeperScoreNamePlan(peekPlayerDumpReady())
  switch (namePlan) {
    case 'memory':
      return peekPlayerMap()
    case 'empty':
      return {}
    default: {
      const _never: never = namePlan
      void _never
      return {}
    }
  }
}

const heldSleeperMatchups = (
  leagueId: string,
  week: number,
  opts: Parameters<typeof getMatchups>[2]
): Promise<SleeperMatchup[]> => {
  const bust = opts?.cacheBust ?? ''
  const hudKey = sleeperMatchupsHoldKey({
    leagueId,
    week,
    priority: 'high'
  })
  const key = sleeperMatchupsHoldKey({
    leagueId,
    week,
    priority: opts?.priority
  })
  if (key !== hudKey) {
    const hudHold = sleeperMatchupsHold.get(hudKey)
    const restJoin = sleeperMatchupsRestJoinHudPlan({ hudHold: hudHold != null })
    switch (restJoin) {
      case 'join':
        return hudHold?.promise ?? getMatchups(leagueId, week, opts)
      case 'own':
        break
      default: {
        const _never: never = restJoin
        return _never
      }
    }
  }
  const hold = sleeperMatchupsHold.get(key)
  const reuse = sleeperMatchupsReusePlan({
    hasHold: hold != null,
    holdBust: hold?.bust ?? '',
    bust,
    settled: hold?.settled ?? false
  })
  switch (reuse) {
    case 'join':
      return hold?.promise ?? getMatchups(leagueId, week, opts)
    case 'kick': {
      const row: { bust: string; promise: Promise<SleeperMatchup[]>; settled: boolean } = {
        bust,
        promise: getMatchups(leagueId, week, opts),
        settled: false
      }
      row.promise = row.promise.finally(() => {
        row.settled = true
      })
      sleeperMatchupsHold.set(key, row)
      return row.promise
    }
    default: {
      const _never: never = reuse
      return _never
    }
  }
}

const heldEspnGet = (
  hold: Map<string, { promise: Promise<unknown>; settled: boolean; hud: boolean }>,
  key: string,
  hud: boolean,
  kick: () => Promise<unknown>
): Promise<unknown> => {
  const row = hold.get(key)
  const join = espnCompactLiveJoinPlan({
    hasHold: row != null,
    holdIsHud: row?.hud ?? false,
    hud,
    settled: row?.settled ?? false
  })
  switch (join) {
    case 'join':
      return row?.promise ?? kick()
    case 'kick': {
      const next: { promise: Promise<unknown>; settled: boolean; hud: boolean } = {
        promise: kick(),
        settled: false,
        hud
      }
      next.promise = next.promise.finally(() => {
        next.settled = true
      })
      for (const stale of espnHoldStaleKeys({ keys: [...hold.keys()], keepKey: key })) {
        hold.delete(stale)
      }
      hold.set(key, next)
      return next.promise
    }
    default: {
      const _never: never = join
      return _never
    }
  }
}

const heldEspnCompactLive = (
  key: string,
  hud: boolean,
  kick: () => Promise<unknown>
): Promise<unknown> => heldEspnGet(espnCompactLiveHold, key, hud, kick)

const sleeperMatchup = async (
  league: League,
  nfl: NflState,
  hud = false,
  liveTick = false
): Promise<Matchup | null> => {
  if (isReplayMode()) return replayMatchup(league)
  if (!sleeperUser) {
    const peeked = sleeperUserFromSettings({
      username: loadSettings().sleeperUsername,
      userId: loadSettings().sleeperUserId
    })
    if (peeked) sleeperUser = peeked
  }
  if (!isLiveLeagueId(league.id)) return null
  const key = leagueKey(league.provider, league.id)
  const prev = sleeperPrevMatchup({
    leagueKey: key,
    selectedKey: lastState.selectedLeagueKey,
    hud: lastState.matchup,
    hudWeek: lastState.nfl?.displayWeek,
    week: nfl.displayWeek,
    cached: matchupCache.get(key)?.matchup ?? null
  })
  const scorePlan = sleeperHudScorePlan({
    hasPrevMatchup: prev != null,
    hasRosterCache: sleeperRosterCache.has(league.id)
  })
  const matchupOpts = {
    ...(hud ? SCORE_FETCH : restScoreFetch(liveTick)),
    cacheBust: sleeperCdnBustToken(Date.now(), LIVE_POLL_MS)
  }
  const identityPriority = sleeperIdentityPriority(hud, liveTick)
  const identityOpts = {
    ...LIVE_FETCH,
    timeoutMs: sleeperIdentityTimeoutMs(hud, LIVE_POLL_MS, LIVE_FETCH_MS, liveTick),
    ...(identityPriority ? { priority: identityPriority } : {}),
    cacheBust: sleeperCdnBustToken(Date.now(), ROSTER_TTL_MS)
  }
  const matchupsPromise = heldSleeperMatchups(league.id, nfl.displayWeek, matchupOpts)
  if (!sleeperUser && (scorePlan !== 'overlay-prev' || !prev)) return null
  const rememberRosterSwr = (refresh: boolean): void => {
    const rosterSwr = sleeperOverlayRosterSwrPlan(refresh)
    switch (rosterSwr) {
      case 'defer':
        pendingRosterSwr.add(league.id)
        break
      case 'skip':
        break
      default: {
        const _never: never = rosterSwr
        void _never
      }
    }
  }
  switch (scorePlan) {
    case 'overlay-prev': {
      const matchups = await matchupsPromise
      const overlaid = prev ? overlaySleeperMatchups(prev, matchups) : null
      const miss = sleeperOverlayMissPlan({
        hasOverlay: overlaid != null,
        matchupCount: matchups.length,
        hasPrev: prev != null
      })
      switch (miss) {
        case 'overlay': {
          const cached = sleeperRosterCache.get(league.id)
          const plan = sleeperRosterOverlayPlan(cached, Date.now(), ROSTER_TTL_MS)
          rememberRosterSwr(plan.refresh || !cached)
          return overlaid
        }
        case 'keep-prev':
          return prev
        case 'rebuild':
          if (!sleeperUser) return null
          break
        default: {
          const _never: never = miss
          void _never
        }
      }
      break
    }
    case 'rebuild-cached': {
      if (!sleeperUser) return null
      const matchups = await matchupsPromise
      const cached = sleeperRosterCache.get(league.id)
      const plan = sleeperRosterOverlayPlan(cached, Date.now(), ROSTER_TTL_MS)
      if (plan.overlay && cached) {
        rememberRosterSwr(plan.refresh)
        const rosterRow = sleeperRosterCache.get(league.id) ?? cached
        return toMatchup({
          userId: sleeperUser.user_id,
          rosters: rosterRow.rosters,
          users: rosterRow.users,
          matchups,
          players: sleeperMemoryNames()
        })
      }
      break
    }
    case 'await-all': {
      if (!sleeperUser) return null
      const [{ rosters, users }, matchups] = await Promise.all([
        loadSleeperIdentity(league.id, identityOpts),
        matchupsPromise
      ])
      return toMatchup({ userId: sleeperUser.user_id, rosters, users, matchups, players: sleeperMemoryNames() })
    }
    default: {
      const _never: never = scorePlan
      void _never
    }
  }
  const diskPlan = sleeperRosterDiskPlan(scorePlan)
  switch (diskPlan) {
    case 'after-fetch':
      hydrateSleeperRostersFromDisk()
      break
    case 'skip':
      break
    default: {
      const _never: never = diskPlan
      void _never
    }
  }
  const cached = sleeperRosterCache.get(league.id)
  const plan = sleeperRosterOverlayPlan(cached, Date.now(), ROSTER_TTL_MS)
  if (!sleeperUser) return null
  if (plan.overlay && cached) {
    const matchups = await matchupsPromise
    rememberRosterSwr(plan.refresh)
    const rosterRow = sleeperRosterCache.get(league.id) ?? cached
    return toMatchup({
      userId: sleeperUser.user_id,
      rosters: rosterRow.rosters,
      users: rosterRow.users,
      matchups,
      players: sleeperMemoryNames()
    })
  }
  const [{ rosters, users }, matchups] = await Promise.all([
    loadSleeperIdentity(league.id, identityOpts),
    matchupsPromise
  ])
  return toMatchup({ userId: sleeperUser.user_id, rosters, users, matchups, players: sleeperMemoryNames() })
}

const myEspnTeamId = (leagueId: string, cookies: EspnCookies | null): number | undefined => {
  const cached = matchupCache.get(leagueKey('espn', leagueId))?.matchup ?? null
  const fromMatchup = espnTeamIdFromMatchup(
    leagueId,
    lastState.selectedLeagueKey,
    lastState.matchup,
    cached
  )
  const memoryTeams = espnTeamCache.get(leagueId)
  const swidTeamId = espnTeamIdOf(findMyTeam(memoryTeams ?? [], cookies)?.id)
  const hudRow =
    lastState.selectedLeagueKey === leagueKey('espn', leagueId) && lastState.matchup
      ? lastState.matchup
      : cached
  const lookup = espnTeamIdLookupPlan({
    swidTeamId,
    fromMatchup,
    matchupHasLineup: matchupHasLineup(hudRow),
    memoryHasTeams: Boolean(memoryTeams && memoryTeams.length > 0)
  })
  switch (lookup) {
    case 'swid':
      return swidTeamId
    case 'matchup':
      return fromMatchup
    case 'memory':
      return espnTeamIdOf(findMyTeam(memoryTeams ?? [], cookies)?.id)
    case 'week-filter':
      return undefined
    default: {
      const _never: never = lookup
      return _never
    }
  }
}

const fetchEspnScorePayload = async (
  league: League,
  nfl: NflState,
  cookies: EspnCookies | null,
  hasPrevMatchup: boolean,
  hud = false,
  liveTick = false,
  hasPrevLineup = false
): Promise<{
  payload: unknown
  pendingFull: Promise<unknown> | null
  overlayFromMatchup: boolean
  compactHit: boolean
}> => {
  const teamId = myEspnTeamId(league.id, cookies)
  const scoreArgs = {
    season: nfl.leagueSeason,
    leagueId: league.id,
    cookies,
    scoringPeriodId: nfl.displayWeek,
    filter:
      teamId != null
        ? weekTeamScheduleFilter(nfl.displayWeek, teamId)
        : weekScheduleFilter(nfl.displayWeek),
    ...LIVE_FETCH
  }
  const liveScoreArgs = {
    ...scoreArgs,
    ...(hud ? SCORE_FETCH : restScoreFetch(liveTick))
  }
  const hudPriority = liveScorePriority(hud)
  const cached = espnScoreCache.get(league.id)
  const namedCached =
    cached && espnPayloadHasNamedLineup(cached.payload) ? cached : undefined
  const plan = espnScoreOverlayPlan(cached, nfl.displayWeek, Date.now(), ESPN_SCORE_TTL_MS)
  const refreshFull = (priority?: 'high'): Promise<unknown> => {
    const key = espnScoreRefreshKey({
      leagueId: league.id,
      week: nfl.displayWeek,
      hasCookies: Boolean(cookies),
      hud,
      teamId: teamId ?? null,
      bust: sleeperCdnBustToken(Date.now(), ESPN_SCORE_TTL_MS)
    })
    return heldEspnGet(espnScoreRefresh, key, hud, () =>
      fetchLeague({
        ...scoreArgs,
        views: SCORE_VIEWS,
        ...(priority ? SCORE_FETCH : backgroundFetch(liveTick))
      }).then((payload) => {
        rememberEspnScorePayload(league.id, nfl.displayWeek, payload)
        return payload
      })
    )
  }
  const overlayCache = plan.overlay ? cached : undefined
  const hasOverlay = overlayCache != null || (hasPrevMatchup && hasPrevLineup)
  const hasNamedLineup = namedCached != null || hasPrevLineup
  const kick = espnScoreKickOrder({ hasOverlay })
  const overlayAfterLive = (
    liveOnly: unknown,
    failed: boolean
  ): {
    payload: unknown
    pendingFull: Promise<unknown> | null
    overlayFromMatchup: boolean
    compactHit: boolean
  } => {
    const stub = !failed && espnLivePayloadIsStub(liveOnly)
    const compactHit = !failed && !stub
    const liveFailed = failed || stub
    const diskPlan = espnLiveDiskHydratePlan({
      cachedAtKick: overlayCache != null,
      hasPrevMatchup
    })
    switch (diskPlan) {
      case 'skip':
        break
      case 'after-live':
        hydrateEspnScoresFromDisk()
        break
      default: {
        const _never: never = diskPlan
        void _never
      }
    }
    if (!liveFailed) rememberEspnLivePayload(league.id, liveOnly)
    const afterLiveRow = espnScoreCache.get(league.id)
    const afterLive =
      afterLiveRow != null &&
      afterLiveRow.week === nfl.displayWeek &&
      espnPayloadHasNamedLineup(afterLiveRow.payload)
        ? afterLiveRow
        : undefined
    const cachePlan = espnLiveOverlayCachePlan({
      cachedAtKick: overlayCache != null,
      cachedAfterLive: afterLive != null,
      hasPrevMatchup
    })
    const planNow = espnScoreOverlayPlan(
      afterLive ?? overlayCache,
      nfl.displayWeek,
      Date.now(),
      ESPN_SCORE_TTL_MS
    )
    const fullPlan = espnLiveFullSwrPlan({
      needsFull: planNow.refreshFull,
      liveFailed,
      hasOverlay,
      hud,
      gamesIn: liveTick,
      compactIsStub: stub,
      hasNamedLineup
    })
    let pendingFull: Promise<unknown> | null = null
    switch (fullPlan) {
      case 'recover':
        pendingFull = refreshFull(hudPriority)
        break
      case 'defer':
        pendingEspnFullSwr.add(league.id)
        break
      case 'skip':
        break
      default: {
        const _never: never = fullPlan
        void _never
      }
    }
    switch (cachePlan) {
      case 'at-kick': {
        const boxscore = overlayCache?.payload
        if (boxscore == null) {
          return { payload: failed ? {} : liveOnly, pendingFull, overlayFromMatchup: true, compactHit }
        }
        if (failed) return { ...espnScoreOnLiveFail(boxscore, pendingFull), overlayFromMatchup: false, compactHit }
        return {
          payload: overlayLiveScoring(boxscore, liveOnly),
          pendingFull,
          overlayFromMatchup: false,
          compactHit
        }
      }
      case 'after-live': {
        const boxscore = afterLive?.payload
        if (boxscore == null) {
          return { payload: failed ? {} : liveOnly, pendingFull, overlayFromMatchup: true, compactHit }
        }
        if (failed) return { ...espnScoreOnLiveFail(boxscore, pendingFull), overlayFromMatchup: false, compactHit }
        return {
          payload: overlayLiveScoring(boxscore, liveOnly),
          pendingFull,
          overlayFromMatchup: false,
          compactHit
        }
      }
      case 'matchup':
        return {
          payload: failed ? {} : liveOnly,
          pendingFull,
          overlayFromMatchup: true,
          compactHit
        }
      default: {
        const _never: never = cachePlan
        return _never
      }
    }
  }
  switch (kick) {
    case 'full-then-live': {
      try {
        const full = await refreshFull(hudPriority)
        return {
          payload: full,
          pendingFull: null,
          overlayFromMatchup: false,
          compactHit: full != null
        }
      } catch (error) {
        markEspnHttpAuth(error)
        return { payload: {}, pendingFull: null, overlayFromMatchup: true, compactHit: false }
      }
    }
    case 'live-then-full': {
      try {
        const liveOnly = await heldEspnCompactLive(
          espnCompactLiveHoldKey({
            leagueId: league.id,
            week: nfl.displayWeek,
            hasCookies: Boolean(cookies),
            teamId: teamId ?? null,
            bust: sleeperCdnBustToken(Date.now(), LIVE_POLL_MS)
          }),
          hud,
          () => fetchLeague({ ...liveScoreArgs, views: LIVE_VIEWS })
        )
        return overlayAfterLive(liveOnly, liveOnly == null)
      } catch (error) {
        markEspnHttpAuth(error)
        return overlayAfterLive({}, true)
      }
    }
    default: {
      const _never: never = kick
      return _never
    }
  }
}

const espnMatchup = async (
  league: League,
  nfl: NflState,
  cookies: EspnCookies | null,
  onBoxscore?: (loaded: Matchup) => void,
  hud = false,
  liveTick = false
): Promise<Matchup | null> => {
  if (isReplayMode()) return replayMatchup(league)
  if (!isLiveLeagueId(league.id)) return null
  const key = leagueKey(league.provider, league.id)
  const prev = sleeperPrevMatchup({
    leagueKey: key,
    selectedKey: lastState.selectedLeagueKey,
    hud: lastState.matchup,
    hudWeek: lastState.nfl?.displayWeek,
    week: nfl.displayWeek,
    cached: matchupCache.get(key)?.matchup ?? null
  })
  const fetchGen = (espnScoreFetchGen.get(league.id) ?? 0) + 1
  espnScoreFetchGen.set(league.id, fetchGen)
  espnCompactLiveHit.set(league.id, false)
  const scorePromise = fetchEspnScorePayload(
    league,
    nfl,
    cookies,
    prev != null,
    hud,
    liveTick,
    matchupHasLineup(prev)
  )
  const toLoaded = (payload: unknown, teams?: Record<string, unknown>[]): Matchup | null =>
    toEspnMatchup({
      payload: mergeEspnTeams(payload, espnTeamCache.get(league.id) ?? teams),
      cookies,
      displayWeek: nfl.displayWeek,
      myTeamId: myEspnTeamId(league.id, cookies)
    })
  const finish = (
    score: { payload: unknown; pendingFull: Promise<unknown> | null; overlayFromMatchup: boolean },
    teams?: Record<string, unknown>[]
  ): Matchup | null => {
    rememberEspnTeams(league.id, score.payload)
    if (score.pendingFull) {
      void score.pendingFull
        .then((full) => {
          if (espnBoxscoreRecoverStale({ startedGen: fetchGen, currentGen: espnScoreFetchGen.get(league.id) ?? 0 })) {
            return
          }
          const next = paintEspnBoxscoreSwr({
            leagueId: league.id,
            payload: full,
            prev,
            cookies,
            displayWeek: nfl.displayWeek,
            recover: true,
            teams
          })
          if (next) {
            if (cookies && matchupHasLineup(next)) markEspnSessionHealthy()
            onBoxscore?.(next)
          }
        })
        .catch((error: unknown) => {
          markEspnHttpAuth(error)
        })
    }
    const hudPlan = espnHudFromScorePlan({
      hasPrevMatchup: prev != null,
      overlayFromMatchup: score.overlayFromMatchup,
      prevHasLineup: matchupHasLineup(prev)
    })
    switch (hudPlan) {
      case 'overlay-matchup': {
        if (!prev) return toLoaded(score.payload, teams)
        const preferLive = espnOverlayPtsPlan(score.overlayFromMatchup) === 'trust-live'
        const overlaid = overlayEspnMatchup(prev, score.payload, nfl.displayWeek, preferLive)
        if (overlaid) return overlaid
        const loaded = toLoaded(score.payload, teams)
        if (loaded && matchupHasLineup(loaded)) return loaded
        return prev
      }
      case 'parse-payload':
        return toLoaded(score.payload, teams)
      default: {
        const _never: never = hudPlan
        return _never
      }
    }
  }
  const score = await scorePromise
  espnCompactLiveHit.set(league.id, score.compactHit)
  if (cookies && score.compactHit) markEspnSessionHealthy()
  const diskPlan = espnTeamsHydrateAfterScorePlan({
    overlayFromMatchup: score.overlayFromMatchup,
    memoryHasTeams: Boolean(espnTeamCache.get(league.id)),
    hasTeamId: myEspnTeamId(league.id, cookies) != null
  })
  switch (diskPlan) {
    case 'skip':
      break
    case 'after-live':
      hydrateEspnTeamsFromDisk()
      break
    default: {
      const _never: never = diskPlan
      void _never
    }
  }
  const cached = espnTeamCache.get(league.id)
  const haveOwners = Boolean(cached && espnTeamsHaveOwners(cached))
  const teamsKick = espnTeamsKickPlan({
    haveOwners,
    liveTick,
    hasTeamId: myEspnTeamId(league.id, cookies) != null
  })
  switch (teamsKick) {
    case 'skip':
      return finish(score, cached)
    case 'after-score': {
      const loaded = finish(score, cached)
      if (hud && !loaded) {
        try {
          const teams = await ensureEspnTeams(league.id, nfl, cookies, liveTick)
          return toLoaded(score.payload, teams) ?? loaded
        } catch (error) {
          markEspnHttpAuth(error)
          return loaded
        }
      }
      void ensureEspnTeams(league.id, nfl, cookies, liveTick)
        .then((teams) => {
          const next = toLoaded(score.payload, teams)
          if (!next) return
          if (
            score.overlayFromMatchup &&
            loaded &&
            matchupHasLineup(loaded) &&
            next.myTeam.id === loaded.myTeam.id
          ) {
            return
          }
          onBoxscore?.(next)
        })
        .catch((error: unknown) => {
          markEspnHttpAuth(error)
        })
      return loaded
    }
    default: {
      const _never: never = teamsKick
      return _never
    }
  }
}

const loadTransactions = async (
  league: League,
  nfl: NflState,
  cookies: EspnCookies | null,
  players: Record<string, CachedPlayer>,
  liveTick = false
): Promise<Transaction[]> => {
  if (isReplayMode()) return replayTransactions(league)
  if (!isLiveLeagueId(league.id)) return []
  if (league.provider === 'sleeper') {
    const rows = await getTransactions(league.id, nfl.displayWeek, {
      ...backgroundFetch(liveTick),
      cacheBust: sleeperCdnBustToken(Date.now(), TX_TTL_MS)
    })
    const namePlan = sleeperTxNamePlan(peekPlayerDumpReady(), liveTick)
    switch (namePlan) {
      case 'memory':
        return toTransactions(rows, players)
      case 'after-fetch':
        return toTransactions(rows, hydratePlayerMapFromDisk())
      case 'empty':
        return toTransactions(rows, {})
      default: {
        const _never: never = namePlan
        return _never
      }
    }
  }
  if (league.provider === 'espn') {
    return fetchTransactions({
      season: nfl.leagueSeason,
      leagueId: league.id,
      cookies,
      scoringPeriodId: nfl.displayWeek,
      ...backgroundFetch(liveTick)
    }).then(toEspnTransactions)
  }
  const _never: never = league.provider
  return _never
}

const loadTransactionsCached = async (
  league: League,
  nfl: NflState,
  cookies: EspnCookies | null,
  players: Record<string, CachedPlayer>,
  liveTick = false
): Promise<Transaction[]> => {
  const key = leagueKey(league.provider, league.id)
  const cached = txCache.get(key)
  if (cached && cacheFresh(cached.at, Date.now(), TX_TTL_MS)) return cached.rows
  const rows = await loadTransactions(league, nfl, cookies, players, liveTick)
  txCache.set(key, { at: Date.now(), rows })
  if (league.provider === 'espn') {
    const txPlan = espnTxKickOrder(Boolean(cookies))
    switch (txPlan) {
      case 'tx-only':
        break
      case 'tx-then-swr-activity':
        if (cookies) {
          void fetchActivity({
            season: nfl.leagueSeason,
            leagueId: league.id,
            cookies,
            ...backgroundFetch(liveTick)
          })
            .then(toEspnActivity)
            .then((activity) => {
              if (activity.length > 0) txCache.set(key, { at: Date.now(), rows: activity })
            })
            .catch(() => undefined)
        }
        break
      default: {
        const _never: never = txPlan
        void _never
      }
    }
  }
  return rows
}

let boardsTail: Promise<AppState> | null = null

export const refresh = async (opts?: { waitForBoards?: boolean }): Promise<AppState> => {
  const waitForBoards = Boolean(opts?.waitForBoards)
  const join = refreshJoinPlan({
    hasInFlight: inFlight != null,
    hasBoardsTail: boardsTail != null,
    waitForBoards,
    settingsKey: loadSettings().selectedLeagueKey,
    inFlightKey: inFlightSelectedKey
  })
  switch (join) {
    case 'join':
      if (waitForBoards && boardsTail) return boardsTail
      if (inFlight) return waitForBoards ? (boardsTail ?? inFlight) : inFlight
      break
    case 'kick':
      break
    default: {
      const _never: never = join
      void _never
    }
  }
  let pending: Promise<AppState>
  pending = runRefresh(opts).finally(() => {
    if (inFlight === pending) inFlight = null
  })
  inFlight = pending
  return pending
}

const runRefresh = async (opts?: { waitForBoards?: boolean }): Promise<AppState> => {
  const gen = ++pollGen
  const settings = loadSettings()
  inFlightSelectedKey = settings.selectedLeagueKey
  const replay = isReplayMode()
  const started = Date.now()
  let nfl: NflState | null = null
  let leagues: League[] = []
  let matchup: Matchup | null = null
  let liveHudKey: string | null = null
  let error: string | null = null
  let cookies: EspnCookies | null = null

  try {
    const cookiePromise = replay
      ? Promise.resolve({ espn_s2: 'replay', SWID: '{11111111-1111-1111-1111-111111111111}' } as EspnCookies)
      : loadEspnCookies()
    const nflStart = nflTickStartPlan()
    switch (nflStart) {
      case 'peek':
        nfl = loadNfl()
        break
      default: {
        const _never: never = nflStart
        void _never
        nfl = loadNfl()
      }
    }
    const nflState = nfl
    let liveNfl: NflState = nflState

    const calendarLive = replay || isLikelyLive(new Date(), nflState.seasonType)
    const liveTick = gamedayLiveTick({ pollingLive: lastState.pollingLive, calendarLive })
    const restLimit = restConcurrency(liveTick)

    const lastHudSnap = !replay ? peekLastHud() : null
    const hintArgs = {
      selectedKey: settings.selectedLeagueKey,
      lastSelectedKey: lastState.selectedLeagueKey,
      lastHudKey: lastHudSnap?.selectedKey ?? null,
      pinnedKeys: settings.pinnedLeagueKeys,
      leagueKeys: lastState.leagues.map((league) => leagueKey(league.provider, league.id)),
      espnLeagueIds: settings.espnLeagueIds
    }
    const hintKey = hudHintKey(hintArgs)
    const hintLeague =
      !replay && hintKey
        ? stubLeagueFromKey(hintKey, nflState.leagueSeason, nflState.displayWeek)
        : null
    if (!sleeperUser) {
      const peeked = sleeperUserFromSettings({
        username: settings.sleeperUsername,
        userId: settings.sleeperUserId
      })
      if (peeked) sleeperUser = peeked
    }
    const seedHud = seedHudMatchupPlan({
      hintKey,
      lastSelectedKey: lastState.selectedLeagueKey,
      lastHudKey: lastHudSnap?.selectedKey ?? null
    })
    const espnSeedOk = (key: string | null, row: Matchup | null): boolean => {
      const parsed = key ? parseLeagueKey(key) : null
      if (parsed?.provider === 'espn') return matchupHasLineup(row)
      return row != null
    }
    switch (seedHud) {
      case 'last-state':
        if (
          lastState.matchup &&
          lastState.nfl?.displayWeek === nflState.displayWeek &&
          espnSeedOk(lastState.selectedLeagueKey, lastState.matchup)
        ) {
          matchup = lastState.matchup
          liveHudKey = lastState.selectedLeagueKey
        }
        break
      case 'last-hud':
        if (
          lastHudSnap?.matchup &&
          lastHudSnap.displayWeek === nflState.displayWeek &&
          espnSeedOk(lastHudSnap.selectedKey, lastHudSnap.matchup)
        ) {
          matchup = lastHudSnap.matchup
          liveHudKey = lastHudSnap.selectedKey
        }
        break
      case 'skip':
        break
      default: {
        const _never: never = seedHud
        void _never
      }
    }

    const persistSelectedHud = (key: string | null, loaded: Matchup | null): void => {
      if (replay || !key || !loaded || !nfl) return
      const nflState = nfl
      const parsed = parseLeagueKey(key)
      if (parsed?.provider === 'espn' && !matchupHasLineup(loaded) && loaded.oppTeam != null) return
      if (isLiveLeagueKey(key)) matchupCache.set(key, { at: Date.now(), matchup: loaded })
      const sig = [
        key,
        nflState.displayWeek,
        loaded.myPoints,
        loaded.oppPoints,
        ...loaded.starters.map((player) => `${player.playerId}:${player.points ?? ''}`)
      ].join('|')
      if (sig === lastHudSig) return
      lastHudSig = sig
      lastHudMem = { displayWeek: nflState.displayWeek, selectedKey: key, matchup: loaded }
      persistAfterPaint(() => {
        if (lastHudMem) writeLastHud(lastHudMem)
        if (parsed?.provider === 'espn' && matchupHasLineup(loaded)) {
          persistMatchups(nflState.displayWeek)
        }
      })
    }

    const publishEarlyHud = (loaded: Matchup): void => {
      if (gen !== pollGen) return
      matchup = loaded
      const selectedKey =
        settings.selectedLeagueKey ??
        lastState.selectedLeagueKey ??
        (hintLeague ? leagueKey(hintLeague.provider, hintLeague.id) : null)
      liveHudKey = selectedKey
      persistSelectedHud(selectedKey, loaded)
      const leagues =
        lastState.leagues.length > 0
          ? lastState.leagues
          : hintLeague
            ? [hintLeague]
            : lastState.leagues
      broadcast({
        ...lastState,
        nfl,
        matchup: loaded,
        leagues,
        selectedLeagueKey: settleSelectedKeyPlan({
          discoveredKey: selectedKey,
          lastKey: lastState.selectedLeagueKey
        }),
        sleeperConnected: replay || Boolean(sleeperUser),
        sleeperUsername: replay ? 'sideline-demo' : settings.sleeperUsername,
        espnConnected: espnConnectedPlan({
          replay,
          hasCookies: Boolean(cookies),
          lastConnected: lastState.espnConnected,
          unauthorized: espnNeedsRelogin
        }),
        espnNeedsRelogin: replay ? false : espnNeedsRelogin,
        overlayPort: runtime.overlayPort(),
        overlayVisible,
        overlayHotkey: settings.overlayHotkey,
        overlayEditMode,
        overlayLayout: settings.overlayLayout,
        lastToast,
        ...lanFields(),
        replay,
        lastUpdated: Date.now(),
        pollMs: Date.now() - started,
        liveCallMs: recentLiveCallMs(recentFetchTimings()),
        pollingLive: lastState.pollingLive || calendarLive,
        error: null
      })
    }

    const tickedThisPoll = new Map<string, Matchup>()
    const stampLive = (league: League, loaded: Matchup, replace = false): Matchup => {
      if (replay) return loaded
      let incoming = loaded
      switch (league.provider) {
        case 'sleeper':
          incoming = applySleeperWinEstimate(loaded, peekSleeperProjectionPts())
          break
        case 'espn':
          break
        default: {
          const _never: never = league.provider
          void _never
        }
      }
      const key = leagueKey(league.provider, league.id)
      if (!replace) {
        const already = tickedThisPoll.get(key)
        if (already) return already
      }
      const prevDisplayed =
        tickedThisPoll.get(key) ??
        matchupCache.get(key)?.matchup ??
        (lastState.selectedLeagueKey === key ? lastState.matchup : null)
      let memory = scoreDisplayByKey.get(key)
      if (!memory) {
        memory = emptyScoreMemory()
        scoreDisplayByKey.set(key, memory)
      }
      const stable = stabilizeMatchup(prevDisplayed, incoming, memory, {
        week: liveNfl.displayWeek,
        official: Boolean(incoming.scoresFinal)
      })
      const stamped = withTickDeltas(league, stable, prevPlayerPts)
      tickedThisPoll.set(key, stamped)
      return stamped
    }

    let kickDeferredNames = (): void => undefined
    let namesPromise: Promise<Record<string, CachedPlayer>> = Promise.resolve({})

    const earlySleeperPromise =
      hintLeague?.provider === 'sleeper'
        ? (async () => {
            const plan = sleeperUserHudPlan({
              sleeperHud: true,
              hasUser: Boolean(sleeperUser),
              hasPrevMatchup: Boolean(matchup)
            })
            switch (plan) {
              case 'now':
                break
              case 'await-user':
                void sleeperMatchup(hintLeague, nflState, true, liveTick).catch(() => null)
                await ensureSleeperUser(true, liveTick)
                break
              default: {
                const _never: never = plan
                void _never
              }
            }
            return sleeperMatchup(hintLeague, nflState, true, liveTick)
          })().catch(() => null)
        : Promise.resolve(null)

    const onEspnBoxscore = (league: League, loaded: Matchup): void => {
      if (gen !== pollGen) return
      publishEarlyHud(stampLive(league, loaded, true))
    }

    const kickEspnHud = (
      league: League,
      weekNfl: NflState,
      nextCookies: EspnCookies | null
    ): Promise<Matchup | null> => {
      cookies = nextCookies
      return espnMatchup(league, weekNfl, nextCookies, (loaded) => onEspnBoxscore(league, loaded), true, liveTick)
    }

    const markEspnAuth = (caught: unknown): void => {
      if (caught instanceof EspnHttpError && (caught.status === 401 || caught.status === 403)) {
        espnNeedsRelogin = true
      }
    }

    const espnCookiePlanNow = (): ReturnType<typeof espnHudCookiePlan> =>
      espnHudCookiePlan({
        cookieCacheReady: espnCookieCache != null,
        likelyPrivate: espnHudLikelyPrivate({
          espnConnected: lastState.espnConnected,
          hasCookies: Boolean(espnCookieCache?.cookies)
        })
      })

    const withEspnCookies = (
      fetchWith: (nextCookies: EspnCookies | null) => Promise<Matchup | null>,
      opts?: { weekNfl?: NflState; leagueId?: string }
    ): Promise<Matchup | null> => {
      const stale = (): boolean => Boolean(opts?.weekNfl && nflWeekShifted(opts.weekNfl, liveNfl))
      const plan = espnCookiePlanNow()
      switch (plan) {
        case 'cached': {
          const nextCookies = espnCookieCache?.cookies ?? null
          cookies = nextCookies
          return fetchWith(nextCookies).catch((caught: unknown) => {
            markEspnAuth(caught)
            return null
          })
        }
        case 'await-cookies':
          return cookiePromise.then(async (nextCookies) => {
            if (stale()) return null
            cookies = nextCookies
            try {
              return await fetchWith(nextCookies)
            } catch (caught: unknown) {
              markEspnAuth(caught)
              return null
            }
          })
        case 'kick-then-refresh':
          return fetchWith(null)
            .catch((caught: unknown) => {
              markEspnAuth(caught)
              return null
            })
            .then(async (first) => {
              const retry = espnCookieRetryAfterScorePlan({
                compactHit: Boolean(opts?.leagueId && espnCompactLiveHit.get(opts.leagueId)),
                parsedHasLineup: matchupHasLineup(first)
              })
              switch (retry) {
                case 'skip':
                  return first
                case 'retry-auth': {
                  const nextCookies = await cookiePromise
                  if (stale()) return first
                  cookies = nextCookies
                  if (!nextCookies) return first
                  return fetchWith(nextCookies)
                }
                default: {
                  const _never: never = retry
                  return _never
                }
              }
            })
        default: {
          const _never: never = plan
          return _never
        }
      }
    }

    const earlyEspnPromise =
      hintLeague?.provider === 'espn'
        ? withEspnCookies((nextCookies) => kickEspnHud(hintLeague, nflState, nextCookies), {
            leagueId: hintLeague.id
          })
        : Promise.resolve(null)

    const diskHud = lastHudSnap
    const paintPlan = earlyDiskHudPlan({
      hasDiskHud: Boolean(
        hintLeague &&
          diskHud &&
          diskHud.selectedKey === leagueKey(hintLeague.provider, hintLeague.id) &&
          diskHud.displayWeek === nflState.displayWeek
      ),
      alreadyShowing: Boolean(
        diskHud &&
          lastState.selectedLeagueKey === diskHud.selectedKey &&
          lastState.matchup &&
          lastState.nfl?.displayWeek === diskHud.displayWeek
      )
    })
    switch (paintPlan) {
      case 'skip':
        break
      case 'paint':
        if (diskHud) publishEarlyHud(diskHud.matchup)
        break
      default: {
        const _never: never = paintPlan
        void _never
      }
    }

    namesPromise =
      replay || !settings.sleeperUsername
        ? Promise.resolve({} as Record<string, CachedPlayer>)
        : (() => {
            const dumpPlan = playerDumpDiskPlan(peekPlayerDumpReady(), liveTick)
            switch (dumpPlan) {
              case 'memory':
                kickDeferredNames = () => {
                  void getPlayerMap({ liveTick: false }).catch(() => undefined)
                }
                return Promise.resolve(peekPlayerMap())
              case 'disk':
                return new Promise<Record<string, CachedPlayer>>((resolve) => {
                  kickDeferredNames = () => {
                    void getPlayerMap({ liveTick })
                      .then(resolve)
                      .catch(() => resolve(peekPlayerMap()))
                  }
                })
              case 'skip':
                return Promise.resolve({} as Record<string, CachedPlayer>)
              default: {
                const _never: never = dumpPlan
                void _never
                return Promise.resolve({} as Record<string, CachedPlayer>)
              }
            }
          })()

    const waitForLeagueFetch = Boolean(opts?.waitForBoards)

    const startLeagueLists = (): {
      sleeper: Promise<League[]>
      espn: Promise<League[]>
    } => ({
      sleeper: loadSleeperLeagues(nflState, { waitForBoards: waitForLeagueFetch }),
      espn: (async () => {
        const plan = espnCookiePlanNow()
        switch (plan) {
          case 'cached': {
            const nextCookies = espnCookieCache?.cookies ?? null
            cookies = nextCookies
            return discoverEspnLeagues(nextCookies, nflState, { waitForBoards: waitForLeagueFetch })
          }
          case 'await-cookies': {
            const nextCookies = await cookiePromise
            cookies = nextCookies
            return discoverEspnLeagues(nextCookies, nflState, { waitForBoards: waitForLeagueFetch })
          }
          case 'kick-then-refresh': {
            const first = await discoverEspnLeagues(null, nflState, { waitForBoards: waitForLeagueFetch })
            if (!waitForLeagueFetch || espnUncachedDiscoveryPlan(first.length) === 'use-first') {
              return first
            }
            const nextCookies = await cookiePromise
            cookies = nextCookies
            if (!nextCookies) return first
            return discoverEspnLeagues(nextCookies, nflState, { waitForBoards: waitForLeagueFetch })
          }
          default: {
            const _never: never = plan
            return _never
          }
        }
      })()
    })

    const paintSelectedLive = (league: League, loaded: Matchup | null): void => {
      if (gen !== pollGen || !loaded) return
      publishEarlyHud(stampLive(league, loaded))
    }

    const publishRestBoard = (league: League, loaded: Matchup): void => {
      if (gen !== pollGen) return
      const stamped = stampLive(league, loaded)
      const key = leagueKey(league.provider, league.id)
      matchupCache.set(key, { at: Date.now(), matchup: stamped })
      const board = toMatchupBoard(league, stamped, espnBoardExtra(league))
      const boards = upsertMatchupBoard(lastState.boards, board)
      const leagues = lastState.leagues.some((row) => leagueKey(row.provider, row.id) === key)
        ? lastState.leagues
        : [...lastState.leagues, league]
      broadcast({
        ...lastState,
        nfl,
        leagues,
        boards,
        lastUpdated: Date.now(),
        pollMs: Date.now() - started,
        liveCallMs: recentLiveCallMs(recentFetchTimings()),
        pollingLive: lastState.pollingLive || calendarLive,
        error: null
      })
    }

    const restMatchupInFlight = new Map<string, Promise<Matchup | null>>()
    const restMatchupHud = new Set<string>()
    const kickRestMatchup = (league: League, hud = false): Promise<Matchup | null> => {
      const weekNfl = liveNfl
      const key = restMatchupFlightKey(league.provider, league.id, weekNfl.leagueSeason, weekNfl.displayWeek)
      const pending = restMatchupInFlight.get(key)
      const join = restHudJoinPlan({
        hasInFlight: pending != null,
        inFlightIsHud: restMatchupHud.has(key),
        hud
      })
      switch (join) {
        case 'join':
          return pending ?? Promise.resolve(null)
        case 'kick':
          break
        default: {
          const _never: never = join
          return _never
        }
      }
      const load = (): Promise<Matchup | null> => {
        if (league.provider === 'espn') {
          return withEspnCookies((nextCookies) => espnMatchup(league, weekNfl, nextCookies, undefined, hud, liveTick), {
            weekNfl,
            leagueId: league.id
          })
        }
        if (league.provider === 'sleeper') {
          return sleeperMatchup(league, weekNfl, hud, liveTick).then((loaded) => {
            if (loaded || sleeperUser) return loaded
            return ensureSleeperUser(hud, liveTick).then((user) => {
              if (!user) return null
              return sleeperMatchup(league, weekNfl, hud, liveTick)
            })
          })
        }
        const _never: never = league.provider
        return _never
      }
      const promise = load()
        .then((loaded) => {
          if (!loaded || nflWeekShifted(weekNfl, liveNfl)) return null
          publishRestBoard(league, loaded)
          return loaded
        })
        .catch(() => null)
      restMatchupInFlight.set(key, promise)
      if (hud) restMatchupHud.add(key)
      return promise
    }

    const prefetchRestBoards = (): Promise<void> => {
      if (replay) return Promise.resolve()
      const weekNfl = liveNfl
      const prefetch = restLeaguesToPrefetch({
        leagues: lastState.leagues,
        selectedKey: hintKey,
        pinnedKeys: settings.pinnedLeagueKeys,
        skipKeys: hintKey ? [hintKey] : [],
        season: weekNfl.leagueSeason,
        week: weekNfl.displayWeek,
        matchupAt: (key) => matchupCache.get(key)?.at,
        now: Date.now(),
        coldTtlMs: COLD_TTL_MS,
        includeCold: restPrefetchColdPlan(liveTick) === 'hot-and-cold'
      })
      return mapSettledLimit(prefetch, restLimit, kickRestMatchup).then(() => undefined)
    }

    const resyncIfNflWeekShifted = (fresh: NflState): void => {
      if (gen !== pollGen) return
      if (!nflWeekShifted(nflState, fresh)) return
      nfl = fresh
      liveNfl = fresh
      matchupCache.clear()
      scoreDisplayByKey.clear()
      const nextHintKey = hudHintKey(hintArgs)
      const nextHint =
        !replay && nextHintKey
          ? stubLeagueFromKey(nextHintKey, fresh.leagueSeason, fresh.displayWeek)
          : null
      const order = weekShiftKickOrder(nextHint != null)
      const kickHud = (): Promise<void> => {
        if (!nextHint) return Promise.resolve()
        switch (nextHint.provider) {
          case 'sleeper': {
            const kick = (user: SleeperUser | null): Promise<void> => {
              if (!user) return Promise.resolve()
              return sleeperMatchup(nextHint, fresh, true, liveTick)
                .then((loaded) => {
                  paintSelectedLive(nextHint, loaded)
                })
                .catch(() => undefined)
            }
            if (sleeperUser) return kick(sleeperUser)
            void sleeperMatchup(nextHint, fresh, true, liveTick).catch(() => undefined)
            return ensureSleeperUser(true, liveTick).then(kick)
          }
          case 'espn':
            return withEspnCookies((nextCookies) => kickEspnHud(nextHint, fresh, nextCookies), {
              weekNfl: fresh,
              leagueId: nextHint.id
            })
              .then((loaded) => {
                paintSelectedLive(nextHint, loaded)
              })
              .catch(markEspnAuth)
              .then(() => undefined)
          default: {
            const _never: never = nextHint.provider
            return _never
          }
        }
      }
      switch (order) {
        case 'hud-then-rest':
          void kickHud().finally(() => prefetchRestBoards())
          return
        case 'rest-only':
          prefetchRestBoards()
          return
        default: {
          const _never: never = order
          void _never
        }
      }
    }
    const awaitSelectedLive = holdForSelectedLive({
      hasHud: Boolean(matchup),
      waitForBoards: Boolean(opts?.waitForBoards),
      replay
    })

    if (hintLeague?.provider === 'sleeper') {
      if (awaitSelectedLive) {
        paintSelectedLive(hintLeague, await earlySleeperPromise)
      } else {
        void earlySleeperPromise.then((loaded) => paintSelectedLive(hintLeague, loaded))
      }
    }

    if (hintLeague?.provider === 'espn') {
      if (awaitSelectedLive) {
        paintSelectedLive(hintLeague, await earlyEspnPromise)
      } else {
        void earlyEspnPromise.then((loaded) => paintSelectedLive(hintLeague, loaded))
      }
    }

    let restPrefetchDone = Promise.resolve()
    const paintSleeperEstimates = (pts: Record<string, number> | null): void => {
      if (gen !== pollGen || replay) return
      const apply = (loaded: Matchup): Matchup => applySleeperWinEstimate(loaded, pts)
      for (const [key, row] of matchupCache) {
        const parsed = parseLeagueKey(key)
        if (parsed?.provider !== 'sleeper') continue
        matchupCache.set(key, { at: row.at, matchup: apply(row.matchup) })
      }
      let nextMatchup = lastState.matchup
      const selectedKey = lastState.selectedLeagueKey
      if (selectedKey && parseLeagueKey(selectedKey)?.provider === 'sleeper' && nextMatchup) {
        nextMatchup = apply(nextMatchup)
        matchup = nextMatchup
        persistSelectedHud(selectedKey, nextMatchup)
      }
      let boards = lastState.boards
      for (const league of lastState.leagues) {
        if (league.provider !== 'sleeper') continue
        const key = leagueKey(league.provider, league.id)
        const loaded = (selectedKey === key ? nextMatchup : null) ?? matchupCache.get(key)?.matchup
        if (!loaded) continue
        boards = upsertMatchupBoard(boards, toMatchupBoard(league, loaded, espnBoardExtra(league)))
      }
      broadcast({
        ...lastState,
        matchup: nextMatchup,
        boards,
        lastUpdated: Date.now()
      })
    }
    const kickFatSwr = (): void => {
      if (!replay) {
        void getSleeperProjectionPts({
          season: liveNfl.leagueSeason,
          week: liveNfl.displayWeek,
          seasonType: liveNfl.seasonType
        })
          .then((result) => {
            if (result.refreshed) paintSleeperEstimates(result.pts)
          })
          .catch(() => undefined)
      }
      const parts = sleeperFatSwrPartsPlan({
        liveTick,
        hasPlayerPeek: peekPlayerDumpReady(),
        hasSleeperLeagues: sleeperLeaguesCache != null,
        hasEspnLeagues: espnLeaguesCache != null
      })
      void (async () => {
        if (parts.user) await kickSleeperUserSwr(gen, liveTick)
        if (parts.roster) await kickPendingRosterSwr(restLimit, liveTick)
        const boxscoreDrain = espnDeferredBoxscoreDrainPlan(liveTick)
        switch (boxscoreDrain) {
          case 'hold':
            break
          case 'drain':
            if (pendingEspnFullSwr.size > 0) {
              const ids = [...pendingEspnFullSwr]
              pendingEspnFullSwr.clear()
              await mapSettledLimit(ids, restLimit, async (id) => {
            if (gen !== pollGen) return
            const league =
              lastState.leagues.find((row) => row.provider === 'espn' && row.id === id) ??
              stubLeagueFromKey(leagueKey('espn', id), liveNfl.leagueSeason, liveNfl.displayWeek)
            if (!league) return
            const teamId = myEspnTeamId(id, cookies)
            const cached = espnScoreCache.get(id)
            const fresh = espnBoxscoreSwrFreshPlan({
              cachedWeek: cached?.week,
              week: liveNfl.displayWeek,
              cachedAt: cached?.at,
              now: Date.now(),
              ttlMs: ESPN_SCORE_TTL_MS
            })
            let payload: unknown
            switch (fresh) {
              case 'use-cache':
                payload = cached?.payload
                break
              case 'fetch':
                payload = await heldEspnGet(
                  espnScoreRefresh,
                  espnScoreRefreshKey({
                    leagueId: id,
                    week: liveNfl.displayWeek,
                    hasCookies: Boolean(cookies),
                    hud: false,
                    teamId: teamId ?? null,
                    bust: sleeperCdnBustToken(Date.now(), ESPN_SCORE_TTL_MS)
                  }),
                  false,
                  () =>
                    fetchLeague({
                      season: liveNfl.leagueSeason,
                      leagueId: id,
                      cookies,
                      views: SCORE_VIEWS,
                      scoringPeriodId: liveNfl.displayWeek,
                      filter:
                        teamId != null
                          ? weekTeamScheduleFilter(liveNfl.displayWeek, teamId)
                          : weekScheduleFilter(liveNfl.displayWeek),
                      ...backgroundFetch(liveTick)
                    }).then((body) => {
                      rememberEspnScorePayload(id, liveNfl.displayWeek, body)
                      return body
                    })
                )
                break
              default: {
                const _never: never = fresh
                void _never
                return
              }
            }
            if (gen !== pollGen || payload == null) return
            const key = leagueKey('espn', id)
            const prev =
              (lastState.selectedLeagueKey === key ? lastState.matchup : null) ??
              matchupCache.get(key)?.matchup ??
              null
            const next = paintEspnBoxscoreSwr({
              leagueId: id,
              payload,
              prev,
              cookies,
              displayWeek: liveNfl.displayWeek
            })
            if (!next) return
            if (lastState.selectedLeagueKey === key) {
              paintSelectedLive(league, next)
            } else {
              publishRestBoard(league, next)
            }
              })
            }
            break
          default: {
            const _never: never = boxscoreDrain
            void _never
          }
        }
        if (gen !== pollGen) return
        if (parts.names) kickDeferredNames()
        if (parts.leagues) {
          kickSleeperLeaguesSwr(liveNfl, gen)
          void cookiePromise.then((nextCookies) => {
            if (gen !== pollGen) return
            cookies = nextCookies
            kickEspnDiscoverySwr(nextCookies, liveNfl, gen)
          })
        }
      })()
    }
    const kickBackgroundSwr = (): void => {
      const hydratePlan = matchupsDiskHydratePlan(hintLeague != null, liveTick)
      switch (hydratePlan) {
        case 'after-hud':
          if (!replay) persistAfterPaint(() => hydrateMatchupsFromDisk(liveNfl.displayWeek))
          break
        case 'now':
          if (!replay) hydrateMatchupsFromDisk(liveNfl.displayWeek)
          break
        case 'skip':
          break
        default: {
          const _never: never = hydratePlan
          void _never
        }
      }
      const prefetchGate = restPrefetchGate(hintKey)
      let restPromise = Promise.resolve()
      switch (prefetchGate) {
        case 'now':
          restPromise = prefetchRestBoards()
          break
        case 'after-selected':
          break
        default: {
          const _never: never = prefetchGate
          void _never
        }
      }
      restPrefetchDone = restPromise
      kickNflStateSwr(resyncIfNflWeekShifted, liveTick)
      kickEspnCookieSwr(liveTick)
    }
    const afterSelected = afterSelectedSettlePlan({
      hasSelectedHint: hintLeague != null,
      holdSelected: awaitSelectedLive
    })
    switch (afterSelected) {
      case 'now':
        kickBackgroundSwr()
        break
      case 'after-selected': {
        if (!hintLeague) {
          kickBackgroundSwr()
          break
        }
        switch (hintLeague.provider) {
          case 'sleeper':
            void earlySleeperPromise.finally(() => kickBackgroundSwr())
            break
          case 'espn':
            void earlyEspnPromise.finally(() => kickBackgroundSwr())
            break
          default: {
            const _never: never = hintLeague.provider
            void _never
          }
        }
        break
      }
      default: {
        const _never: never = afterSelected
        void _never
      }
    }

    const hudPainted = Boolean(matchup)

    const settleBoards = async (): Promise<AppState> => {
    switch (afterSelected) {
      case 'now':
        break
      case 'after-selected': {
        if (!hintLeague) break
        switch (hintLeague.provider) {
          case 'sleeper':
            await earlySleeperPromise.catch(() => null)
            break
          case 'espn':
            await earlyEspnPromise.catch(() => null)
            break
          default: {
            const _never: never = hintLeague.provider
            void _never
          }
        }
        break
      }
      default: {
        const _never: never = afterSelected
        void _never
      }
    }
    const boardPlan = nflScoreboardKickPlan(liveTick)
    const seeded = seedScoreboardState({
      lastLive: lastState.pollingLive,
      lastTicker: lastState.nflTicker,
      calendarLive
    })
    let live = seeded.live
    let nflTicker = seeded.ticker
    const replayBoard = (): Promise<{ live: boolean; ticker: ReturnType<typeof replayNflTicker> }> =>
      Promise.resolve({ live: true, ticker: replayNflTicker() })
    const applyScoreboard = (scoreboard: { live: boolean; ticker: ReturnType<typeof replayNflTicker> }): void => {
      if (gen !== pollGen) return
      const nextLive = scoreboardPollLive({ gamesIn: scoreboard.live, calendarLive })
      const sameLive = nextLive === live
      const sameTicker = scoreboard.ticker === nflTicker
      live = nextLive
      nflTicker = scoreboard.ticker
      const scheduledLive = lastState.pollingLive || calendarLive
      const settleSchedule = restSettleSchedulePlan({
        hudScheduled: hudPainted,
        nextLive,
        scheduledLive
      })
      switch (settleSchedule) {
        case 'schedule':
          schedule(nextLive, Date.now() - started)
          break
        case 'skip':
          break
        default: {
          const _never: never = settleSchedule
          void _never
        }
      }
      if (sameLive && sameTicker) return
      broadcast({
        ...lastState,
        nflTicker,
        pollingLive: live,
        lastUpdated: Date.now()
      })
    }
    let scoreboardPromise: Promise<{ live: boolean; ticker: ReturnType<typeof replayNflTicker> }> =
      Promise.resolve({ live: calendarLive, ticker: [] })
    const scoreboardOrder = nflScoreboardSettleOrder(boardPlan)
    switch (scoreboardOrder) {
      case 'before-lists':
        scoreboardPromise = replay ? replayBoard() : nflScoreboardState(calendarLive, liveTick)
        void scoreboardPromise.then(applyScoreboard).catch(() => undefined)
        break
      case 'after-pinned-rest':
        break
      default: {
        const _never: never = scoreboardOrder
        void _never
      }
    }
    const listPlan = leagueListFetchPlan(hintLeague != null)
    switch (listPlan) {
      case 'after-hud':
      case 'now':
        break
      default: {
        const _never: never = listPlan
        void _never
      }
    }
    const { sleeper: sleeperLeaguesPromise, espn: espnLeaguesPromise } = startLeagueLists()
    const listHud = firstListHudPlan({ hasHint: hintLeague != null, hasHud: hudPainted })
    let listHudKicked = false
    const kickFirstListHud = (rows: League[]): void => {
      if (gen !== pollGen) return
      const first = rows.find((league) => isLiveLeagueId(league.id))
      const kick = firstListHudKickPlan({
        alreadyKicked: listHudKicked,
        hasHud: Boolean(matchup),
        hasLiveLeague: first != null
      })
      switch (kick) {
        case 'skip':
          return
        case 'kick': {
          if (!first) return
          listHudKicked = true
          void kickRestMatchup(first, true)
            .then((loaded) => {
              if (!loaded || matchup) return
              paintSelectedLive(first, loaded)
            })
            .catch(() => undefined)
          return
        }
        default: {
          const _never: never = kick
          void _never
        }
      }
    }
    switch (listHud) {
      case 'kick-on-list':
        void sleeperLeaguesPromise.then(kickFirstListHud).catch(() => undefined)
        void espnLeaguesPromise.then(kickFirstListHud).catch(() => undefined)
        break
      case 'skip':
        break
      default: {
        const _never: never = listHud
        void _never
      }
    }
    const listSettle = leagueListSettlePlan({
      liveTick,
      hasLastLeagues: lastState.leagues.length > 0,
      waitForBoards: waitForLeagueFetch
    })
    const lastSleeperLeagues = lastState.leagues.filter((row) => row.provider === 'sleeper')
    const lastEspnLeagues = lastState.leagues.filter((row) => row.provider === 'espn')
    let sleeperLeagues: League[]
    let espnLeagues: League[]
    let earlyEspnMatchup: Matchup | null
    let earlySleeperMatchup: Matchup | null
    let nextCookies: EspnCookies | null
    switch (listSettle) {
      case 'peek-last':
        ;[sleeperLeagues, espnLeagues, earlyEspnMatchup, earlySleeperMatchup, nextCookies] =
          await Promise.all([
            peekSettled(sleeperLeaguesPromise, lastSleeperLeagues),
            peekSettled(espnLeaguesPromise, lastEspnLeagues),
            peekSettled(earlyEspnPromise, null),
            peekSettled(earlySleeperPromise, null),
            peekSettled(cookiePromise, espnCookieCache?.cookies ?? null)
          ])
        break
      case 'await':
        ;[sleeperLeagues, espnLeagues, earlyEspnMatchup, earlySleeperMatchup, nextCookies] =
          await Promise.all([
            sleeperLeaguesPromise,
            espnLeaguesPromise,
            peekSettled(earlyEspnPromise, null),
            peekSettled(earlySleeperPromise, null),
            peekSettled(cookiePromise, espnCookieCache?.cookies ?? null)
          ])
        break
      default: {
        const _never: never = listSettle
        void _never
        sleeperLeagues = lastSleeperLeagues
        espnLeagues = lastEspnLeagues
        earlyEspnMatchup = null
        earlySleeperMatchup = null
        nextCookies = espnCookieCache?.cookies ?? null
      }
    }
    cookies = nextCookies
    void cookiePromise.then((resolved) => {
      if (gen !== pollGen) return
      cookies = resolved
    })
    if (gen !== pollGen) return lastState
    leagues = [...sleeperLeagues, ...espnLeagues]

    const pinnedKeys = replay
      ? leagues.map((league) => leagueKey(league.provider, league.id))
      : settings.pinnedLeagueKeys

    const leagueKeys = leagues.map((league) => leagueKey(league.provider, league.id))
    const selectedKey = pickSelectedLeagueKey({
      settingsKey: settings.selectedLeagueKey,
      leagueKeys,
      pinnedKeys,
      hintKey,
      featuredKey: FEATURED_LEAGUE_KEY
    })
    if (selectedKey && selectedKey !== settings.selectedLeagueKey) {
      saveSettings({ selectedLeagueKey: selectedKey })
    }

    const selectedKeyHot = selectedKey
    const txTargets = leagues.filter((league) => {
      const key = leagueKey(league.provider, league.id)
      return key === selectedKeyHot || pinnedKeys.includes(key)
    })
    const boardTargets = leagues.length > 0 ? leagues : []
    const txLeagues = txTargets.length > 0 ? txTargets : boardTargets
    const split = replay
      ? splitHotCold(boardTargets, selectedKey, boardTargets.map((league) => leagueKey(league.provider, league.id)))
      : splitHotCold(boardTargets, selectedKey, pinnedKeys)
    const selected = split.selected
    const hot = split.hot
    const cold = split.cold
    const matchupByKey = new Map<string, Matchup>()
    for (const league of boardTargets) {
      const key = leagueKey(league.provider, league.id)
      const cached = matchupCache.get(key)
      if (cached) matchupByKey.set(key, cached.matchup)
    }
    if (selected) {
      const key = leagueKey(selected.provider, selected.id)
      const hinted =
        hintLeague != null && key === leagueKey(hintLeague.provider, hintLeague.id)
      if (hinted && selected.provider === 'espn' && earlyEspnMatchup) {
        matchupByKey.set(key, stampLive(selected, earlyEspnMatchup))
      } else if (hinted && selected.provider === 'sleeper' && earlySleeperMatchup) {
        matchupByKey.set(key, stampLive(selected, earlySleeperMatchup))
      } else if (lastState.matchup && lastState.selectedLeagueKey === key) {
        matchupByKey.set(key, lastState.matchup)
      }
    }

    const coldDue = cold.filter((league) => {
      const cached = matchupCache.get(leagueKey(league.provider, league.id))
      return !cached || Date.now() - cached.at > COLD_TTL_MS
    })
    const pinnedRest = hot.filter((league) => leagueKey(league.provider, league.id) !== selectedKey)
    const selectedReady = selected
      ? matchupByKey.get(leagueKey(selected.provider, selected.id))
      : undefined
    const earlyTriedSame =
      hintLeague != null &&
      selected != null &&
      leagueKey(hintLeague.provider, hintLeague.id) === leagueKey(selected.provider, selected.id)
    const fallback = selectedFallbackPlan({
      hasSelected: selected != null,
      selectedReady: selectedReady != null,
      earlyTriedSame
    })
    if (fallback === 'kick' && selected) {
      try {
        const paintBoxscore = (boxscore: Matchup): void => {
          if (gen !== pollGen) return
          publishEarlyHud(stampLive(selected, boxscore, true))
        }
        const flightKey = restMatchupFlightKey(
          selected.provider,
          selected.id,
          liveNfl.leagueSeason,
          liveNfl.displayWeek
        )
        const join = restHudJoinPlan({
          hasInFlight: restMatchupInFlight.has(flightKey),
          inFlightIsHud: restMatchupHud.has(flightKey),
          hud: true
        })
        let pending: Promise<Matchup | null> | undefined
        switch (join) {
          case 'join':
            pending = restMatchupInFlight.get(flightKey)
            break
          case 'kick':
            pending = kickRestMatchup(selected, true)
            break
          default: {
            const _never: never = join
            void _never
          }
        }
        const loaded = pending ? await pending : null
        if (loaded) {
          matchupByKey.set(leagueKey(selected.provider, selected.id), loaded)
          paintBoxscore(loaded)
        }
      } catch {
        // selected board stays empty if this league fails
      }
    }
    const settleHud = (): Matchup | null =>
      settleMatchupPlan({
        selectedMatchup: selected
          ? (matchupByKey.get(leagueKey(selected.provider, selected.id)) ?? null)
          : null,
        liveMatchup: matchup,
        lastMatchup: lastState.matchup,
        selectedKey,
        lastKey: lastState.selectedLeagueKey,
        liveKey: liveHudKey
      })
    matchup = settleHud()
    if (selected && matchup) {
      matchupByKey.set(leagueKey(selected.provider, selected.id), matchup)
    }
    const prefetchAwait = restPrefetchAwaitPlan({
      liveTick,
      waitForBoards: waitForLeagueFetch
    })
    switch (prefetchAwait) {
      case 'await':
        await restPrefetchDone
        break
      case 'skip':
        break
      default: {
        const _never: never = prefetchAwait
        void _never
      }
    }
    const loadRestBoard = async (league: League) => {
      const loaded = await kickRestMatchup(league)
      return [leagueKey(league.provider, league.id), loaded] as const
    }
    const pinnedPromise = mapSettledLimit(pinnedRest, restLimit, loadRestBoard)
    switch (boardPlan) {
      case 'after-pinned':
        scoreboardPromise = replay
          ? replayBoard()
          : pinnedPromise.then(() => nflScoreboardState(calendarLive, liveTick))
        void scoreboardPromise.then(applyScoreboard).catch(() => undefined)
        break
      case 'after-hud':
        break
      default: {
        const _never: never = boardPlan
        void _never
      }
    }

    const publish = (tape: TapeEvent[]): AppState => {
      if (gen !== pollGen) return lastState
      const boards = leagues.map((league) =>
        toMatchupBoard(
          league,
          matchupByKey.get(leagueKey(league.provider, league.id)) ?? null,
          espnBoardExtra(league, replay ? replayBoardMeta(league) : undefined)
        )
      )
      const publishKey = settleSelectedKeyPlan({
        discoveredKey: selectedKey,
        lastKey: lastState.selectedLeagueKey
      })
      const state: AppState = {
        sleeperConnected: replay || Boolean(sleeperUser),
        sleeperUsername: replay ? 'sideline-demo' : settings.sleeperUsername,
        espnConnected: espnConnectedPlan({
          replay,
          hasCookies: Boolean(cookies),
          lastConnected: lastState.espnConnected,
          unauthorized: espnNeedsRelogin
        }),
        espnNeedsRelogin: replay ? false : espnNeedsRelogin,
        nfl,
        leagues,
        pinnedLeagueKeys: pinnedKeys,
        selectedLeagueKey: publishKey,
        matchup,
        boards,
        tape,
        nflTicker,
        overlayPort: runtime.overlayPort(),
        overlayVisible,
        overlayHotkey: settings.overlayHotkey,
        overlayEditMode,
        overlayLayout: settings.overlayLayout,
        lastToast,
        ...lanFields(),
        replay,
        lastUpdated: Date.now(),
        pollMs: Date.now() - started,
        liveCallMs: recentLiveCallMs(recentFetchTimings()),
        pollingLive: live,
        error
      }
      persistSelectedHud(publishKey, matchup)
      broadcast(state)
      return state
    }

    const earlyScored: TapeEvent[] = []
    if (selected && matchup) {
      earlyScored.push(...scoreTapeFromDiff(selected, matchup, prevPlayerPts))
      earlyScored.push(...injuryTapeFromDiff(selected, matchup, prevInjury))
    }
    liveTape = mergeTape(earlyScored, liveTape, 24)
    const hudState = publish(mergeTape(liveTape, replay ? replaySeedTape() : [], 32))
    const snapshotSchedule = restSettleSchedulePlan({
      hudScheduled: hudPainted,
      nextLive: live,
      scheduledLive: lastState.pollingLive || calendarLive
    })
    switch (snapshotSchedule) {
      case 'schedule':
        schedule(live, Date.now() - started)
        break
      case 'skip':
        break
      default: {
        const _never: never = snapshotSchedule
        void _never
      }
    }

    const applyTransactions = async (): Promise<AppState> => {
      const peekedCookies = espnCookieCache?.cookies ?? cookies
      const txCookies = await peekSettled(cookiePromise, peekedCookies)
      cookies = txCookies
      const players = sleeperMemoryNames()
      let espnTxHit = false
      const loadTape = async (nextCookies: EspnCookies | null): Promise<AppState> => {
        const snapshotTape: TapeEvent[] = []
        const txSettled = await mapSettledLimit(txLeagues, restLimit, async (league) => {
          try {
            return { league, rows: await loadTransactionsCached(league, liveNfl, nextCookies, players, liveTick) }
          } catch {
            return { league, rows: [] as Transaction[] }
          }
        })
        if (gen !== pollGen) return lastState
        for (const row of txSettled) {
          if (row.status !== 'fulfilled') continue
          const { league, rows } = row.value
          if (league.provider === 'espn' && rows.length > 0) espnTxHit = true
          emitNewTransactions(league, rows)
          for (const event of rows) snapshotTape.push(transactionToTape(league, event))
        }
        return publish(mergeTape(lastState.tape, [...(replay ? replaySeedTape() : []), ...snapshotTape], 32))
      }
      const first = await loadTape(txCookies)
      const retryPlan = espnTxCookieRetryPlan({
        cookiePlan: espnCookiePlanNow(),
        peekedCookies: Boolean(txCookies),
        publicHit: espnTxHit
      })
      switch (retryPlan) {
        case 'skip-retry':
          break
        case 'retry-when-cookies':
          void cookiePromise.then((nextCookies) => {
            if (gen !== pollGen || !nextCookies) return
            cookies = nextCookies
            for (const league of txLeagues) {
              if (league.provider === 'espn') txCache.delete(leagueKey(league.provider, league.id))
            }
            void loadTape(nextCookies).catch(() => undefined)
          })
          break
        default: {
          const _never: never = retryPlan
          void _never
        }
      }
      return first
    }

    const finishRest = async (): Promise<AppState> => {
      try {
        const absorbRows = (
          rows: PromiseSettledResult<readonly [string, Matchup | null]>[]
        ): void => {
          for (const row of rows) {
            if (row.status !== 'fulfilled' || !row.value[1]) continue
            matchupByKey.set(row.value[0], row.value[1])
          }
        }
        const pinnedRows = await pinnedPromise
        if (gen !== pollGen) return lastState
        absorbRows(pinnedRows)
        if (!replay) {
          const txPlan = restTxKickPlan(liveTick)
          switch (txPlan) {
            case 'after-pinned':
              await applyTransactions().catch(() => undefined)
              break
            case 'skip':
              break
            default: {
              const _never: never = txPlan
              void _never
            }
          }
        }
        const coldPlan = restPrefetchColdPlan(liveTick)
        switch (coldPlan) {
          case 'hot-and-cold': {
            const coldRows = await mapSettledLimit(coldDue, restLimit, loadRestBoard)
            if (gen !== pollGen) return lastState
            absorbRows(coldRows)
            break
          }
          case 'hot-only':
            break
          default: {
            const _never: never = coldPlan
            void _never
          }
        }
      const applySleeperNames = (sleeperNames: Record<string, CachedPlayer>): void => {
        if (!peekPlayerDumpReady()) return
        for (const league of leagues) {
          if (league.provider !== 'sleeper') continue
          const key = leagueKey(league.provider, league.id)
          const loaded = matchupByKey.get(key)
          if (!loaded) continue
          const named = applyPlayerNames(loaded, sleeperNames)
          matchupByKey.set(key, named)
          if (tickedThisPoll.has(key)) tickedThisPoll.set(key, named)
        }
      }
      applySleeperNames(sleeperMemoryNames())
      for (const league of leagues) {
        const key = leagueKey(league.provider, league.id)
        const loaded = matchupByKey.get(key)
        if (loaded) matchupByKey.set(key, stampLive(league, loaded))
      }
      for (const [key, loaded] of matchupByKey) {
        matchupCache.set(key, { at: Date.now(), matchup: loaded })
      }
      matchup = settleHud()

      const scored: TapeEvent[] = []
      for (const league of txLeagues) {
        const loaded = matchupByKey.get(leagueKey(league.provider, league.id))
        if (loaded) {
          scored.push(...scoreTapeFromDiff(league, loaded, prevPlayerPts))
          scored.push(...injuryTapeFromDiff(league, loaded, prevInjury))
        }
      }
      liveTape = mergeTape(scored, liveTape, 24)
      const published = publish(mergeTape(liveTape, replay ? replaySeedTape() : [], 32))
      if (!replay) {
        const persistPlan = liveMatchupsPersistPlan(liveTick)
        switch (persistPlan) {
          case 'after-paint':
            persistMatchups(liveNfl.displayWeek)
            break
          case 'skip':
            break
          default: {
            const _never: never = persistPlan
            void _never
          }
        }
      }
      const hydrate = sleeperRestNameHydratePlan()
      switch (hydrate) {
        case 'after-publish':
          if (settings.sleeperUsername) {
            void namesPromise
              .then((sleeperNames) => {
                if (gen !== pollGen) return
                applySleeperNames(sleeperNames)
                for (const league of leagues) {
                  if (league.provider !== 'sleeper') continue
                  const key = leagueKey(league.provider, league.id)
                  const loaded = matchupByKey.get(key)
                  if (loaded) matchupCache.set(key, { at: Date.now(), matchup: loaded })
                }
                matchup = settleHud()
                publish(lastState.tape)
              })
              .catch(() => undefined)
          }
          break
        default: {
          const _never: never = hydrate
          void _never
        }
      }
      if (replay) return applyTransactions()
      const fatPlan = sleeperFatSwrPlan()
      switch (fatPlan) {
        case 'after-tx':
          kickFatSwr()
          break
        default: {
          const _never: never = fatPlan
          void _never
        }
      }
      return published
      } catch {
        kickFatSwr()
        return lastState
      }
    }

    if (replay) {
      const state = await finishRest()
      bumpReplayTick()
      return state
    }
    void finishRest().catch(() => undefined)
    return hudState
    }

    if (replay || opts?.waitForBoards || !hudPainted) {
      return settleBoards()
    }
    schedule(lastState.pollingLive || calendarLive, Date.now() - started)
    const pending = settleBoards()
    boardsTail = pending
    void pending.catch(() => undefined).finally(() => {
      if (boardsTail === pending) boardsTail = null
    })
    return lastState
  } catch (caught) {
    error = caught instanceof Error ? caught.message : 'Refresh failed'
    const state: AppState = {
      ...lastState,
      sleeperConnected: replay || Boolean(sleeperUser) || lastState.sleeperConnected,
      sleeperUsername: loadSettings().sleeperUsername,
      espnConnected: espnConnectedPlan({
        replay,
        hasCookies: Boolean(espnCookieCache?.cookies),
        lastConnected: lastState.espnConnected,
        unauthorized: espnNeedsRelogin
      }),
      espnNeedsRelogin,
      overlayPort: runtime.overlayPort(),
      overlayVisible,
      overlayHotkey: loadSettings().overlayHotkey,
      overlayEditMode,
      overlayLayout: loadSettings().overlayLayout,
      lastToast,
      ...lanFields(),
      replay,
      error
    }
    broadcast(state)
    schedule(false, Date.now() - started)
    return state
  }
}

const schedule = (live: boolean, elapsedMs: number): void => {
  if (timer) clearTimeout(timer)
  const interval = isReplayMode() ? 3_000 : pollIntervalMs(live)
  timer = setTimeout(() => {
    void refresh()
  }, nextPollDelayMs(interval, elapsedMs))
}

export const warmupPollerCaches = (): void => {
  if (!isReplayMode()) {
    const settings = loadSettings()
    const stripped = stripReplayLeagueKeys(settings)
    if (
      stripped.selectedLeagueKey !== settings.selectedLeagueKey ||
      stripped.pinnedLeagueKeys.join('\0') !== settings.pinnedLeagueKeys.join('\0') ||
      stripped.espnLeagueIds.join('\0') !== settings.espnLeagueIds.join('\0')
    ) {
      saveSettings({
        selectedLeagueKey: stripped.selectedLeagueKey,
        pinnedLeagueKeys: stripped.pinnedLeagueKeys,
        espnLeagueIds: stripped.espnLeagueIds
      })
    }
  }
  hydrateEspnScoresFromDisk()
  hydrateEspnTeamsFromDisk()
  hydrateSleeperRostersFromDisk()
  hydratePlayerMapFromDisk()
  const nflDisk = readNflDisk()
  const nflPlan = warmupNflCachePlan({ hasNflDisk: Boolean(nflDisk), replay: isReplayMode() })
  switch (nflPlan) {
    case 'disk':
      if (nflDisk && !nflStateCache) {
        nflStateCache = { at: Date.now() - NFL_TTL_MS, nfl: nflDisk }
      }
      break
    case 'calendar':
      if (!nflStateCache) {
        nflStateCache = {
          at: Date.now() - NFL_TTL_MS,
          nfl: nflCalendarSeed(new Date(), peekLastHud()?.displayWeek)
        }
      }
      break
    case 'skip':
      break
    default: {
      const _never: never = nflPlan
      void _never
    }
  }
  if (nflStateCache) hydrateMatchupsFromDisk(nflStateCache.nfl.displayWeek)
  if (nflStateCache) {
    hydrateSleeperProjectionsFromDisk({
      season: nflStateCache.nfl.leagueSeason,
      week: nflStateCache.nfl.displayWeek,
      seasonType: nflStateCache.nfl.seasonType
    })
  }
  if (!isReplayMode() && nflStateCache) {
    const nfl = nflStateCache.nfl
    hydrateSleeperLeaguesFromDisk(nfl)
    hydrateEspnLeaguesFromDisk(nfl)
    const settings = loadSettings()
    if (settings.sleeperUsername && settings.sleeperUserId && !sleeperUser) {
      sleeperUser = { user_id: settings.sleeperUserId, username: settings.sleeperUsername }
    }
    const leagues = warmupLeaguesFromDisk({
      nfl,
      sleeperLeagues: sleeperLeaguesCache?.leagues ?? [],
      espnLeagues: espnLeaguesCache?.leagues ?? [],
      espnLeagueIds: settings.espnLeagueIds
    })
    const lastHud = peekLastHud()
    if (
      lastHud &&
      isLiveLeagueKey(lastHud.selectedKey) &&
      lastHud.displayWeek === nfl.displayWeek &&
      !matchupCache.has(lastHud.selectedKey)
    ) {
      matchupCache.set(lastHud.selectedKey, { at: Date.now() - COLD_TTL_MS, matchup: lastHud.matchup })
    }
    const matchupsByKey: Record<string, Matchup> = {}
    for (const [key, row] of matchupCache) matchupsByKey[key] = row.matchup
    const selectedKey = settings.selectedLeagueKey
    const matchup = warmupMatchupFromDisk({
      selectedKey,
      displayWeek: nfl.displayWeek,
      lastHud,
      matchupsByKey
    })
    lastState = {
      ...emptyAppState(),
      sleeperConnected: Boolean(settings.sleeperUsername),
      sleeperUsername: settings.sleeperUsername,
      espnConnected: Boolean(espnCookieCache?.cookies),
      nfl,
      leagues,
      pinnedLeagueKeys: settings.pinnedLeagueKeys,
      selectedLeagueKey: selectedKey,
      matchup,
      boards: leagues.map((league) => {
        const key = leagueKey(league.provider, league.id)
        const cached = matchupCache.get(key)?.matchup ?? null
        return toMatchupBoard(
          league,
          key === selectedKey ? matchup ?? cached : cached,
          espnBoardExtra(league)
        )
      }),
      overlayHotkey: settings.overlayHotkey,
      overlayLayout: settings.overlayLayout,
      lastUpdated: Date.now(),
      ...lanFields()
    }
  }
  void loadEspnCookies()
}

export const publishWarmupState = (): void => {
  if (isReplayMode()) return
  if (!lastState.matchup && lastState.boards.length === 0) return
  lastState = { ...lastState, overlayPort: runtime.overlayPort(), ...lanFields() }
  broadcast(lastState)
}

export const stopPoller = (): void => {
  if (timer) clearTimeout(timer)
  timer = null
}

export const resetPollerForTests = (): void => {
  stopPoller()
  pollGen += 1
  inFlight = null
  inFlightSelectedKey = null
  boardsTail = null
  lastState = emptyAppState()
  lastPushedHud = null
  sleeperUser = null
  sleeperUserVerified = false
  sleeperUserInFlight = null
  pendingRosterSwr.clear()
  pendingEspnFullSwr.clear()
  nflStateCache = null
  nflStateInFlight = null
  lastHudMem = undefined
  lastHudSig = ''
  lastMatchupsSig = ''
  matchupCache.clear()
  scoreDisplayByKey.clear()
  txCache.clear()
  sleeperLeaguesCache = null
  sleeperRosterCache.clear()
  sleeperIdentityHold.clear()
  sleeperMatchupsHold.clear()
  espnLeaguesCache = null
  espnTeamCache.clear()
  espnScoreCache.clear()
  espnLiveCache.clear()
  espnScoreRefresh.clear()
  espnScoreFetchGen.clear()
  espnCompactLiveHit.clear()
  espnCompactLiveHold.clear()
  espnTeamFetch.clear()
  espnCookieCache = null
  espnCookieInFlight = null
  espnDiscoveryInFlight = null
  sleeperLeaguesInFlight = null
  espnScoresHydrated = false
  espnTeamsHydrated = false
  espnLeaguesHydrated = false
  sleeperRostersHydrated = false
  sleeperLeaguesHydrated = false
  matchupsHydrated = false
  liveTape = []
  espnNeedsRelogin = false
  resetSleeperProjectionsCache()
}

export const startPoller = (): void => {
  void refresh()
}

export const connectSleeper = async (username: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    if (isReplayMode()) {
      saveSettings({ sleeperUsername: username })
      await refresh({ waitForBoards: true })
      return { ok: true }
    }
    const user = await getUser(username.trim(), {
      timeoutMs: LIVE_FETCH_MS,
      retries: 1,
      cacheBust: sleeperCdnBustToken(Date.now(), SLEEPER_USER_CDN_MS)
    })
    if (!user?.user_id) return { ok: false, error: 'Sleeper user not found' }
    rememberSleeperUser(user, username.trim())
    saveSettings({ sleeperUsername: username.trim(), sleeperUserId: user.user_id })
    await refresh({ waitForBoards: true })
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Sleeper lookup failed' }
  }
}

export const disconnectSleeper = async (): Promise<void> => {
  sleeperUser = null
  sleeperUserVerified = false
  lastState = { ...lastState, sleeperConnected: false, sleeperUsername: null }
  pendingRosterSwr.clear()
  sleeperLeaguesCache = null
  sleeperLeaguesHydrated = true
  writeSleeperLeaguesDisk({ username: '', season: '', leagues: [] })
  sleeperRosterCache.clear()
  sleeperIdentityHold.clear()
  sleeperMatchupsHold.clear()
  sleeperRostersHydrated = true
  writeSleeperRostersDisk({})
  dropCachedMatchups('sleeper')
  txCache.clear()
  saveSettings({ sleeperUsername: null, sleeperUserId: null })
  await refresh({ waitForBoards: true })
}

export const markEspnRelogin = (needed: boolean): void => {
  espnNeedsRelogin = needed
}

export const addEspnLeagueId = async (leagueId: string): Promise<{ ok: boolean; error?: string }> => {
  const id = leagueId.trim()
  if (!/^\d+$/.test(id)) return { ok: false, error: 'League ID should be numeric' }
  const ids = loadSettings().espnLeagueIds
  if (!ids.includes(id)) saveSettings({ espnLeagueIds: [...ids, id] })
  espnDiscoveryGen += 1
  espnLeaguesCache = null
  espnDiscoveryInFlight = null
  await refresh({ waitForBoards: true })
  const found = currentState().leagues.some((league) => league.provider === 'espn' && league.id === id)
  if (!found && !isReplayMode()) return { ok: false, error: 'Could not load that ESPN league. Sign in or check the ID.' }
  return { ok: true }
}

export const removeEspnLeagueId = async (leagueId: string): Promise<void> => {
  saveSettings({ espnLeagueIds: loadSettings().espnLeagueIds.filter((id) => id !== leagueId) })
  espnDiscoveryGen += 1
  espnLeaguesCache = null
  espnDiscoveryInFlight = null
  espnTeamCache.delete(leagueId)
  persistEspnTeams()
  const selected = loadSettings().selectedLeagueKey
  const parsed = selected ? parseLeagueKey(selected) : null
  if (parsed?.provider === 'espn' && parsed.id === leagueId) {
    saveSettings({ selectedLeagueKey: null })
  }
  await refresh({ waitForBoards: true })
}

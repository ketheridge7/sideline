import { leagueKey, parseLeagueKey, type AppState, type League, type Matchup, type NflState, type NflTickerGame, type Player, type Team } from '@shared/types'
import type { Settings } from '@shared/settings'
import { matchupHasLineup } from '@shared/display'
import { parseSleeperLeagueUser, parseSleeperRoster } from './providers/sleeperClient'

export const isLiveLeagueId = (id: string): boolean => /^\d+$/.test(id)

export const isLiveLeagueKey = (key: string): boolean => {
  const parsed = parseLeagueKey(key)
  return parsed != null && isLiveLeagueId(parsed.id)
}

const diskStr = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim() !== '') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

const diskInt = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isInteger(parsed)) return parsed
  }
  return undefined
}

const diskPts = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

export const stripReplayLeagueKeys = (settings: Settings): Settings => ({
  ...settings,
  espnLeagueIds: settings.espnLeagueIds.filter(isLiveLeagueId),
  sleeperLeagueIds:
    settings.sleeperLeagueIds == null ? null : settings.sleeperLeagueIds.filter(isLiveLeagueId),
  pinnedLeagueKeys: settings.pinnedLeagueKeys.filter(isLiveLeagueKey),
  selectedLeagueKey:
    settings.selectedLeagueKey && isLiveLeagueKey(settings.selectedLeagueKey)
      ? settings.selectedLeagueKey
      : null
})

/** Null selectedIds means legacy “all discovered” (do not filter). */
export const leaguesForBoards = (leagues: League[], selectedIds: string[] | null): League[] => {
  if (selectedIds == null) return leagues
  const allow = new Set(selectedIds)
  return leagues.filter((league) => allow.has(league.id))
}

export const nextSleeperLeagueIdsOnConnect = (opts: {
  previousUsername: string | null
  previousUserId: string | null
  previousLeagueIds: string[] | null
  nextUsername: string
  nextUserId: string
}): string[] | null => {
  const nextName = opts.nextUsername.trim().toLowerCase()
  const sameUser =
    (opts.previousUserId != null && opts.previousUserId === opts.nextUserId) ||
    (opts.previousUsername != null && opts.previousUsername.trim().toLowerCase() === nextName)
  if (sameUser) return opts.previousLeagueIds
  return []
}

export const espnFanExtraIds = (probedIds: string[], knownIds: string[]): string[] =>
  probedIds.filter((id) => isLiveLeagueId(id) && !knownIds.includes(id))

export const espnLeagueIdsToDiscover = (savedIds: string[], selectedKey: string | null): string[] => {
  const ids = savedIds.filter(isLiveLeagueId)
  const parsed = selectedKey ? parseLeagueKey(selectedKey) : null
  if (parsed?.provider === 'espn' && isLiveLeagueId(parsed.id) && !ids.includes(parsed.id)) ids.push(parsed.id)
  return ids
}

export const stubLeagueFromKey = (key: string, season: string, week: number): League | null => {
  const parsed = parseLeagueKey(key)
  if (!parsed || !isLiveLeagueId(parsed.id)) return null
  return {
    id: parsed.id,
    name: parsed.id,
    provider: parsed.provider,
    season,
    week
  }
}

export const hudHintKey = (opts: {
  selectedKey: string | null
  lastSelectedKey: string | null
  lastHudKey: string | null
  pinnedKeys: string[]
  leagueKeys?: string[]
  espnLeagueIds?: string[]
}): string | null => {
  const fromEspn = (opts.espnLeagueIds ?? []).map((id) => `espn:${id}`)
  const candidates = [
    opts.selectedKey,
    opts.lastSelectedKey,
    opts.lastHudKey,
    ...opts.pinnedKeys,
    ...(opts.leagueKeys ?? []),
    ...fromEspn
  ]
  return candidates.find((key): key is string => Boolean(key && isLiveLeagueKey(key))) ?? null
}

export const pickSelectedLeagueKey = (opts: {
  settingsKey: string | null
  leagueKeys: string[]
  pinnedKeys: string[]
  hintKey: string | null
  featuredKey: string | null
}): string | null => {
  const keys = new Set(opts.leagueKeys)
  if (opts.settingsKey && keys.has(opts.settingsKey)) return opts.settingsKey
  if (opts.featuredKey && keys.has(opts.featuredKey)) return opts.featuredKey
  const pinned = opts.pinnedKeys.find((key) => keys.has(key))
  if (pinned) return pinned
  if (opts.hintKey && keys.has(opts.hintKey)) return opts.hintKey
  if (opts.leagueKeys.length === 0) return opts.settingsKey ?? opts.hintKey
  return opts.leagueKeys[0] ?? null
}

/** Discovery with an empty league list must not wipe a HUD that last scores or this tick already painted. A new selected league must not keep the previous board’s scores. A HUD painted for another league key must not fill the selected board. */
export const settleMatchupPlan = (opts: {
  selectedMatchup: Matchup | null
  liveMatchup: Matchup | null
  lastMatchup: Matchup | null
  selectedKey: string | null
  lastKey: string | null
  liveKey?: string | null
}): Matchup | null => {
  if (opts.selectedMatchup) return opts.selectedMatchup
  const liveIsSelected = !opts.liveKey || !opts.selectedKey || opts.liveKey === opts.selectedKey
  const live = liveIsSelected ? opts.liveMatchup : null
  if (opts.selectedKey && opts.lastKey && opts.selectedKey !== opts.lastKey) {
    return opts.liveKey === opts.selectedKey ? live : null
  }
  return live ?? (liveIsSelected ? opts.lastMatchup : null)
}

/** Last HUD / lastState scores may seed this tick only when they already belong to the hinted league. */
export const seedHudMatchupPlan = (opts: {
  hintKey: string | null
  lastSelectedKey: string | null
  lastHudKey: string | null
}): 'last-state' | 'last-hud' | 'skip' => {
  if (!opts.hintKey) return 'last-state'
  if (opts.lastSelectedKey === opts.hintKey) return 'last-state'
  if (opts.lastHudKey === opts.hintKey) return 'last-hud'
  return 'skip'
}

/** A selectLeague that changed settings must not join the in-flight poll that still scores the previous key. */
export const refreshJoinPlan = (opts: {
  hasInFlight: boolean
  hasBoardsTail: boolean
  waitForBoards: boolean
  settingsKey: string | null
  inFlightKey: string | null
}): 'join' | 'kick' => {
  if (opts.settingsKey && opts.inFlightKey && opts.settingsKey !== opts.inFlightKey) return 'kick'
  if (opts.waitForBoards && opts.hasBoardsTail) return 'join'
  if (opts.hasInFlight) return 'join'
  return 'kick'
}

export const espnConnectedPlan = (opts: {
  replay: boolean
  hasCookies: boolean
  lastConnected: boolean
  unauthorized?: boolean
}): boolean => {
  if (opts.replay) return true
  if (opts.unauthorized) return false
  return opts.hasCookies || opts.lastConnected
}

export const ESPN_COOKIE_PRIME_ATTEMPTS = 4

/** After Sign in, reread persist:espn a few times if the first jar snapshot is empty. */
export const espnCookiePrimePlan = (opts: {
  hasCookies: boolean
  attempt: number
  maxAttempts?: number
}): 'done' | 'retry' => {
  if (opts.hasCookies) return 'done'
  const max = opts.maxAttempts ?? ESPN_COOKIE_PRIME_ATTEMPTS
  return opts.attempt + 1 < max ? 'retry' : 'done'
}

export const settleSelectedKeyPlan = (opts: {
  discoveredKey: string | null
  lastKey: string | null
}): string | null => opts.discoveredKey ?? opts.lastKey

export const cacheFresh = (at: number | undefined, now: number, ttlMs: number): boolean =>
  at != null && now - at < ttlMs

export const espnScoreOverlayPlan = (
  cached: { week: number; at: number } | undefined,
  week: number,
  now: number,
  ttlMs: number
): { overlay: boolean; refreshFull: boolean } => {
  if (!cached || cached.week !== week) return { overlay: false, refreshFull: true }
  return { overlay: true, refreshFull: !cacheFresh(cached.at, now, ttlMs) }
}

/** Cached boxscore / last lineup can overlay compact live. True-cold HUD must fetch `mMatchupScore` first — compact week stubs have no home/away team ids. */
export const espnScoreKickOrder = (opts: {
  hasOverlay: boolean
}): 'live-then-full' | 'full-then-live' => (opts.hasOverlay ? 'live-then-full' : 'full-then-live')

/** Selected HUD scoring wins Chromium's pipe; rest/pinned compact lives stay default while idle. */
export const liveScorePriority = (hud: boolean): 'high' | undefined => (hud ? 'high' : undefined)

/** Rest/pinned compact `mLiveScoring` / `/matchups` sit below HUD while games are in so they cannot occupy HTTP/2 over the next 3s selected GET. Idle rest stays default. */
export const restScoreFetchPriority = (live: boolean): 'low' | undefined => (live ? 'low' : undefined)

/** HUD scoring abort matches the live poll so a hung GET cannot pile into the next tick. */
export const hudScoreFetchTimeoutMs = (livePollMs: number): number => livePollMs

/** Cold HUD `/rosters`+`/users` still gate first parse, but must not beat high `/matchups`. Rest identity and `GET /user` sit with rest compact while games are in. Idle rest stays default. */
export const sleeperIdentityPriority = (hud: boolean, live = false): 'low' | undefined =>
  hud || live ? 'low' : undefined

/** Cold HUD identity (`GET /user`, `/rosters`, `/users`) abort matches the live poll so hung lookups cannot hold first `/matchups` behind rest's 5s budget. */
export const sleeperIdentityTimeoutMs = (
  hud: boolean,
  livePollMs: number,
  restTimeoutMs: number,
  live = false
): number => (hud ? livePollMs : restScoreTimeoutMs({ live, livePollMs, restTimeoutMs }))

/** Compact success defers ~40KB `mMatchupScore` SWR. Selected HUD recovers immediately on compact failure or a true-cold miss so rest/tx cannot sit on a dead live GET. Rest/pinned always defer that boxscore so a pin cannot pile 40KB beside HUD. */
/** Compact live paints HUD. Boxscore SWR waits until after rest. While games are `in`, skip that ~40KB SWR; HUD recover still runs if compact fails or there is no overlay. */
/** Idle defers ~40KB `mMatchupScore` after compact live. Gameday ticks skip that GET so it cannot occupy the rest pool; HUD recover still starts immediately when compact fails. */
export const espnLiveFullSwrPlan = (opts: {
  needsFull: boolean
  liveFailed: boolean
  hasOverlay: boolean
  hud: boolean
  gamesIn?: boolean
  compactIsStub?: boolean
  hasNamedLineup?: boolean
}): 'recover' | 'defer' | 'skip' => {
  if (opts.hud && opts.compactIsStub) return 'recover'
  if (opts.hud && opts.hasNamedLineup === false) return 'recover'
  if (!opts.needsFull) return 'skip'
  if (opts.hud && (opts.liveFailed || !opts.hasOverlay)) return 'recover'
  if (opts.gamesIn) return 'skip'
  return 'defer'
}

/** Live ticks keep leftover idle `mMatchupScore` ids until idle so fat SWR cannot drain 40KB beside HUD. */
export const espnDeferredBoxscoreDrainPlan = (liveTick: boolean): 'drain' | 'hold' =>
  liveTick ? 'hold' : 'drain'

/** Rest deferred `mMatchupScore` shares this key with HUD recover so it can join in-flight. HUD vs rest is the join plan, not the key. Public vs auth and `filterTeamIds` still split. */
export const espnScoreRefreshKey = (opts: {
  leagueId: string
  week: number
  hasCookies: boolean
  hud?: boolean
  teamId: number | null
  bust?: string
}): string =>
  `${opts.leagueId}:${opts.week}:${opts.hasCookies ? 'auth' : 'public'}:${opts.teamId ?? 'week'}:${opts.bust ?? ''}`

/** HUD recover already wrote this week's boxscore — deferred SWR must not open a second `mMatchupScore`. */
export const espnBoxscoreSwrFreshPlan = (opts: {
  cachedWeek: number | undefined
  week: number
  cachedAt: number | undefined
  now: number
  ttlMs: number
}): 'use-cache' | 'fetch' => {
  if (opts.cachedWeek !== opts.week || opts.cachedAt == null) return 'fetch'
  return cacheFresh(opts.cachedAt, opts.now, opts.ttlMs) ? 'use-cache' : 'fetch'
}

/** Cookie retry of compact live invalidates an in-flight public boxscore recover so it cannot paint over the authenticated HUD. */
export const espnBoxscoreRecoverStale = (opts: {
  startedGen: number
  currentGen: number
}): boolean => opts.startedGen !== opts.currentGen

/** Deferred boxscore must not win Chromium's pipe over the next 3s `mLiveScoring` / `/matchups`. Recover stays high via `liveScorePriority`. */
export const espnDeferredBoxscorePriority = (): 'low' => 'low'

/** A deferred full boxscore must not replace compact live scores. Overlay onto last HUD; if overlay has no live rows, keep the screen. Prefer a parsed lineup when overlay has empty starters. */
export const espnFullSwrPaintPlan = (opts: {
  prev: Matchup | null
  overlaid: Matchup | null
  parsed: Matchup | null
}): Matchup | null => {
  if (opts.overlaid && matchupHasLineup(opts.overlaid)) return opts.overlaid
  if (opts.parsed && matchupHasLineup(opts.parsed)) return opts.parsed
  if (opts.overlaid) return opts.overlaid
  if (opts.prev) return null
  return opts.parsed
}

export const espnTeamIdLookupPlan = (opts: {
  swidTeamId?: number
  fromMatchup: number | undefined
  matchupHasLineup?: boolean
  memoryHasTeams: boolean
}): 'swid' | 'matchup' | 'memory' | 'week-filter' => {
  if (opts.swidTeamId != null) return 'swid'
  if (opts.fromMatchup != null && opts.matchupHasLineup) return 'matchup'
  if (opts.memoryHasTeams) return 'memory'
  return 'week-filter'
}

export const espnLiveOverlayCachePlan = (opts: {
  cachedAtKick: boolean
  cachedAfterLive: boolean
  hasPrevMatchup?: boolean
}): 'at-kick' | 'after-live' | 'matchup' => {
  if (opts.hasPrevMatchup) return 'matchup'
  if (opts.cachedAtKick) return 'at-kick'
  if (opts.cachedAfterLive) return 'after-live'
  return 'matchup'
}

export const espnLiveDiskHydratePlan = (opts: {
  cachedAtKick: boolean
  hasPrevMatchup?: boolean
}): 'skip' | 'after-live' =>
  opts.cachedAtKick || Boolean(opts.hasPrevMatchup) ? 'skip' : 'after-live'

export const espnTeamsHydrateAfterScorePlan = (opts: {
  overlayFromMatchup: boolean
  memoryHasTeams: boolean
  hasTeamId?: boolean
}): 'skip' | 'after-live' =>
  opts.overlayFromMatchup || opts.memoryHasTeams || Boolean(opts.hasTeamId) ? 'skip' : 'after-live'

export const espnHudFromScorePlan = (opts: {
  hasPrevMatchup: boolean
  overlayFromMatchup: boolean
  prevHasLineup?: boolean
}): 'overlay-matchup' | 'parse-payload' => {
  if (opts.hasPrevMatchup && opts.overlayFromMatchup && opts.prevHasLineup !== false) return 'overlay-matchup'
  return 'parse-payload'
}

/** Compact overlay trusts live (including current-period 0). Deferred boxscore still maxes positives; overlayEspnMatchup zeros current-period even on max-prev. */
export const espnOverlayPtsPlan = (overlayFromMatchup: boolean): 'trust-live' | 'max-prev' =>
  overlayFromMatchup ? 'trust-live' : 'max-prev'

/** Deferred leftover boxscore must not paint over compact live. Recover still paints `mMatchupScore` when compact failed. */
export const espnBoxscoreSwrPtsPlan = (opts: {
  hasCompactLive: boolean
  recover: boolean
}): 'merge-compact' | 'boxscore' | 'keep-prev' => {
  if (opts.hasCompactLive) return 'merge-compact'
  if (opts.recover) return 'boxscore'
  return 'keep-prev'
}

export const espnTxKickOrder = (hasCookies: boolean): 'tx-then-swr-activity' | 'tx-only' =>
  hasCookies ? 'tx-then-swr-activity' : 'tx-only'

export const espnTxCookieRetryPlan = (opts: {
  cookiePlan: 'cached' | 'kick-then-refresh' | 'await-cookies'
  peekedCookies: boolean
  publicHit?: boolean
}): 'skip-retry' | 'retry-when-cookies' => {
  if (opts.cookiePlan === 'cached' || opts.cookiePlan === 'await-cookies' || opts.peekedCookies) {
    return 'skip-retry'
  }
  if (opts.publicHit) return 'skip-retry'
  return 'retry-when-cookies'
}

export const selectedFallbackPlan = (opts: {
  hasSelected: boolean
  selectedReady: boolean
  earlyTriedSame: boolean
}): 'skip' | 'kick' => {
  if (!opts.hasSelected || opts.selectedReady || opts.earlyTriedSame) return 'skip'
  return 'kick'
}

export const firstListHudPlan = (opts: {
  hasHint: boolean
  hasHud: boolean
}): 'kick-on-list' | 'skip' => (opts.hasHint || opts.hasHud ? 'skip' : 'kick-on-list')

/** Only the first league list that actually has a live id starts scoring; the other provider joins rest in-flight. */
export const firstListHudKickPlan = (opts: {
  alreadyKicked: boolean
  hasHud: boolean
  hasLiveLeague: boolean
}): 'kick' | 'skip' => {
  if (opts.alreadyKicked || opts.hasHud || !opts.hasLiveLeague) return 'skip'
  return 'kick'
}

/** Rest prefetch starts after HUD when a live hint key exists (selected, last HUD, or pin). */
export const restPrefetchGate = (selectedKey: string | null): 'now' | 'after-selected' =>
  selectedKey ? 'now' : 'after-selected'

export const swrAfterRestPrefetchPlan = (restKicked: boolean): 'after-rest' | 'now' =>
  restKicked ? 'after-rest' : 'now'

/** Idle holds the 251KB scoreboard until pinned rest finishes. Gameday ticks start it after HUD (Chromium low) without waiting on pinned LEAGUES, league-list, or cookie IPC, so a Sunday open can detect games `in` and paint ticker clocks without waiting on rest. 30s TTL while `pre` still prevents re-download every 3s. */
export const nflScoreboardKickPlan = (liveTick = false): 'after-pinned' | 'after-hud' =>
  liveTick ? 'after-hud' : 'after-pinned'

export const nflScoreboardSettleOrder = (
  plan: 'after-hud' | 'after-pinned'
): 'before-lists' | 'after-pinned-rest' => (plan === 'after-hud' ? 'before-lists' : 'after-pinned-rest')

/** Live ticks keep last LEAGUES on screen instead of awaiting GET /leagues, mSettings, or cookie IPC. Connect / waitForBoards still awaits a cold list. */
export const leagueListSettlePlan = (opts: {
  liveTick: boolean
  hasLastLeagues: boolean
  waitForBoards?: boolean
}): 'await' | 'peek-last' => {
  if (opts.waitForBoards) return 'await'
  if (opts.liveTick && opts.hasLastLeagues) return 'peek-last'
  return 'await'
}

/** Week is already in memory, disk, or a calendar seed — do not await `/state/nfl` before scoring GETs. Live ticks also skip the 60s SWR when that cached week already matches the calendar, so `/state/nfl` cannot occupy the rest pool beside the next 3s HUD. Idle still refreshes. A cached week that disagrees with the calendar still SWR-corrects even while live. */
export const nflStateSwrPlan = (opts: {
  fresh: boolean
  liveTick?: boolean
  cachedWeek?: number
  calendarWeek?: number
}): 'return' | 'swr' => {
  if (opts.fresh) return 'return'
  if (
    opts.liveTick &&
    opts.cachedWeek != null &&
    opts.calendarWeek != null &&
    opts.cachedWeek === opts.calendarWeek
  ) {
    return 'return'
  }
  return 'swr'
}

/** Week is already in memory, disk, or a calendar seed — do not await `/state/nfl` before scoring GETs. */
export const nflTickStartPlan = (): 'peek' => 'peek'

/** Idle refreshes Electron cookies every 60s. Live ticks skip that IPC when espn_s2 is already cached so session.read cannot hitch HUD; a public (no-cookie) cache still SWR so in-app login can land. */
export const espnCookieSwrPlan = (opts: {
  fresh: boolean
  liveTick?: boolean
  hasSession?: boolean
}): 'return' | 'swr' => {
  if (opts.fresh) return 'return'
  if (opts.liveTick && opts.hasSession) return 'return'
  return 'swr'
}

/** Idle ticks refresh waiver tape after pinned scoring. Live ticks skip those GETs so tape cannot occupy the rest pool beside the next 3s HUD. Score/injury tape still comes from matchup diffs. */
export const restTxKickPlan = (live = false): 'after-pinned' | 'skip' =>
  live ? 'skip' : 'after-pinned'

/** Waiver/transaction GETs must not beat the next 3s `mLiveScoring` / `/matchups`. */
export const tapeFetchPriority = (): 'low' => 'low'

/** Identity, discovery, NFL state SWR, and deferred roster GETs sit with tape/boxscore below scoring. */
export const backgroundGetPriority = (): 'low' => 'low'

export const sleeperFatSwrPlan = (): 'after-tx' => 'after-tx'

/** Idle refreshes identity, rosters, names, and league lists after tape. Live ticks skip those except empty-cache league discovery so a Sunday session without disk lists is not stuck boardless until Monday. */
export const sleeperFatSwrPartsPlan = (opts: {
  liveTick: boolean
  hasPlayerPeek: boolean
  hasSleeperLeagues?: boolean
  hasEspnLeagues?: boolean
}): { user: boolean; roster: boolean; names: boolean; leagues: boolean } => {
  if (!opts.liveTick) return { user: true, roster: true, names: true, leagues: true }
  return {
    user: false,
    roster: false,
    names: false,
    leagues: opts.hasSleeperLeagues === false || opts.hasEspnLeagues === false
  }
}

export const selectedFallbackJoinPlan = (hasInFlight: boolean): 'join' | 'kick' =>
  restHudJoinPlan({ hasInFlight, inFlightIsHud: false, hud: true })

/** Rest compact is default while idle and low while live. Selected HUD must not wait on it. */
export const restHudJoinPlan = (opts: {
  hasInFlight: boolean
  inFlightIsHud: boolean
  hud: boolean
}): 'join' | 'kick' => {
  if (!opts.hasInFlight) return 'kick'
  if (!opts.hud) return 'join'
  return opts.inFlightIsHud ? 'join' : 'kick'
}

export const selectedFallbackFetchPlan = (
  provider: League['provider']
): 'espn-cookies' | 'sleeper' => {
  switch (provider) {
    case 'espn':
      return 'espn-cookies'
    case 'sleeper':
      return 'sleeper'
    default: {
      const _never: never = provider
      return _never
    }
  }
}

export const espnScoreOnLiveFail = <T,>(
  cached: T,
  pendingFull: Promise<T> | null
): { payload: T; pendingFull: Promise<T> | null } => ({ payload: cached, pendingFull })

export const PLAYER_DUMP_FAIL_COOLDOWN_MS = 60_000

export const lastHudDiskPlan = (hydrated: boolean): 'memory' | 'disk' =>
  hydrated ? 'memory' : 'disk'

export const liveDiskPersistPlan = (): 'after-paint' => 'after-paint'

export const broadcastOrderPlan = (): 'hud-then-state' => 'hud-then-state'

/** Companion `sideline:state` IPC serializes the full AppState; do it after overlay HUD is already on the wire. A no-op 3s tick sends a 3-field tick. Rest LEAGUES upserts send a boards patch so HUD matchup/tape/ticker/layout are not cloned. Live score/tape/ticker ticks send a hud patch (no boards grid) instead of cloning overlay layout and connection flags. */
export const companionStatePlan = (opts: {
  overlaySkipped: boolean
  flagsUnchanged: boolean
  boardsUnchanged: boolean
}): 'tick' | 'boards' | 'hud' | 'after-hud' => {
  if (!opts.flagsUnchanged) return 'after-hud'
  if (opts.overlaySkipped && opts.boardsUnchanged) return 'tick'
  if (opts.overlaySkipped) return 'boards'
  return 'hud'
}

/** Ignore lastUpdated/pollMs/liveCallMs and HUD-only refs. Connection/window/pin changes still clone AppState. */
export const companionFlagsUnchanged = (prev: AppState, next: AppState): boolean =>
  prev.selectedLeagueKey === next.selectedLeagueKey &&
  prev.sleeperConnected === next.sleeperConnected &&
  prev.sleeperUsername === next.sleeperUsername &&
  prev.espnConnected === next.espnConnected &&
  prev.espnNeedsRelogin === next.espnNeedsRelogin &&
  prev.overlayPort === next.overlayPort &&
  prev.overlayVisible === next.overlayVisible &&
  prev.overlayHotkey === next.overlayHotkey &&
  prev.overlayEditHotkey === next.overlayEditHotkey &&
  prev.overlayDisplayHotkey === next.overlayDisplayHotkey &&
  prev.nextLeagueHotkey === next.nextLeagueHotkey &&
  prev.prevLeagueHotkey === next.prevLeagueHotkey &&
  prev.replay === next.replay &&
  prev.error === next.error &&
  prev.lanOverlayEnabled === next.lanOverlayEnabled &&
  prev.lanOverlayHost === next.lanOverlayHost &&
  prev.overlayToken === next.overlayToken &&
  prev.overlayPairingCode === next.overlayPairingCode &&
  prev.pinnedLeagueKeys === next.pinnedLeagueKeys

export const companionBoardsUnchanged = (prev: AppState, next: AppState): boolean =>
  prev.leagues === next.leagues && prev.boards === next.boards

/** Rest LEAGUES upserts must not IPC/SSE an overlay HUD whose scores, tape, and ticker did not change. */
export const overlayHudPushPlan = (unchanged: boolean): 'skip' | 'push' => (unchanged ? 'skip' : 'push')

export const earlyDiskHudPlan = (opts: {
  hasDiskHud: boolean
  alreadyShowing: boolean
}): 'skip' | 'paint' => (!opts.hasDiskHud || opts.alreadyShowing ? 'skip' : 'paint')

export const matchupsPersistPlan = (sig: string, lastSig: string): 'skip' | 'write' =>
  sig === lastSig ? 'skip' : 'write'

/** Live ticks keep last HUD on disk but skip rewriting LEAGUES matchups, ESPN boxscore/teams, and Sleeper rosters. Idle writes those snapshots. */
export const liveMatchupsPersistPlan = (liveTick: boolean): 'after-paint' | 'skip' =>
  liveTick ? 'skip' : 'after-paint'

export const matchupsPersistSig = (
  week: number,
  rows: Array<{ key: string; myPoints: number; oppPoints: number; starterSig: string }>
): string =>
  `${week}|${[...rows]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((row) => `${row.key}:${row.myPoints}:${row.oppPoints}:${row.starterSig}`)
    .join(';')}`

export const sleeperPlayerDumpPlan = (opts: {
  peekedCount: number
  inflight: boolean
  lastFailAt: number | null
  now: number
  cooldownMs: number
  cacheFresh?: boolean
  liveTick?: boolean
}): 'peek' | 'join-inflight' | 'skip-cooldown' | 'fetch' => {
  const cacheFresh = opts.cacheFresh ?? opts.peekedCount > 0
  if (opts.peekedCount > 0 && (cacheFresh || opts.liveTick)) return 'peek'
  if (opts.inflight) return 'join-inflight'
  if (opts.liveTick) return 'peek'
  if (opts.lastFailAt != null && opts.now - opts.lastFailAt < opts.cooldownMs) return 'skip-cooldown'
  return 'fetch'
}

export const sleeperRosterOverlayPlan = (
  cached: { at: number } | undefined,
  now: number,
  ttlMs: number
): { overlay: boolean; refresh: boolean } => {
  if (!cached) return { overlay: false, refresh: true }
  return { overlay: true, refresh: !cacheFresh(cached.at, now, ttlMs) }
}

export const sleeperOverlayRosterSwrPlan = (refresh: boolean): 'skip' | 'defer' =>
  refresh ? 'defer' : 'skip'

export const sleeperColdHudPlan = (hasPrevMatchup: boolean): 'overlay-then-identity' | 'await-all' =>
  hasPrevMatchup ? 'overlay-then-identity' : 'await-all'

export const sleeperHudScorePlan = (opts: {
  hasPrevMatchup: boolean
  hasRosterCache: boolean
}): 'overlay-prev' | 'rebuild-cached' | 'await-all' => {
  if (opts.hasPrevMatchup) return 'overlay-prev'
  if (opts.hasRosterCache) return 'rebuild-cached'
  return 'await-all'
}

export const sleeperOverlayMissPlan = (opts: {
  hasOverlay: boolean
  matchupCount: number
  hasPrev: boolean
}): 'overlay' | 'keep-prev' | 'rebuild' => {
  if (opts.hasOverlay) return 'overlay'
  if (opts.hasPrev && opts.matchupCount === 0) return 'keep-prev'
  return 'rebuild'
}

export const sleeperRosterDiskPlan = (
  scorePlan: 'overlay-prev' | 'rebuild-cached' | 'await-all'
): 'after-fetch' | 'skip' => {
  switch (scorePlan) {
    case 'await-all':
      return 'skip'
    case 'overlay-prev':
    case 'rebuild-cached':
      return 'after-fetch'
    default: {
      const _never: never = scorePlan
      return _never
    }
  }
}

export const sleeperPrevMatchup = (opts: {
  leagueKey: string
  selectedKey: string | null
  hud: Matchup | null
  hudWeek: number | undefined
  week: number
  cached: Matchup | null
}): Matchup | null => {
  if (opts.selectedKey === opts.leagueKey && opts.hud && opts.hudWeek === opts.week) return opts.hud
  return opts.cached
}

export const sleeperUserSwrPlan = (opts: {
  hasVerifiedUser: boolean
  hasCachedId: boolean
}): 'return' | 'defer-swr' | 'await-fetch' => {
  if (opts.hasVerifiedUser) return 'return'
  if (opts.hasCachedId) return 'defer-swr'
  return 'await-fetch'
}

/** True-cold HUD `GET /user` and idle username SWR share one in-flight lookup. */
export const sleeperUserFetchJoinPlan = (hasInFlight: boolean): 'join' | 'kick' =>
  hasInFlight ? 'join' : 'kick'

export const sleeperUserFromSettings = (opts: {
  username: string | null
  userId: string | null
}): { user_id: string; username: string } | null => {
  if (!opts.username || !opts.userId) return null
  return { user_id: opts.userId, username: opts.username }
}

export const sleeperUserHudPlan = (opts: {
  sleeperHud: boolean
  hasUser: boolean
  hasPrevMatchup?: boolean
}): 'now' | 'await-user' => {
  if (!opts.sleeperHud || opts.hasUser || opts.hasPrevMatchup) return 'now'
  return 'await-user'
}

export const recentLiveCallMs = (timings: { url: string; ms: number; ok: boolean }[]): number | null => {
  for (let i = timings.length - 1; i >= 0; i--) {
    const row = timings[i]
    if (row.url.includes('mLiveScoring') || row.url.includes('/matchups/')) return row.ms
  }
  return null
}

export const holdForSelectedLive = (opts: {
  hasHud: boolean
  waitForBoards: boolean
  replay: boolean
}): boolean => opts.replay || opts.waitForBoards || !opts.hasHud

export const espnHudCookiePlan = (opts: {
  cookieCacheReady: boolean
  likelyPrivate: boolean
}): 'cached' | 'kick-then-refresh' | 'await-cookies' => {
  if (opts.cookieCacheReady) return 'cached'
  if (opts.likelyPrivate) return 'await-cookies'
  return 'kick-then-refresh'
}

/** A known ESPN session — not merely having league ids or an ESPN HUD hint. */
export const espnHudLikelyPrivate = (opts: {
  espnConnected: boolean
  hasCookies: boolean
}): boolean => opts.espnConnected || opts.hasCookies

export const espnUncachedDiscoveryPlan = (firstCount: number): 'use-first' | 'await-cookies' =>
  firstCount > 0 ? 'use-first' : 'await-cookies'

export const espnCookieRetryAfterScorePlan = (opts: {
  compactHit: boolean
  parsedHasLineup?: boolean
}): 'skip' | 'retry-auth' => {
  if (opts.parsedHasLineup) return 'skip'
  if (opts.compactHit && opts.parsedHasLineup !== false) return 'skip'
  return 'retry-auth'
}

export const sleeperLeaguesLoadPlan = (opts: {
  hasFreshCache: boolean
  hasStaleCache: boolean
}): 'return-cache' | 'return-stale-swr' | 'await-user' => {
  if (opts.hasFreshCache) return 'return-cache'
  if (opts.hasStaleCache) return 'return-stale-swr'
  return 'await-user'
}

export const sleeperLeaguesSwrPlan = (
  loadPlan: 'return-cache' | 'return-stale-swr' | 'await-user',
  waitForBoards: boolean
): 'return' | 'defer-swr' | 'await-fetch' => {
  if (loadPlan === 'return-cache') return 'return'
  if (loadPlan === 'return-stale-swr') return 'defer-swr'
  return waitForBoards ? 'await-fetch' : 'defer-swr'
}

export const leagueListFetchPlan = (hasHudHint: boolean): 'after-hud' | 'now' =>
  hasHudHint ? 'after-hud' : 'now'

/** Live ticks with last HUD already on screen skip `sideline-matchups.json` so JSON.parse cannot hitch the next 3s scoring GET. Warmup already hydrated that snapshot. */
export const matchupsDiskHydratePlan = (
  hasHudHint: boolean,
  liveTick = false
): 'after-hud' | 'now' | 'skip' => {
  if (liveTick && hasHudHint) return 'skip'
  return hasHudHint ? 'after-hud' : 'now'
}

export const sleeperNamesKickPlan = (peekedCount: number): 'now' | 'defer' =>
  peekedCount > 0 ? 'now' : 'defer'

export const playerDumpDiskPlan = (
  memoryReady: boolean,
  liveTick = false
): 'memory' | 'disk' | 'skip' => {
  if (memoryReady) return 'memory'
  if (liveTick) return 'skip'
  return 'disk'
}

export const sleeperScoreNamePlan = (memoryReady: boolean): 'memory' | 'empty' =>
  memoryReady ? 'memory' : 'empty'

export const sleeperTxNamePlan = (
  memoryReady: boolean,
  liveTick = false
): 'memory' | 'after-fetch' | 'empty' => {
  if (memoryReady) return 'memory'
  if (liveTick) return 'empty'
  return 'after-fetch'
}

export const afterSelectedSettlePlan = (opts: {
  hasSelectedHint: boolean
  holdSelected: boolean
}): 'now' | 'after-selected' => {
  if (!opts.hasSelectedHint || opts.holdSelected) return 'now'
  return 'after-selected'
}

export const sleeperRestNameHydratePlan = (): 'after-publish' => 'after-publish'

export const sleeperCdnBustToken = (now: number, intervalMs: number): string =>
  String(Math.floor(now / intervalMs))

export const sleeperMatchupsHoldKey = (opts: {
  leagueId: string
  week: number
  priority?: string
}): string => `${opts.leagueId}:${opts.week}:${opts.priority ?? ''}`

export const sleeperIdentityHoldKey = (opts: {
  leagueId: string
  priority?: string
}): string => `${opts.leagueId}:${opts.priority ?? ''}`

/** Same 3s bust reuses the GET. A slow GET /user that rolls the bust still joins an in-flight HUD /matchups. */
export const sleeperMatchupsReusePlan = (opts: {
  hasHold: boolean
  holdBust: string
  bust: string
  settled: boolean
}): 'join' | 'kick' => {
  if (!opts.hasHold) return 'kick'
  if (opts.holdBust === opts.bust) return 'join'
  if (!opts.settled) return 'join'
  return 'kick'
}

/** Rest/pinned `/matchups` must not open a second GET while selected HUD already has one for this league. */
export const sleeperMatchupsRestJoinHudPlan = (opts: {
  hudHold: boolean
}): 'join' | 'own' => (opts.hudHold ? 'join' : 'own')

/** Compact `mLiveScoring` coalesces HUD + rest without letting selected HUD wait on a rest-low GET. */
export const espnCompactLiveHoldKey = (opts: {
  leagueId: string
  week: number
  hasCookies: boolean
  teamId: number | null
  bust: string
}): string =>
  `${opts.leagueId}:${opts.week}:${opts.hasCookies ? 'auth' : 'public'}:${opts.teamId ?? 'week'}:${opts.bust}`

/** Previous 3s `mLiveScoring` bust buckets must not stay in the hold map all Sunday. */
export const espnHoldStaleKeys = (opts: { keys: string[]; keepKey: string }): string[] => {
  const cut = opts.keepKey.lastIndexOf(':')
  if (cut < 0) return []
  const prefix = opts.keepKey.slice(0, cut + 1)
  return opts.keys.filter((key) => key !== opts.keepKey && key.startsWith(prefix))
}

export const espnCompactLiveJoinPlan = (opts: {
  hasHold: boolean
  holdIsHud: boolean
  hud: boolean
  settled: boolean
}): 'join' | 'kick' => {
  if (!opts.hasHold) return 'kick'
  if (!opts.hud) return 'join'
  if (!opts.holdIsHud) return 'kick'
  return opts.settled ? 'kick' : 'join'
}

export const seedScoreboardState = (opts: {
  lastLive: boolean
  lastTicker: NflTickerGame[]
  calendarLive: boolean
}): { live: boolean; ticker: NflTickerGame[] } => ({
  live: opts.lastLive || opts.calendarLive,
  ticker: opts.lastTicker
})

export const peekSettled = <T,>(pending: Promise<T>, fallback: T): Promise<T> =>
  Promise.race([pending, Promise.resolve(fallback)])

export const nflWeekShifted = (
  prev: { displayWeek: number; leagueSeason: string },
  next: { displayWeek: number; leagueSeason: string }
): boolean => prev.displayWeek !== next.displayWeek || prev.leagueSeason !== next.leagueSeason

export const weekShiftKickOrder = (hasSelected: boolean): 'hud-then-rest' | 'rest-only' =>
  hasSelected ? 'hud-then-rest' : 'rest-only'

export const NFL_DISK_TRUST_MS = 12 * 60 * 60 * 1000
export const NFL_DISK_STALE_MS = 8 * 24 * 60 * 60 * 1000

export const calendarNflFallback = (now: Date): NflState => {
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const leagueSeason = month <= 2 ? String(year - 1) : String(year)
  return {
    week: 1,
    displayWeek: 1,
    season: leagueSeason,
    leagueSeason,
    seasonType: month >= 9 || month <= 2 ? 'regular' : 'pre'
  }
}

export const nflCalendarSeed = (now: Date, lastHudWeek?: number): NflState => {
  const fallback = calendarNflFallback(now)
  if (lastHudWeek == null) return fallback
  return { ...fallback, week: lastHudWeek, displayWeek: lastHudWeek }
}

export const warmupNflCachePlan = (opts: {
  hasNflDisk: boolean
  replay: boolean
}): 'disk' | 'calendar' | 'skip' => {
  if (opts.hasNflDisk) return 'disk'
  if (opts.replay) return 'skip'
  return 'calendar'
}

export const asNflState = (value: unknown): NflState | null => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const week = diskInt(row.week)
  const displayWeek = diskInt(row.displayWeek) ?? week
  const season = diskStr(row.season)
  const leagueSeason = diskStr(row.leagueSeason) ?? season
  const seasonType = diskStr(row.seasonType) ?? 'regular'
  if (week == null || displayWeek == null || !season || !leagueSeason) return null
  return { week, displayWeek, season, leagueSeason, seasonType }
}

export const nflFromDiskPayload = (
  parsed: unknown,
  now: number,
  ttlMs = NFL_DISK_TRUST_MS
): NflState | null => {
  if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) return null
  const row = parsed as Record<string, unknown>
  if (typeof row.at !== 'number' || !cacheFresh(row.at, now, ttlMs)) return null
  return asNflState(row.nfl)
}

export const ESPN_TEAMS_DISK_TRUST_MS = 7 * 24 * 60 * 60 * 1000

export const espnTeamsFromDiskPayload = (
  parsed: unknown,
  now: number
): Record<string, Record<string, unknown>[]> | null => {
  if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) return null
  const row = parsed as Record<string, unknown>
  if (typeof row.at !== 'number' || !cacheFresh(row.at, now, ESPN_TEAMS_DISK_TRUST_MS)) return null
  if (typeof row.byId !== 'object' || row.byId == null || Array.isArray(row.byId)) return null
  const out: Record<string, Record<string, unknown>[]> = {}
  for (const [id, teams] of Object.entries(row.byId as Record<string, unknown>)) {
    if (!Array.isArray(teams)) continue
    const rows = teams.filter(
      (team): team is Record<string, unknown> => typeof team === 'object' && team != null && !Array.isArray(team)
    )
    if (rows.length > 0) out[id] = rows
  }
  return Object.keys(out).length > 0 ? out : null
}

export const HUD_DISK_TRUST_MS = NFL_DISK_TRUST_MS

export const ESPN_SCORES_DISK_TRUST_MS = HUD_DISK_TRUST_MS

export type EspnScoreDiskRow = {
  week: number
  payload: Record<string, unknown>
}

export const espnScoresFromDiskPayload = (
  parsed: unknown,
  now: number
): Record<string, EspnScoreDiskRow> | null => {
  if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) return null
  const row = parsed as Record<string, unknown>
  if (typeof row.at !== 'number' || !cacheFresh(row.at, now, ESPN_SCORES_DISK_TRUST_MS)) return null
  if (typeof row.byId !== 'object' || row.byId == null || Array.isArray(row.byId)) return null
  const out: Record<string, EspnScoreDiskRow> = {}
  for (const [id, value] of Object.entries(row.byId as Record<string, unknown>)) {
    if (typeof value !== 'object' || value == null || Array.isArray(value)) continue
    const entry = value as Record<string, unknown>
    const week = diskInt(entry.week)
    if (week == null || typeof entry.payload !== 'object' || entry.payload == null) continue
    if (Array.isArray(entry.payload)) continue
    out[id] = { week, payload: entry.payload as Record<string, unknown> }
  }
  return Object.keys(out).length > 0 ? out : null
}

export const SLEEPER_ROSTERS_DISK_TRUST_MS = HUD_DISK_TRUST_MS

export type SleeperRosterDiskRow = {
  rosters: Record<string, unknown>[]
  users: Record<string, unknown>[]
}

export const sleeperRostersFromDiskPayload = (
  parsed: unknown,
  now: number
): Record<string, SleeperRosterDiskRow> | null => {
  if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) return null
  const row = parsed as Record<string, unknown>
  if (typeof row.at !== 'number' || !cacheFresh(row.at, now, SLEEPER_ROSTERS_DISK_TRUST_MS)) return null
  if (typeof row.byId !== 'object' || row.byId == null || Array.isArray(row.byId)) return null
  const out: Record<string, SleeperRosterDiskRow> = {}
  for (const [id, value] of Object.entries(row.byId as Record<string, unknown>)) {
    if (typeof value !== 'object' || value == null || Array.isArray(value)) continue
    const entry = value as Record<string, unknown>
    if (!Array.isArray(entry.rosters) || !Array.isArray(entry.users)) continue
    const rosters = entry.rosters
      .map((item) => parseSleeperRoster(item))
      .filter((roster): roster is NonNullable<ReturnType<typeof parseSleeperRoster>> => roster != null)
    const users = entry.users
      .map((item) => parseSleeperLeagueUser(item))
      .filter((user): user is NonNullable<ReturnType<typeof parseSleeperLeagueUser>> => user != null)
    if (rosters.length === 0 || users.length === 0) continue
    out[id] = { rosters, users }
  }
  return Object.keys(out).length > 0 ? out : null
}

export const SLEEPER_LEAGUES_DISK_TRUST_MS = HUD_DISK_TRUST_MS

export type SleeperLeaguesDiskRow = {
  username: string
  season: string
  leagues: League[]
}

const asLeague = (value: unknown, provider: League['provider']): League | null => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const id = diskStr(row.id)
  const name = diskStr(row.name)
  const season = diskStr(row.season)
  const week = diskInt(row.week)
  if (!id || !name || !season || week == null || row.provider !== provider) return null
  return { id, name, provider, season, week }
}

export const sleeperLeaguesFromDiskPayload = (parsed: unknown, now: number): SleeperLeaguesDiskRow | null => {
  if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) return null
  const row = parsed as Record<string, unknown>
  if (typeof row.at !== 'number' || !cacheFresh(row.at, now, SLEEPER_LEAGUES_DISK_TRUST_MS)) return null
  const username = diskStr(row.username)
  const season = diskStr(row.season)
  if (!username || !season) return null
  if (!Array.isArray(row.leagues)) return null
  const leagues = row.leagues
    .map((item) => asLeague(item, 'sleeper'))
    .filter((league): league is League => league != null)
  if (leagues.length === 0) return null
  return { username, season, leagues }
}

export const ESPN_LEAGUES_DISK_TRUST_MS = HUD_DISK_TRUST_MS

export type EspnLeaguesDiskRow = {
  season: string
  ids: string
  leagues: League[]
}

export const espnLeaguesFromDiskPayload = (parsed: unknown, now: number): EspnLeaguesDiskRow | null => {
  if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) return null
  const row = parsed as Record<string, unknown>
  if (typeof row.at !== 'number' || !cacheFresh(row.at, now, ESPN_LEAGUES_DISK_TRUST_MS)) return null
  if (typeof row.season !== 'string' || typeof row.ids !== 'string') return null
  if (!Array.isArray(row.leagues)) return null
  const leagues = row.leagues
    .map((item) => asLeague(item, 'espn'))
    .filter((league): league is League => league != null && isLiveLeagueId(league.id))
  if (leagues.length === 0) return null
  return { season: row.season, ids: row.ids, leagues }
}

export const espnLeaguesCachePlan = (opts: {
  cacheSeason?: string
  cacheIds?: string
  cacheCookieKey?: string
  cacheAt?: number
  season: string
  ids: string
  cookieKey: string
  now: number
  ttlMs: number
}): 'return-fresh' | 'return-stale-swr' | 'fetch' => {
  if (opts.cacheSeason !== opts.season || opts.cacheIds !== opts.ids) return 'fetch'
  if (cacheFresh(opts.cacheAt, opts.now, opts.ttlMs) && opts.cacheCookieKey === opts.cookieKey) {
    return 'return-fresh'
  }
  return 'return-stale-swr'
}

export const espnDiscoverySwrPlan = (
  cachePlan: 'return-fresh' | 'return-stale-swr' | 'fetch',
  waitForBoards: boolean
): 'return' | 'defer-swr' | 'await-fetch' => {
  if (cachePlan === 'return-fresh') return 'return'
  if (cachePlan === 'return-stale-swr') return 'defer-swr'
  return waitForBoards ? 'await-fetch' : 'defer-swr'
}

export const mergeProviderLeagues = (
  leagues: League[],
  provider: League['provider'],
  next: League[]
): League[] => {
  switch (provider) {
    case 'sleeper':
      return [...next, ...leagues.filter((row) => row.provider !== 'sleeper')]
    case 'espn':
      return [...leagues.filter((row) => row.provider !== 'espn'), ...next]
    default: {
      const _never: never = provider
      return _never
    }
  }
}

export type LastHudSnapshot = {
  displayWeek: number
  selectedKey: string
  matchup: Matchup
}

const asTeam = (value: unknown): Team | null => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const id = diskStr(row.id)
  const name = diskStr(row.name)
  const owner = diskStr(row.owner)
  const record = diskStr(row.record)
  if (!id || !name || !owner || !record) return null
  return { id, name, owner, record }
}

const asPlayer = (value: unknown): Player | null => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const playerId = diskStr(row.playerId)
  const name = diskStr(row.name)
  const position = diskStr(row.position)
  const nflTeam = diskStr(row.nflTeam)
  if (!playerId || !name || !position || !nflTeam) return null
  const player: Player = { playerId, name, position, nflTeam }
  const points = diskPts(row.points)
  if (points != null) player.points = points
  if (typeof row.status === 'string') player.status = row.status
  const lineupSlotId = diskInt(row.lineupSlotId)
  if (lineupSlotId != null) player.lineupSlotId = lineupSlotId
  return player
}

const asPlayers = (value: unknown): Player[] | null => {
  if (!Array.isArray(value)) return null
  const rows: Player[] = []
  for (const item of value) {
    const player = asPlayer(item)
    if (!player) return null
    rows.push(player)
  }
  return rows
}

export const asMatchup = (value: unknown): Matchup | null => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const myTeam = asTeam(row.myTeam)
  const myPoints = diskPts(row.myPoints)
  const oppPoints = diskPts(row.oppPoints)
  if (!myTeam || myPoints == null || oppPoints == null) return null
  const starters = asPlayers(row.starters)
  const bench = asPlayers(row.bench)
  const oppStarters = asPlayers(row.oppStarters)
  const oppBench = asPlayers(row.oppBench)
  if (!starters || !bench || !oppStarters || !oppBench) return null
  const oppTeam = row.oppTeam == null ? null : asTeam(row.oppTeam)
  if (row.oppTeam != null && !oppTeam) return null
  const myProjectedPoints = diskPts(row.myProjectedPoints)
  const oppProjectedPoints = diskPts(row.oppProjectedPoints)
  const myWinPct = diskPts(row.myWinPct)
  const oppWinPct = diskPts(row.oppWinPct)
  const winPctSource = row.winPctSource === 'estimated' || row.winPctSource === 'official' ? row.winPctSource : undefined
  return {
    myTeam,
    oppTeam,
    myPoints,
    oppPoints,
    starters,
    bench,
    oppStarters,
    oppBench,
    ...(myProjectedPoints != null && myProjectedPoints > 0 ? { myProjectedPoints } : {}),
    ...(oppProjectedPoints != null && oppProjectedPoints > 0 ? { oppProjectedPoints } : {}),
    ...(myWinPct != null && myWinPct >= 0 && myWinPct <= 1 ? { myWinPct } : {}),
    ...(oppWinPct != null && oppWinPct >= 0 && oppWinPct <= 1 ? { oppWinPct } : {}),
    ...(winPctSource ? { winPctSource } : {})
  }
}

export const lastHudFromDiskPayload = (parsed: unknown, now: number): LastHudSnapshot | null => {
  if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) return null
  const row = parsed as Record<string, unknown>
  if (typeof row.at !== 'number' || !cacheFresh(row.at, now, HUD_DISK_TRUST_MS)) return null
  const displayWeek = diskInt(row.displayWeek)
  const selectedKey = diskStr(row.selectedKey)
  if (displayWeek == null || !selectedKey) return null
  const matchup = asMatchup(row.matchup)
  if (!matchup) return null
  return { displayWeek, selectedKey, matchup }
}

export const MATCHUPS_DISK_TRUST_MS = HUD_DISK_TRUST_MS

export type MatchupsDiskSnapshot = {
  week: number
  byKey: Record<string, Matchup>
}

export const matchupsFromDiskPayload = (parsed: unknown, now: number): MatchupsDiskSnapshot | null => {
  if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) return null
  const row = parsed as Record<string, unknown>
  if (typeof row.at !== 'number' || !cacheFresh(row.at, now, MATCHUPS_DISK_TRUST_MS)) return null
  const week = diskInt(row.week)
  if (week == null || typeof row.byKey !== 'object' || row.byKey == null || Array.isArray(row.byKey)) {
    return null
  }
  const byKey: Record<string, Matchup> = {}
  for (const [key, value] of Object.entries(row.byKey as Record<string, unknown>)) {
    const parsed = parseLeagueKey(key)
    if (!parsed || !isLiveLeagueId(parsed.id)) continue
    const matchup = asMatchup(value)
    if (matchup) byKey[key] = matchup
  }
  if (Object.keys(byKey).length === 0) return null
  return { week, byKey }
}

export const splitHotCold = (
  leagues: League[],
  selectedKey: string | null,
  pinnedKeys: string[]
): { selected: League | undefined; hot: League[]; cold: League[] } => {
  const hotSet = new Set<string>(pinnedKeys)
  if (selectedKey) hotSet.add(selectedKey)
  const selected = selectedKey
    ? leagues.find((league) => leagueKey(league.provider, league.id) === selectedKey)
    : undefined
  const hot = leagues.filter((league) => hotSet.has(leagueKey(league.provider, league.id)))
  const cold = leagues.filter((league) => !hotSet.has(leagueKey(league.provider, league.id)))
  return { selected, hot, cold }
}

export const splitBoardTargets = (
  leagues: League[],
  selectedKey: string | null
): { selected: League | undefined; rest: League[] } => {
  const { selected, hot, cold } = splitHotCold(leagues, selectedKey, selectedKey ? [selectedKey] : [])
  return { selected, rest: [...hot.filter((row) => row !== selected), ...cold] }
}

export const restMatchupFlightKey = (
  provider: string,
  id: string,
  season: string,
  week: number
): string => `${provider}:${id}:${season}:${week}`

/** Live ticks fetch selected + pinned only. Unpinned boards keep last scores until idle so they cannot occupy the rest pool beside HUD. */
export const restPrefetchColdPlan = (pollingLive: boolean): 'hot-only' | 'hot-and-cold' =>
  pollingLive ? 'hot-only' : 'hot-and-cold'

/** Live ticks publish the HUD snapshot without waiting on pinned rest GETs. Overlay already painted; each pin still upserts as it returns. Connect / waitForBoards still awaits that prefetch. */
export const restPrefetchAwaitPlan = (opts: {
  liveTick: boolean
  waitForBoards?: boolean
}): 'await' | 'skip' => {
  if (opts.waitForBoards) return 'await'
  if (opts.liveTick) return 'skip'
  return 'await'
}

export const gamedayLiveTick = (opts: { pollingLive: boolean; calendarLive: boolean }): boolean =>
  opts.pollingLive || opts.calendarLive

/** Scoreboard events still `pre` must not drop the 3s gameday interval. Rest settle must not reschedule 30s over an armed HUD tick. */
export const scoreboardPollLive = (opts: { gamesIn: boolean; calendarLive: boolean }): boolean =>
  gamedayLiveTick({ pollingLive: opts.gamesIn, calendarLive: opts.calendarLive })

export const restSettleSchedulePlan = (opts: {
  hudScheduled: boolean
  nextLive: boolean
  scheduledLive: boolean
}): 'skip' | 'schedule' => {
  if (!opts.hudScheduled) return 'schedule'
  if (opts.nextLive && !opts.scheduledLive) return 'schedule'
  return 'skip'
}

export const REST_LIVE_CONCURRENCY = 3
export const REST_IDLE_CONCURRENCY = 6

export const restConcurrency = (pollingLive: boolean): number =>
  pollingLive ? REST_LIVE_CONCURRENCY : REST_IDLE_CONCURRENCY

/** Rest/pinned compact scoring abort matches the live poll while games are in, so hung GETs cannot occupy the pipe past the next HUD tick. Idle rest stays on the 5s budget. */
export const restScoreTimeoutMs = (opts: {
  live: boolean
  livePollMs: number
  restTimeoutMs: number
}): number => (opts.live ? opts.livePollMs : opts.restTimeoutMs)

export const restLeaguesToPrefetch = (opts: {
  leagues: League[]
  selectedKey: string | null
  pinnedKeys: string[]
  skipKeys: string[]
  season: string
  week: number
  matchupAt: (key: string) => number | undefined
  now: number
  coldTtlMs: number
  includeCold?: boolean
}): League[] => {
  const fromState = opts.leagues.filter((league) => isLiveLeagueId(league.id))
  const seeds = fromState.length > 0
    ? fromState
    : (() => {
        const keys = [...opts.pinnedKeys]
        if (opts.selectedKey && !keys.includes(opts.selectedKey)) keys.push(opts.selectedKey)
        const out: League[] = []
        const seen = new Set<string>()
        for (const key of keys) {
          if (seen.has(key)) continue
          seen.add(key)
          const stub = stubLeagueFromKey(key, opts.season, opts.week)
          if (stub) out.push(stub)
        }
        return out
      })()
  const skip = new Set(opts.skipKeys)
  const split = splitHotCold(seeds, opts.selectedKey, opts.pinnedKeys)
  const hotRest = split.hot.filter((league) => !skip.has(leagueKey(league.provider, league.id)))
  const coldDue = split.cold.filter((league) => {
    const key = leagueKey(league.provider, league.id)
    if (skip.has(key)) return false
    const at = opts.matchupAt(key)
    return at == null || opts.now - at > opts.coldTtlMs
  })
  return [...hotRest, ...(opts.includeCold === false ? [] : coldDue)]
}

export const warmupLeaguesFromDisk = (opts: {
  nfl: NflState
  sleeperLeagues: League[]
  espnLeagues?: League[]
  espnLeagueIds: string[]
  sleeperLeagueIds?: string[] | null
}): League[] => {
  const seen = new Set<string>()
  const out: League[] = []
  const push = (league: League): void => {
    if (!isLiveLeagueId(league.id)) return
    const key = leagueKey(league.provider, league.id)
    if (seen.has(key)) return
    seen.add(key)
    out.push({
      ...league,
      week: opts.nfl.displayWeek,
      season: league.season || opts.nfl.leagueSeason
    })
  }
  for (const league of leaguesForBoards(opts.sleeperLeagues, opts.sleeperLeagueIds ?? null)) push(league)
  for (const league of leaguesForBoards(opts.espnLeagues ?? [], opts.espnLeagueIds)) push(league)
  for (const id of opts.espnLeagueIds) {
    const stub = stubLeagueFromKey(`espn:${id}`, opts.nfl.leagueSeason, opts.nfl.displayWeek)
    if (stub) push(stub)
  }
  return out
}

export const warmupMatchupFromDisk = (opts: {
  selectedKey: string | null
  displayWeek: number
  lastHud: LastHudSnapshot | null
  matchupsByKey: Record<string, Matchup>
  matchupsWeek?: number
}): Matchup | null => {
  if (!opts.selectedKey || !isLiveLeagueKey(opts.selectedKey)) return null
  if (
    opts.lastHud &&
    opts.lastHud.selectedKey === opts.selectedKey &&
    opts.lastHud.displayWeek === opts.displayWeek
  ) {
    return opts.lastHud.matchup
  }
  if (opts.matchupsWeek != null && opts.matchupsWeek !== opts.displayWeek) return null
  return opts.matchupsByKey[opts.selectedKey] ?? null
}

export const espnTeamIdOf = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isInteger(parsed) && parsed > 0) return parsed
  }
  return undefined
}

export const espnTeamFetchKey = (leagueId: string, hasCookies: boolean): string =>
  `${leagueId}:${hasCookies ? 'auth' : 'public'}`

export const espnTeamIdFromMatchup = (
  leagueId: string,
  selectedKey: string | null,
  matchup: Matchup | null,
  cached?: Matchup | null
): number | undefined => {
  const row = selectedKey === leagueKey('espn', leagueId) && matchup ? matchup : (cached ?? null)
  if (!row) return undefined
  return espnTeamIdOf(row.myTeam.id)
}

/** Live ticks skip mTeam only when owners are already cached. A leftover numeric myTeam.id is not identity. */
export const espnTeamsKickPlan = (opts: {
  haveOwners: boolean
  liveTick?: boolean
  hasTeamId?: boolean
}): 'skip' | 'after-score' => {
  if (opts.haveOwners) return 'skip'
  return 'after-score'
}

export const mapSettledLimit = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> => {
  if (items.length === 0) return []
  const out: PromiseSettledResult<R>[] = new Array(items.length)
  let next = 0
  const run = async (): Promise<void> => {
    while (next < items.length) {
      const index = next
      next += 1
      try {
        out[index] = { status: 'fulfilled', value: await worker(items[index]) }
      } catch (reason) {
        out[index] = { status: 'rejected', reason }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, () => run()))
  return out
}

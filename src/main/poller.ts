import type { AppState, League, Matchup, MatchupBoard, NflState, TapeEvent, ToastPayload, Transaction } from '@shared/types'
import { emptyAppState, leagueKey, parseLeagueKey, toOverlayHud } from '@shared/types'
import { parseOverlayLayout } from '@shared/overlayLayout'
import { transactionKindLabel } from '@shared/transactionKind'
import { toMatchupBoard } from '@shared/display'
import { injuryTapeFromDiff, mergeTape, scoreTapeFromDiff, transactionToTape } from '@shared/tape'
import { isLikelyLive, pollIntervalMs } from './liveWindow'
import { getPlayerMap } from './providers/playerCache'
import {
  getLeagueUsers,
  getMatchups,
  getNflState,
  getRosters,
  getTransactions,
  getUser,
  getUserLeagues,
  type CachedPlayer,
  type SleeperUser
} from './providers/sleeperClient'
import { toLeagues, toMatchup, toNflState, toTransactions } from './providers/sleeperAdapter'
import { EspnHttpError, fetchLeague, fetchTransactions, probeFanLeagues, type EspnCookies } from './providers/espnClient'
import {
  leaguesFromFanPayload,
  scoringPeriodFromStatus,
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

let timer: NodeJS.Timeout | null = null
let sleeperUser: SleeperUser | null = null
let espnNeedsRelogin = false
let overlayVisible = false
let overlayEditMode = false
let lastToast: ToastPayload | null = null
const seenTx = new Map<string, Set<string>>()
const seededTx = new Set<string>()
const prevPlayerPts = new Map<string, number>()
const prevInjury = new Map<string, string>()
let liveTape: TapeEvent[] = []
let lastState: AppState = emptyAppState()

export const currentState = (): AppState => lastState

const lanFields = (): Pick<AppState, 'lanOverlayEnabled' | 'lanOverlayHost' | 'overlayToken'> => {
  const lan = overlayLanState()
  return {
    lanOverlayEnabled: lan.enabled,
    lanOverlayHost: lan.host,
    overlayToken: lan.token
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
  lastState = state
  runtime.sendState(state)
  runtime.pushHud(toOverlayHud(state))
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

const loadNfl = async (): Promise<NflState> => {
  if (isReplayMode()) return replayNfl()
  return toNflState(await getNflState())
}

const loadSleeperLeagues = async (nfl: NflState): Promise<League[]> => {
  if (isReplayMode()) return replaySleeperLeagues(nfl)
  const username = loadSettings().sleeperUsername
  if (!username) {
    sleeperUser = null
    return []
  }
  if (!sleeperUser || sleeperUser.username !== username) {
    sleeperUser = await getUser(username)
  }
  const leagues = await getUserLeagues(sleeperUser.user_id, nfl.leagueSeason)
  return toLeagues(leagues, nfl.leagueSeason, nfl.displayWeek)
}

const discoverEspnLeagues = async (
  cookies: EspnCookies | null,
  nfl: NflState
): Promise<League[]> => {
  if (isReplayMode()) return replayEspnLeagues(nfl)
  const ids = [...loadSettings().espnLeagueIds]
  const found: League[] = []
  if (cookies) {
    try {
      const probed = leaguesFromFanPayload(await probeFanLeagues(cookies), nfl.leagueSeason, nfl.displayWeek)
      for (const league of probed) {
        if (!ids.includes(league.id)) ids.push(league.id)
      }
    } catch {
      // paste-a-league-id is the primary path; discovery is best-effort
    }
  }
  for (const id of ids) {
    try {
      const payload = await fetchLeague({
        season: nfl.leagueSeason,
        leagueId: id,
        cookies,
        views: ['mSettings', 'mStatus', 'mTeam']
      })
      found.push(toEspnLeague({ leagueId: id, payload, leagueSeason: nfl.leagueSeason, displayWeek: nfl.displayWeek }))
    } catch (error) {
      if (error instanceof EspnHttpError && (error.status === 401 || error.status === 403)) {
        espnNeedsRelogin = true
      }
    }
  }
  if (ids.join(',') !== loadSettings().espnLeagueIds.join(',')) {
    saveSettings({ espnLeagueIds: ids })
  }
  return found
}

const sleeperMatchup = async (
  league: League,
  nfl: NflState,
  players: Record<string, CachedPlayer>
): Promise<Matchup | null> => {
  if (isReplayMode()) return replayMatchup(league)
  if (!sleeperUser) return null
  const [rosters, users, matchups] = await Promise.all([
    getRosters(league.id),
    getLeagueUsers(league.id),
    getMatchups(league.id, nfl.displayWeek)
  ])
  return toMatchup({ userId: sleeperUser.user_id, rosters, users, matchups, players })
}

const espnMatchup = async (
  league: League,
  nfl: NflState,
  cookies: EspnCookies | null
): Promise<Matchup | null> => {
  if (isReplayMode()) return replayMatchup(league)
  const payload = await fetchLeague({
    season: nfl.leagueSeason,
    leagueId: league.id,
    cookies,
    scoringPeriodId: nfl.displayWeek
  })
  return toEspnMatchup({
    payload,
    cookies,
    displayWeek: scoringPeriodFromStatus(payload, nfl.displayWeek)
  })
}

const loadMatchup = async (
  league: League | undefined,
  nfl: NflState,
  cookies: EspnCookies | null,
  players: Record<string, CachedPlayer>
): Promise<Matchup | null> => {
  if (!league) return null
  if (league.provider === 'sleeper') return sleeperMatchup(league, nfl, players)
  if (league.provider === 'espn') return espnMatchup(league, nfl, cookies)
  const _never: never = league.provider
  return _never
}

const loadTransactions = async (
  league: League,
  nfl: NflState,
  cookies: EspnCookies | null,
  players: Record<string, CachedPlayer>
): Promise<Transaction[]> => {
  if (isReplayMode()) return replayTransactions(league)
  if (league.provider === 'sleeper') {
    return toTransactions(await getTransactions(league.id, nfl.displayWeek), players)
  }
  if (league.provider === 'espn') {
    return toEspnTransactions(await fetchTransactions({ season: nfl.leagueSeason, leagueId: league.id, cookies }))
  }
  const _never: never = league.provider
  return _never
}

export const refresh = async (): Promise<AppState> => {
  const settings = loadSettings()
  const replay = isReplayMode()
  let nfl: NflState | null = null
  let leagues: League[] = []
  let matchup: Matchup | null = null
  let error: string | null = null
  let cookies: EspnCookies | null = null

  try {
    nfl = await loadNfl()
    const live = replay || isLikelyLive(new Date(), nfl.seasonType)
    if (!replay) cookies = await readEspnCookies()
    else cookies = { espn_s2: 'replay', SWID: '{11111111-1111-1111-1111-111111111111}' }

    const sleeperLeagues = await loadSleeperLeagues(nfl)
    const espnLeagues = await discoverEspnLeagues(cookies, nfl)
    leagues = [...sleeperLeagues, ...espnLeagues]

    const pinnedKeys = replay
      ? leagues.map((league) => leagueKey(league.provider, league.id))
      : settings.pinnedLeagueKeys

    let selectedKey = settings.selectedLeagueKey
    if (selectedKey && !leagues.some((league) => leagueKey(league.provider, league.id) === selectedKey)) {
      selectedKey = null
    }
    if (!selectedKey && leagues.length > 0) {
      const pinned = pinnedKeys.find((key) =>
        leagues.some((league) => leagueKey(league.provider, league.id) === key)
      )
      const featured = leagues.some((league) => leagueKey(league.provider, league.id) === FEATURED_LEAGUE_KEY)
        ? FEATURED_LEAGUE_KEY
        : null
      selectedKey = featured ?? pinned ?? leagueKey(leagues[0].provider, leagues[0].id)
      saveSettings({ selectedLeagueKey: selectedKey })
    }

    const selected = leagues.find((league) => leagueKey(league.provider, league.id) === selectedKey)
    const txTargets = leagues.filter((league) => {
      const key = leagueKey(league.provider, league.id)
      return key === selectedKey || pinnedKeys.includes(key)
    })
    const boardTargets = leagues.length > 0 ? leagues : []
    const needsPlayers = !replay && leagues.some((league) => league.provider === 'sleeper')
    const players = needsPlayers ? await getPlayerMap() : {}
    const matchupByKey = new Map<string, Matchup>()
    for (const league of boardTargets) {
      try {
        const loaded = await loadMatchup(league, nfl, cookies, players)
        if (loaded) matchupByKey.set(leagueKey(league.provider, league.id), loaded)
      } catch {
        // board cards stay empty if a single league fails
      }
    }
    matchup = selected ? (matchupByKey.get(leagueKey(selected.provider, selected.id)) ?? null) : null
    const boards: MatchupBoard[] = leagues.map((league) =>
      toMatchupBoard(
        league,
        matchupByKey.get(leagueKey(league.provider, league.id)) ?? null,
        replay ? replayBoardMeta(league) : undefined
      )
    )

    const snapshotTape: TapeEvent[] = []
    const scored: TapeEvent[] = []
    for (const league of txTargets.length > 0 ? txTargets : boardTargets) {
      const loaded = matchupByKey.get(leagueKey(league.provider, league.id))
      if (loaded) {
        scored.push(...scoreTapeFromDiff(league, loaded, prevPlayerPts))
        scored.push(...injuryTapeFromDiff(league, loaded, prevInjury))
      }
      try {
        const rows = await loadTransactions(league, nfl, cookies, players)
        emitNewTransactions(league, rows)
        for (const row of rows) snapshotTape.push(transactionToTape(league, row))
      } catch {
        // transaction polling is best-effort
      }
    }
    liveTape = mergeTape(scored, liveTape, 24)
    const tape = mergeTape(liveTape, [...(replay ? replaySeedTape() : []), ...snapshotTape], 32)

    const state: AppState = {
      sleeperConnected: replay || Boolean(sleeperUser),
      sleeperUsername: replay ? 'sideline-demo' : settings.sleeperUsername,
      espnConnected: replay || Boolean(cookies),
      espnNeedsRelogin: replay ? false : espnNeedsRelogin && !cookies,
      nfl,
      leagues,
      pinnedLeagueKeys: pinnedKeys,
      selectedLeagueKey: selectedKey,
      matchup,
      boards,
      tape,
      nflTicker: replay ? replayNflTicker() : [],
      overlayPort: runtime.overlayPort(),
      overlayVisible,
      overlayHotkey: settings.overlayHotkey,
      overlayEditMode,
      overlayLayout: settings.overlayLayout,
      lastToast,
      ...lanFields(),
      replay,
      lastUpdated: Date.now(),
      pollingLive: live,
      error
    }
    broadcast(state)
    if (replay) bumpReplayTick()
    schedule(live)
    return state
  } catch (caught) {
    error = caught instanceof Error ? caught.message : 'Refresh failed'
    const state: AppState = {
      ...lastState,
      sleeperConnected: replay || Boolean(sleeperUser),
      sleeperUsername: loadSettings().sleeperUsername,
      espnConnected: replay || false,
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
    schedule(false)
    return state
  }
}

const schedule = (live: boolean): void => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    void refresh()
  }, isReplayMode() ? 3_000 : pollIntervalMs(live))
}

export const startPoller = (): void => {
  void refresh()
}

export const connectSleeper = async (username: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    if (isReplayMode()) {
      saveSettings({ sleeperUsername: username })
      await refresh()
      return { ok: true }
    }
    const user = await getUser(username.trim())
    if (!user?.user_id) return { ok: false, error: 'Sleeper user not found' }
    sleeperUser = user
    saveSettings({ sleeperUsername: username.trim() })
    await refresh()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Sleeper lookup failed' }
  }
}

export const disconnectSleeper = async (): Promise<void> => {
  sleeperUser = null
  saveSettings({ sleeperUsername: null })
  await refresh()
}

export const markEspnRelogin = (needed: boolean): void => {
  espnNeedsRelogin = needed
}

export const addEspnLeagueId = async (leagueId: string): Promise<{ ok: boolean; error?: string }> => {
  const id = leagueId.trim()
  if (!/^\d+$/.test(id)) return { ok: false, error: 'League ID should be numeric' }
  const ids = loadSettings().espnLeagueIds
  if (!ids.includes(id)) saveSettings({ espnLeagueIds: [...ids, id] })
  await refresh()
  const found = currentState().leagues.some((league) => league.provider === 'espn' && league.id === id)
  if (!found && !isReplayMode()) return { ok: false, error: 'Could not load that ESPN league. Sign in or check the ID.' }
  return { ok: true }
}

export const removeEspnLeagueId = async (leagueId: string): Promise<void> => {
  saveSettings({ espnLeagueIds: loadSettings().espnLeagueIds.filter((id) => id !== leagueId) })
  const selected = loadSettings().selectedLeagueKey
  const parsed = selected ? parseLeagueKey(selected) : null
  if (parsed?.provider === 'espn' && parsed.id === leagueId) {
    saveSettings({ selectedLeagueKey: null })
  }
  await refresh()
}

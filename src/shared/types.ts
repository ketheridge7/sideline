import type { OverlayLayout } from './overlayLayout'
import { DEFAULT_OVERLAY_PRESET, layoutFromPreset } from './overlayLayout'
import type { TransactionKind } from './transactionKind'

export type TapeKind = TransactionKind | 'score' | 'injury'

export type TapeEvent = {
  id: string
  at: number
  kind: TapeKind
  player: string
  detail: string
  delta?: number
  leagueKey?: string
  leagueName?: string
  period?: string
}

export type ScorerChip = {
  playerId: string
  name: string
  position: string
  points: number
  delta?: number
}

export type MatchupBoard = {
  key: string
  leagueName: string
  provider: Provider
  week: number
  myName: string
  oppName: string | null
  myPoints: number
  oppPoints: number
  lastScorers: ScorerChip[]
  leadSpark?: number[]
  size?: number
}

export type Provider = 'sleeper' | 'espn'

export type League = {
  id: string
  name: string
  provider: Provider
  season: string
  week: number
}

export type Team = {
  id: string
  name: string
  owner: string
  record: string
}

export type Player = {
  playerId: string
  name: string
  position: string
  points?: number
  status?: string
  nflTeam: string
  lastPlay?: string
  tickDelta?: number
  /** ESPN `lineupSlotId` when known — used to match website starter column order. */
  lineupSlotId?: number
}

export type Matchup = {
  myTeam: Team
  oppTeam: Team | null
  myPoints: number
  oppPoints: number
  starters: Player[]
  bench: Player[]
  oppStarters: Player[]
  oppBench: Player[]
  /** Commissioner override or ESPN winner — HUD may commit a decrease immediately. */
  scoresFinal?: boolean
}

export type Transaction = {
  id: string
  type: TransactionKind
  players: string[]
  timestamp: number
}

export type NflState = {
  week: number
  displayWeek: number
  season: string
  leagueSeason: string
  seasonType: string
}

export type NflTickerGame = {
  id: string
  away: string
  awayScore: number
  home: string
  homeScore: number
  clock: string
  final?: boolean
}

export type OverlayHudState = {
  leagueName: string
  provider: Provider | null
  week: number | null
  myPoints: number
  oppPoints: number
  delta: number
  myName: string
  oppName: string
  myStarters: Player[]
  oppStarters: Player[]
  myBench: Player[]
  oppBench: Player[]
  lastUpdated: number | null
  replay: boolean
  pollingLive: boolean
  toast: ToastPayload | null
  tape: TapeEvent[]
  layout: OverlayLayout
  overlayEditMode: boolean
  nflTicker: NflTickerGame[]
}

export type ToastPayload = {
  id: string
  title: string
  body: string
}

export type AppState = {
  sleeperConnected: boolean
  sleeperUsername: string | null
  espnConnected: boolean
  espnNeedsRelogin: boolean
  nfl: NflState | null
  leagues: League[]
  pinnedLeagueKeys: string[]
  selectedLeagueKey: string | null
  matchup: Matchup | null
  boards: MatchupBoard[]
  tape: TapeEvent[]
  nflTicker: NflTickerGame[]
  overlayPort: number
  overlayVisible: boolean
  overlayHotkey: string
  overlayEditMode: boolean
  overlayLayout: OverlayLayout
  lastToast: ToastPayload | null
  lanOverlayEnabled: boolean
  lanOverlayHost: string | null
  overlayToken: string | null
  overlayPairingCode: string | null
  replay: boolean
  lastUpdated: number | null
  pollMs: number | null
  liveCallMs: number | null
  pollingLive: boolean
  error: string | null
}

/** No-op live ticks skip the full companion AppState clone; these three fields still move the clock. */
export type CompanionTick = Pick<AppState, 'lastUpdated' | 'pollMs' | 'liveCallMs'>

/** Rest LEAGUES upserts skip cloning HUD matchup/tape/ticker/layout; companion merges this patch. */
export type CompanionBoardsPatch = Pick<
  AppState,
  'boards' | 'leagues' | 'lastUpdated' | 'pollMs' | 'liveCallMs'
>

/** Live score ticks skip cloning overlay layout, LAN tokens, connection flags, and the rest LEAGUES grid. */
export type CompanionHudPatch = Pick<
  AppState,
  | 'matchup'
  | 'tape'
  | 'nflTicker'
  | 'pollingLive'
  | 'overlayEditMode'
  | 'lastUpdated'
  | 'pollMs'
  | 'liveCallMs'
>

export const leagueKey = (provider: Provider, id: string): string => `${provider}:${id}`

export const parseLeagueKey = (key: string): { provider: Provider; id: string } | null => {
  const idx = key.indexOf(':')
  if (idx <= 0) return null
  const provider = key.slice(0, idx)
  const id = key.slice(idx + 1)
  if (provider !== 'sleeper' && provider !== 'espn') return null
  if (!id) return null
  return { provider, id }
}

export const emptyAppState = (): AppState => ({
  sleeperConnected: false,
  sleeperUsername: null,
  espnConnected: false,
  espnNeedsRelogin: false,
  nfl: null,
  leagues: [],
  pinnedLeagueKeys: [],
  selectedLeagueKey: null,
  matchup: null,
  boards: [],
  tape: [],
  nflTicker: [],
  overlayPort: 7333,
  overlayVisible: false,
  overlayHotkey: 'CommandOrControl+Shift+O',
  overlayEditMode: false,
  overlayLayout: layoutFromPreset(DEFAULT_OVERLAY_PRESET),
  lastToast: null,
  lanOverlayEnabled: false,
  lanOverlayHost: null,
  overlayToken: null,
  overlayPairingCode: null,
  replay: false,
  lastUpdated: null,
  pollMs: null,
  liveCallMs: null,
  pollingLive: false,
  error: null
})

const hudShell = (state: AppState): Omit<
  OverlayHudState,
  | 'leagueName'
  | 'provider'
  | 'week'
  | 'myPoints'
  | 'oppPoints'
  | 'delta'
  | 'myName'
  | 'oppName'
  | 'myStarters'
  | 'oppStarters'
  | 'myBench'
  | 'oppBench'
> => ({
  lastUpdated: state.lastUpdated,
  replay: state.replay,
  pollingLive: state.pollingLive,
  toast: state.lastToast,
  tape: state.tape,
  layout: state.overlayLayout,
  overlayEditMode: state.overlayEditMode,
  nflTicker: state.nflTicker
})

const sameToast = (prev: ToastPayload | null, next: ToastPayload | null): boolean => {
  if (prev === next) return true
  if (!prev || !next) return false
  return prev.id === next.id && prev.title === next.title && prev.body === next.body
}

const samePlayer = (prev: Player, next: Player): boolean =>
  prev.playerId === next.playerId &&
  prev.name === next.name &&
  prev.position === next.position &&
  prev.points === next.points &&
  prev.status === next.status &&
  prev.nflTeam === next.nflTeam &&
  prev.lastPlay === next.lastPlay &&
  prev.tickDelta === next.tickDelta &&
  prev.lineupSlotId === next.lineupSlotId

const samePlayers = (prev: Player[], next: Player[]): boolean =>
  prev.length === next.length && prev.every((row, index) => samePlayer(row, next[index]))

const sameTape = (prev: TapeEvent[], next: TapeEvent[]): boolean =>
  prev.length === next.length &&
  prev.every((row, index) => {
    const other = next[index]
    return (
      row.id === other.id &&
      row.at === other.at &&
      row.kind === other.kind &&
      row.player === other.player &&
      row.detail === other.detail &&
      row.delta === other.delta &&
      row.leagueKey === other.leagueKey &&
      row.leagueName === other.leagueName &&
      row.period === other.period
    )
  })

const sameTicker = (prev: NflTickerGame[], next: NflTickerGame[]): boolean =>
  prev.length === next.length &&
  prev.every((row, index) => {
    const other = next[index]
    return (
      row.id === other.id &&
      row.away === other.away &&
      row.awayScore === other.awayScore &&
      row.home === other.home &&
      row.homeScore === other.homeScore &&
      row.clock === other.clock &&
      row.final === other.final
    )
  })

const sameLayout = (prev: OverlayLayout, next: OverlayLayout): boolean => {
  if (prev === next) return true
  if (
    prev.presetId !== next.presetId ||
    prev.showCrawler !== next.showCrawler ||
    prev.groupedRails.mine !== next.groupedRails.mine ||
    prev.groupedRails.opp !== next.groupedRails.opp ||
    prev.trackLock.mine !== next.trackLock.mine ||
    prev.trackLock.opp !== next.trackLock.opp ||
    prev.widgets.length !== next.widgets.length
  ) {
    return false
  }
  return prev.widgets.every((row, index) => {
    const other = next.widgets[index]
    return (
      row.id === other.id &&
      row.x === other.x &&
      row.y === other.y &&
      row.w === other.w &&
      row.h === other.h &&
      row.hidden === other.hidden &&
      row.locked === other.locked &&
      row.opacity === other.opacity &&
      row.density === other.density
    )
  })
}

export const overlayHudUnchanged = (prev: OverlayHudState, next: OverlayHudState): boolean =>
  prev.leagueName === next.leagueName &&
  prev.provider === next.provider &&
  prev.week === next.week &&
  prev.myPoints === next.myPoints &&
  prev.oppPoints === next.oppPoints &&
  prev.delta === next.delta &&
  prev.myName === next.myName &&
  prev.oppName === next.oppName &&
  prev.replay === next.replay &&
  prev.pollingLive === next.pollingLive &&
  prev.overlayEditMode === next.overlayEditMode &&
  sameToast(prev.toast, next.toast) &&
  sameLayout(prev.layout, next.layout) &&
  samePlayers(prev.myStarters, next.myStarters) &&
  samePlayers(prev.oppStarters, next.oppStarters) &&
  samePlayers(prev.myBench, next.myBench) &&
  samePlayers(prev.oppBench, next.oppBench) &&
  sameTape(prev.tape, next.tape) &&
  sameTicker(prev.nflTicker, next.nflTicker)

export const toOverlayHud = (state: AppState): OverlayHudState => {
  const selected = state.selectedLeagueKey ? parseLeagueKey(state.selectedLeagueKey) : null
  const league = selected
    ? state.leagues.find((row) => leagueKey(row.provider, row.id) === state.selectedLeagueKey)
    : undefined
  const matchup = state.matchup
  if (!matchup) {
    const espnSignIn = state.espnNeedsRelogin && (league?.provider ?? selected?.provider) === 'espn'
    return {
      ...hudShell(state),
      leagueName: league?.name ?? 'Sideline',
      provider: league?.provider ?? selected?.provider ?? null,
      week: league?.week ?? state.nfl?.displayWeek ?? null,
      myPoints: 0,
      oppPoints: 0,
      delta: 0,
      myName: espnSignIn ? 'Sign in' : '—',
      oppName: espnSignIn ? 'Sign in' : '—',
      myStarters: [],
      oppStarters: [],
      myBench: [],
      oppBench: []
    }
  }
  const espnSignIn = state.espnNeedsRelogin && (league?.provider ?? selected?.provider) === 'espn'
  return {
    ...hudShell(state),
    leagueName: league?.name ?? matchup.myTeam.name,
    provider: league?.provider ?? selected?.provider ?? null,
    week: league?.week ?? state.nfl?.displayWeek ?? null,
    myPoints: matchup.myPoints,
    oppPoints: matchup.oppPoints,
    delta: Math.round((matchup.myPoints - matchup.oppPoints) * 100) / 100,
    myName: matchup.myTeam.name,
    oppName: matchup.oppTeam?.name ?? (espnSignIn ? 'Sign in' : 'BYE'),
    myStarters: matchup.starters ?? [],
    oppStarters: matchup.oppStarters ?? [],
    myBench: matchup.bench ?? [],
    oppBench: matchup.oppBench ?? []
  }
}

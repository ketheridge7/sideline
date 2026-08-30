import type { OverlayLayout } from './overlayLayout'
import { layoutFromPreset } from './overlayLayout'
import type { TransactionKind } from './transactionKind'

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
  layout: OverlayLayout
  overlayEditMode: boolean
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
  overlayPort: number
  overlayVisible: boolean
  overlayHotkey: string
  overlayEditMode: boolean
  overlayLayout: OverlayLayout
  lastToast: ToastPayload | null
  lanOverlayEnabled: boolean
  lanOverlayHost: string | null
  overlayToken: string | null
  replay: boolean
  lastUpdated: number | null
  pollingLive: boolean
  error: string | null
}

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
  overlayPort: 7333,
  overlayVisible: false,
  overlayHotkey: 'CommandOrControl+Shift+O',
  overlayEditMode: false,
  overlayLayout: layoutFromPreset('broadcast-l'),
  lastToast: null,
  lanOverlayEnabled: false,
  lanOverlayHost: null,
  overlayToken: null,
  replay: false,
  lastUpdated: null,
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
  layout: state.overlayLayout,
  overlayEditMode: state.overlayEditMode
})

export const toOverlayHud = (state: AppState): OverlayHudState => {
  const league = state.leagues.find((row) => leagueKey(row.provider, row.id) === state.selectedLeagueKey)
  const matchup = state.matchup
  if (!league || !matchup) {
    return {
      ...hudShell(state),
      leagueName: league?.name ?? 'Sideline',
      provider: league?.provider ?? null,
      week: league?.week ?? state.nfl?.displayWeek ?? null,
      myPoints: 0,
      oppPoints: 0,
      delta: 0,
      myName: '—',
      oppName: '—',
      myStarters: [],
      oppStarters: [],
      myBench: [],
      oppBench: []
    }
  }
  return {
    ...hudShell(state),
    leagueName: league.name,
    provider: league.provider,
    week: league.week,
    myPoints: matchup.myPoints,
    oppPoints: matchup.oppPoints,
    delta: Math.round((matchup.myPoints - matchup.oppPoints) * 100) / 100,
    myName: matchup.myTeam.name,
    oppName: matchup.oppTeam?.name ?? 'BYE',
    myStarters: matchup.starters ?? [],
    oppStarters: matchup.oppStarters ?? [],
    myBench: matchup.bench ?? [],
    oppBench: matchup.oppBench ?? []
  }
}

import type {
  AppState,
  CompanionHudPatch,
  League,
  Matchup,
  MatchupBoard,
  Player,
  Provider,
  ScorerChip
} from './types'
import { leagueKey, parseLeagueKey, preferStoredLeagueName } from './types'
import {
  estimatedChanceToWin,
  providerChanceToWin,
  type ChanceToWin,
  type WinPctSource
} from './winPct'

const HIDDEN_STATUS = new Set(['', 'ACTIVE', 'NORMAL', 'HEALTHY', 'NA', 'N/A'])

export const matchupHasLineup = (matchup: Matchup | null | undefined): boolean => {
  if (!matchup) return false
  return matchup.starters.some((player) => Boolean(player.playerId && player.name && player.position))
}

/** Companion SCOREBOARD / ES pip: auth-fail vs names-without-starters vs a named lineup. */
export type EspnBoardUx = 'healthy-lineup' | 'empty-roster' | 'auth-fail'

export const espnBoardUx = (opts: {
  provider?: Provider | null
  espnConnected: boolean
  espnNeedsRelogin: boolean
  matchup: Matchup | null
}): EspnBoardUx => {
  if (opts.provider !== 'espn') return 'healthy-lineup'
  const named = matchupHasLineup(opts.matchup)
  if (opts.espnNeedsRelogin || (!opts.espnConnected && !named)) return 'auth-fail'
  if (!named) return 'empty-roster'
  return 'healthy-lineup'
}

/** ES pip is healthy only when the session is connected and the last ESPN fetch was not 401. */
export const espnIndicatorHealthy = (opts: {
  replay: boolean
  espnConnected: boolean
  espnNeedsRelogin: boolean
}): boolean => opts.replay || (opts.espnConnected && !opts.espnNeedsRelogin)

export const overlayStartersBelong = (prev: Player[], liveIds: Iterable<string>): boolean => {
  const ids = new Set<string>()
  for (const id of liveIds) {
    if (id) ids.add(id)
  }
  if (ids.size === 0) return true
  const prevIds = prev.filter((player) => Boolean(player.playerId))
  if (prevIds.length === 0) return false
  return prevIds.some((player) => {
    if (ids.has(player.playerId)) return true
    const coerced = Number(player.playerId)
    return Number.isFinite(coerced) && ids.has(String(coerced))
  })
}

export const visibleInjury = (status?: string): string | null => {
  if (!status) return null
  const key = status.trim().toUpperCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
  if (!key || HIDDEN_STATUS.has(key) || HIDDEN_STATUS.has(key.replace(/\s+/g, ''))) return null
  if (key === 'INJURY RESERVE' || key === 'INJURED RESERVE' || key === 'IR') return 'IR'
  if (key === 'QUESTIONABLE') return 'Q'
  if (key === 'DOUBTFUL') return 'D'
  if (key === 'OUT') return 'OUT'
  if (key.includes('SUSP')) return 'SUS'
  if (key.startsWith('PUP')) return 'PUP'
  if (key.length <= 4) return key
  if (key.length <= 8) return key
  return null
}

export const nflTeamLabel = (value: string | undefined): string => {
  if (!value) return ''
  if (/^\d+$/.test(value.trim())) return ''
  return value
}

const NAME_SUFFIX = /^(jr|sr|ii|iii|iv|v)\.?$/i
const NAME_PARTICLE = /^(st\.?|van|von|de|del|la|le)$/i

/** Surname for tight rails and tape: drops Jr./III, keeps "St. Brown". */
export const lastName = (name: string): string => {
  if (/D\/ST|DST|\bDEF\b/i.test(name)) return name
  const parts = name.trim().split(/\s+/)
  if (parts.length <= 1) return name
  while (parts.length > 2 && NAME_SUFFIX.test(parts[parts.length - 1])) parts.pop()
  const surname = parts[parts.length - 1]
  const particle = parts.length > 2 ? parts[parts.length - 2] : ''
  return NAME_PARTICLE.test(particle) ? `${particle} ${surname}` : surname
}

export const tapePlayerLabel = (player: Player): string => {
  const team = nflTeamLabel(player.nflTeam)
  const name = lastName(player.name)
  return team ? `${name} ${team}` : name
}

export const matchupWinPctSource = (
  matchup: Pick<Matchup, 'winPctSource'> | Pick<MatchupBoard, 'winPctSource'>
): WinPctSource => (matchup.winPctSource === 'estimated' ? 'estimated' : 'official')

/** Chance to win. ESPN stays official; Sleeper estimate uses projected finals. */
export const matchupChanceToWin = (matchup: Matchup): ChanceToWin | null => {
  if (!matchup.oppTeam) return null
  if (matchup.winPctSource === 'estimated') {
    return estimatedChanceToWin({
      myLive: matchup.myPoints,
      oppLive: matchup.oppPoints,
      myProjected: matchup.myProjectedPoints,
      oppProjected: matchup.oppProjectedPoints,
      scoresFinal: matchup.scoresFinal
    })
  }
  return providerChanceToWin(matchup.myWinPct, matchup.oppWinPct)
}

export const boardChanceToWin = (
  board: Pick<
    MatchupBoard,
    | 'myWinPct'
    | 'oppWinPct'
    | 'oppName'
    | 'winPctSource'
    | 'myPoints'
    | 'oppPoints'
    | 'myProjectedPoints'
    | 'oppProjectedPoints'
    | 'scoresFinal'
  >
): ChanceToWin | null => {
  if (!board.oppName) return null
  if (board.winPctSource === 'estimated') {
    return estimatedChanceToWin({
      myLive: board.myPoints,
      oppLive: board.oppPoints,
      myProjected: board.myProjectedPoints,
      oppProjected: board.oppProjectedPoints,
      scoresFinal: board.scoresFinal
    })
  }
  return providerChanceToWin(board.myWinPct, board.oppWinPct)
}

export const sparklinePoints = (values: number[], width: number, height: number): string => {
  if (values.length < 2) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width
      const y = height - ((value - min) / span) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

const chipFrom = (player: Player): ScorerChip => ({
  playerId: player.playerId,
  name: player.name,
  position: player.position,
  points: player.points ?? 0
})

/** LEAGUES card chips: highest starter points, not who just ticked. */
export const liveScorers = (matchup: Matchup | null, limit = 3): ScorerChip[] => {
  if (!matchup) return []
  const roster = [...matchup.starters, ...matchup.oppStarters]
  return roster
    .filter((player) => typeof player.points === 'number' && player.points > 0)
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .slice(0, limit)
    .map((player) => chipFrom(player))
}

export type MatchupBoardExtra = {
  leadSpark?: number[]
  size?: number
  espnNeedsRelogin?: boolean
  refreshing?: boolean
}

export const toMatchupBoard = (
  league: League,
  matchup: Matchup | null,
  extra?: MatchupBoardExtra
): MatchupBoard => {
  const espnSignIn = league.provider === 'espn' && Boolean(extra?.espnNeedsRelogin)
  return {
    key: leagueKey(league.provider, league.id),
    leagueName: league.name,
    provider: league.provider,
    week: league.week,
    myName: matchup?.myTeam.name ?? (espnSignIn ? 'Sign in' : '—'),
    oppName: matchup?.oppTeam?.name ?? (espnSignIn ? 'Sign in' : null),
    myPoints: matchup?.myPoints ?? 0,
    oppPoints: matchup?.oppPoints ?? 0,
    ...(matchup?.myProjectedPoints != null ? { myProjectedPoints: matchup.myProjectedPoints } : {}),
    ...(matchup?.oppProjectedPoints != null ? { oppProjectedPoints: matchup.oppProjectedPoints } : {}),
    ...(matchup?.myWinPct != null ? { myWinPct: matchup.myWinPct } : {}),
    ...(matchup?.oppWinPct != null ? { oppWinPct: matchup.oppWinPct } : {}),
    ...(matchup?.winPctSource ? { winPctSource: matchup.winPctSource } : {}),
    ...(matchup?.scoresFinal ? { scoresFinal: true } : {}),
    lastScorers: liveScorers(matchup),
    leadSpark: extra?.leadSpark,
    size: extra?.size,
    ...(extra?.refreshing ? { refreshing: true } : {})
  }
}

/** Week rollover: keep identity/lineup, drop prior-week live/final points. */
export const weekShiftClearedMatchup = (matchup: Matchup): Matchup => {
  const zeroed = (players: Player[]): Player[] => players.map((player) => ({ ...player, points: 0 }))
  return {
    myTeam: matchup.myTeam,
    oppTeam: matchup.oppTeam,
    myPoints: 0,
    oppPoints: 0,
    starters: zeroed(matchup.starters),
    bench: zeroed(matchup.bench),
    oppStarters: zeroed(matchup.oppStarters),
    oppBench: zeroed(matchup.oppBench)
  }
}

export const weekShiftClearedBoard = (
  board: MatchupBoard,
  week: number,
  extra?: Pick<MatchupBoardExtra, 'refreshing' | 'size'>
): MatchupBoard => {
  const size = extra?.size ?? board.size
  return {
    key: board.key,
    leagueName: board.leagueName,
    provider: board.provider,
    week,
    myName: board.myName,
    oppName: board.oppName,
    myPoints: 0,
    oppPoints: 0,
    lastScorers: [],
    ...(size != null ? { size } : {}),
    ...(extra?.refreshing ? { refreshing: true } : {})
  }
}

export const upsertMatchupBoard = (boards: MatchupBoard[], next: MatchupBoard): MatchupBoard[] => {
  const index = boards.findIndex((row) => row.key === next.key)
  if (index < 0) return [...boards, next]
  const prev = boards[index]
  const id = parseLeagueKey(next.key)?.id
  const leagueName = id
    ? preferStoredLeagueName(next.leagueName, id, prev.leagueName)
    : next.leagueName
  const merged = leagueName === next.leagueName ? next : { ...next, leagueName }
  return boards.map((row, rowIndex) => (rowIndex === index ? merged : row))
}

export const applyCompanionHudPatch = (current: AppState, patch: CompanionHudPatch): AppState => {
  const next: AppState = { ...current, ...patch }
  const matchup = next.matchup
  const key = current.selectedLeagueKey
  if (!matchup || !key) return next
  const parsed = parseLeagueKey(key)
  const fromLeagues = current.leagues.find((row) => leagueKey(row.provider, row.id) === key)
  const storedName = current.boards.find((row) => row.key === key)?.leagueName
  const incomingName = fromLeagues?.name ?? matchup.myTeam.name
  const name = parsed ? preferStoredLeagueName(incomingName, parsed.id, storedName) : incomingName
  const league: League | undefined = fromLeagues
    ? { ...fromLeagues, name }
    : parsed
      ? {
          id: parsed.id,
          name,
          provider: parsed.provider,
          season: current.nfl?.leagueSeason ?? '',
          week: current.nfl?.displayWeek ?? 0
        }
      : undefined
  if (!league) return next
  return { ...next, boards: upsertMatchupBoard(current.boards, toMatchupBoard(league, matchup)) }
}

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
import { leagueKey, parseLeagueKey } from './types'
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

export const lastName = (name: string): string => {
  if (/D\/ST|DST|\bDEF\b/i.test(name)) return name
  const parts = name.trim().split(/\s+/)
  if (parts.length <= 1) return name
  return parts[parts.length - 1]
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

const chipFrom = (player: Player, delta?: number): ScorerChip => ({
  playerId: player.playerId,
  name: player.name,
  position: player.position,
  points: player.points ?? 0,
  delta: delta ?? player.tickDelta
})

export const liveScorers = (matchup: Matchup | null, limit = 3): ScorerChip[] => {
  if (!matchup) return []
  const roster = [...matchup.starters, ...matchup.oppStarters]
  const ticked = roster.filter((player) => typeof player.tickDelta === 'number' && player.tickDelta !== 0)
  const pool = ticked.length > 0 ? ticked : roster.filter((player) => typeof player.points === 'number' && player.points > 0)
  return [...pool]
    .sort((a, b) => {
      const aDelta = Math.abs(a.tickDelta ?? 0)
      const bDelta = Math.abs(b.tickDelta ?? 0)
      if (aDelta !== bDelta) return bDelta - aDelta
      return (b.points ?? 0) - (a.points ?? 0)
    })
    .slice(0, limit)
    .map((player) => chipFrom(player))
}

export type MatchupBoardExtra = {
  lastScorers?: ScorerChip[]
  leadSpark?: number[]
  size?: number
  espnNeedsRelogin?: boolean
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
    lastScorers: extra?.lastScorers?.length ? extra.lastScorers.slice(0, 3) : liveScorers(matchup),
    leadSpark: extra?.leadSpark,
    size: extra?.size
  }
}

export const upsertMatchupBoard = (boards: MatchupBoard[], next: MatchupBoard): MatchupBoard[] => {
  const index = boards.findIndex((row) => row.key === next.key)
  if (index < 0) return [...boards, next]
  return boards.map((row, rowIndex) => (rowIndex === index ? next : row))
}

export const applyCompanionHudPatch = (current: AppState, patch: CompanionHudPatch): AppState => {
  const next: AppState = { ...current, ...patch }
  const matchup = next.matchup
  const key = current.selectedLeagueKey
  if (!matchup || !key) return next
  const parsed = parseLeagueKey(key)
  const league: League | undefined =
    current.leagues.find((row) => leagueKey(row.provider, row.id) === key) ??
    (parsed
      ? {
          id: parsed.id,
          name: matchup.myTeam.name,
          provider: parsed.provider,
          season: current.nfl?.leagueSeason ?? '',
          week: current.nfl?.displayWeek ?? 0
        }
      : undefined)
  if (!league) return next
  return { ...next, boards: upsertMatchupBoard(current.boards, toMatchupBoard(league, matchup)) }
}

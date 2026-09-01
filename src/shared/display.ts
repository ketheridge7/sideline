import type { AppState, CompanionHudPatch, League, Matchup, MatchupBoard, Player, ScorerChip } from './types'
import { leagueKey, parseLeagueKey } from './types'

const HIDDEN_STATUS = new Set(['', 'ACTIVE', 'NORMAL', 'HEALTHY', 'NA', 'N/A'])

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

export const leadShare = (mine: number, opp: number): { mine: number; opp: number } => {
  const total = mine + opp
  if (!(total > 0)) return { mine: 0.5, opp: 0.5 }
  return { mine: mine / total, opp: opp / total }
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
}

export const toMatchupBoard = (
  league: League,
  matchup: Matchup | null,
  extra?: MatchupBoardExtra
): MatchupBoard => ({
  key: leagueKey(league.provider, league.id),
  leagueName: league.name,
  provider: league.provider,
  week: league.week,
  myName: matchup?.myTeam.name ?? '—',
  oppName: matchup?.oppTeam?.name ?? null,
  myPoints: matchup?.myPoints ?? 0,
  oppPoints: matchup?.oppPoints ?? 0,
  lastScorers: extra?.lastScorers?.length ? extra.lastScorers.slice(0, 3) : liveScorers(matchup),
  leadSpark: extra?.leadSpark,
  size: extra?.size
})

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

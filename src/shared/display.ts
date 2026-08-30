import type { League, Matchup, MatchupBoard, Player, ScorerChip } from './types'
import { leagueKey } from './types'

const HIDDEN_STATUS = new Set(['', 'ACTIVE', 'NORMAL', 'HEALTHY', 'NA', 'N/A'])

export const visibleInjury = (status?: string): string | null => {
  if (!status) return null
  const key = status.trim().toUpperCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
  if (!key || HIDDEN_STATUS.has(key) || HIDDEN_STATUS.has(key.replace(/\s+/g, ''))) return null
  if (key === 'INJURY RESERVE' || key === 'IR') return 'IR'
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
  delta
})

export const liveScorers = (matchup: Matchup | null, limit = 3): ScorerChip[] => {
  if (!matchup) return []
  return [...matchup.starters]
    .filter((player) => typeof player.points === 'number' && player.points > 0)
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .slice(0, limit)
    .map((player) => chipFrom(player))
}

export const toMatchupBoard = (league: League, matchup: Matchup | null): MatchupBoard => ({
  key: leagueKey(league.provider, league.id),
  leagueName: league.name,
  provider: league.provider,
  week: league.week,
  myName: matchup?.myTeam.name ?? '—',
  oppName: matchup?.oppTeam?.name ?? null,
  myPoints: matchup?.myPoints ?? 0,
  oppPoints: matchup?.oppPoints ?? 0,
  lastScorers: liveScorers(matchup)
})

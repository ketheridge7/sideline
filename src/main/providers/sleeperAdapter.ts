import type { League, Matchup, Player, Team, Transaction } from '@shared/types'
import { mapTransactionKind } from '@shared/transactionKind'
import type {
  CachedPlayer,
  SleeperLeague,
  SleeperLeagueUser,
  SleeperMatchup,
  SleeperNflState,
  SleeperRoster,
  SleeperTransaction
} from './sleeperClient'

export const toNflState = (raw: SleeperNflState) => ({
  week: raw.week,
  displayWeek: raw.display_week,
  season: raw.season,
  leagueSeason: raw.league_season,
  seasonType: raw.season_type
})

export const toLeagues = (
  leagues: SleeperLeague[],
  leagueSeason: string,
  displayWeek: number
): League[] =>
  leagues.map((league) => ({
    id: league.league_id,
    name: league.name,
    provider: 'sleeper' as const,
    season: league.season || leagueSeason,
    week: displayWeek
  }))

const recordOf = (roster: SleeperRoster): string => {
  const wins = roster.settings?.wins ?? 0
  const losses = roster.settings?.losses ?? 0
  const ties = roster.settings?.ties ?? 0
  if (ties > 0) return `${wins}-${losses}-${ties}`
  return `${wins}-${losses}`
}

const teamFromRoster = (roster: SleeperRoster, users: SleeperLeagueUser[]): Team => {
  const user = users.find((row) => row.user_id === roster.owner_id)
  const name = user?.metadata?.team_name || user?.display_name || `Roster ${roster.roster_id}`
  return {
    id: String(roster.roster_id),
    name,
    owner: user?.display_name || 'Unknown',
    record: recordOf(roster)
  }
}

const lookupPlayer = (
  players: Record<string, CachedPlayer>,
  playerId: string
): CachedPlayer => players[playerId] ?? { name: playerId, position: '?', nflTeam: '' }

const isMyRoster = (roster: SleeperRoster, userId: string): boolean => {
  if (roster.owner_id === userId) return true
  return Boolean(roster.co_owners?.includes(userId))
}

const pointsForPlayer = (
  matchup: SleeperMatchup,
  playerId: string,
  starterIndex: number
): number | undefined => {
  if (matchup.players_points && Object.prototype.hasOwnProperty.call(matchup.players_points, playerId)) {
    return matchup.players_points[playerId]
  }
  if (Array.isArray(matchup.starters_points) && starterIndex >= 0) {
    const value = matchup.starters_points[starterIndex]
    if (typeof value === 'number') return value
  }
  return undefined
}

const toPlayer = (
  playerId: string,
  matchup: SleeperMatchup,
  starterIndex: number,
  players: Record<string, CachedPlayer>
): Player => {
  const meta = lookupPlayer(players, playerId)
  return {
    playerId,
    name: meta.name,
    position: meta.position,
    nflTeam: meta.nflTeam,
    status: meta.status,
    points: pointsForPlayer(matchup, playerId, starterIndex)
  }
}

const teamTotal = (matchup: SleeperMatchup): number => {
  if (typeof matchup.custom_points === 'number') return matchup.custom_points
  return matchup.points ?? 0
}

export const toMatchup = (args: {
  userId: string
  rosters: SleeperRoster[]
  users: SleeperLeagueUser[]
  matchups: SleeperMatchup[]
  players: Record<string, CachedPlayer>
}): Matchup | null => {
  const myRoster = args.rosters.find((roster) => isMyRoster(roster, args.userId))
  if (!myRoster) return null
  const myMatchup = args.matchups.find((row) => row.roster_id === myRoster.roster_id)
  if (!myMatchup) return null
  const oppMatchup =
    myMatchup.matchup_id == null
      ? undefined
      : args.matchups.find(
          (row) => row.matchup_id === myMatchup.matchup_id && row.roster_id !== myRoster.roster_id
        )
  const oppRoster = oppMatchup
    ? args.rosters.find((roster) => roster.roster_id === oppMatchup.roster_id)
    : undefined

  const starterIds = myMatchup.starters ?? []
  const starters = starterIds.map((id, index) => toPlayer(id, myMatchup, index, args.players))
  const starterSet = new Set(starterIds)
  const bench = (myMatchup.players ?? [])
    .filter((id) => !starterSet.has(id))
    .map((id) => toPlayer(id, myMatchup, -1, args.players))

  const oppStarterIds = oppMatchup?.starters ?? []
  const oppStarters = oppStarterIds.map((id, index) =>
    toPlayer(id, oppMatchup as SleeperMatchup, index, args.players)
  )
  const oppStarterSet = new Set(oppStarterIds)
  const oppBench = (oppMatchup?.players ?? [])
    .filter((id) => !oppStarterSet.has(id))
    .map((id) => toPlayer(id, oppMatchup as SleeperMatchup, -1, args.players))

  return {
    myTeam: teamFromRoster(myRoster, args.users),
    oppTeam: oppRoster ? teamFromRoster(oppRoster, args.users) : null,
    myPoints: teamTotal(myMatchup),
    oppPoints: oppMatchup ? teamTotal(oppMatchup) : 0,
    starters,
    bench,
    oppStarters: oppMatchup ? oppStarters : [],
    oppBench: oppMatchup ? oppBench : []
  }
}

export const toTransactions = (
  rows: SleeperTransaction[],
  players: Record<string, CachedPlayer>
): Transaction[] => {
  return rows
    .filter((row) => !row.status || row.status === 'complete')
    .map((row) => {
      const addIds = Object.keys(row.adds ?? {})
      const dropIds = Object.keys(row.drops ?? {})
      const ids = [...addIds, ...dropIds]
      return {
        id: row.transaction_id,
        type: mapTransactionKind(row.type, addIds.length, dropIds.length),
        players: ids.map((id) => lookupPlayer(players, id).name),
        timestamp: row.status_updated || row.created || 0
      }
    })
}

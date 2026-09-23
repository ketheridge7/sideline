import { overlayStartersBelong } from '@shared/display'
import type { League, Matchup, Player, Team, Transaction } from '@shared/types'
import { mapTransactionKind } from '@shared/transactionKind'
import {
  estimatedChanceToWin,
  hasProjectedFinals,
  nflTeamKey,
  playerProjectedFinal
} from '@shared/winPct'
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

const asInt = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isInteger(parsed)) return parsed
  }
  return undefined
}

const playerIdOf = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim() !== '') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

const rosterIdOf = (row: { roster_id?: unknown }): number | undefined => asInt(row.roster_id)

const matchupIdOf = (row: { matchup_id?: unknown }): number | undefined => asInt(row.matchup_id)

const recordOf = (roster: SleeperRoster): string => {
  const wins = roster.settings?.wins ?? 0
  const losses = roster.settings?.losses ?? 0
  const ties = roster.settings?.ties ?? 0
  if (ties > 0) return `${wins}-${losses}-${ties}`
  return `${wins}-${losses}`
}

const teamFromRoster = (roster: SleeperRoster, users: SleeperLeagueUser[]): Team => {
  const user = users.find((row) => String(row.user_id) === String(roster.owner_id))
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
): CachedPlayer => {
  const direct = players[playerId]
  if (direct) return direct
  const coerced = Number(playerId)
  if (!Number.isFinite(coerced)) return { name: playerId, position: '?', nflTeam: '' }
  return (
    players[String(coerced)] ??
    players[coerced as unknown as string] ?? { name: playerId, position: '?', nflTeam: '' }
  )
}

const isMyRoster = (roster: SleeperRoster, userId: string): boolean => {
  const mine = String(userId)
  if (String(roster.owner_id) === mine) return true
  return Boolean(roster.co_owners?.some((owner) => String(owner) === mine))
}

const asPts = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

const ptsFromMap = (map: Record<string, number> | undefined, playerId: string): number | undefined => {
  if (!map) return undefined
  const direct = asPts(map[playerId])
  if (direct != null) return direct
  const coerced = Number(playerId)
  if (!Number.isFinite(coerced)) return undefined
  return asPts(map[String(coerced)]) ?? asPts(map[coerced as unknown as string])
}

const pointsForPlayer = (
  matchup: SleeperMatchup,
  playerId: string,
  starterIndex: number
): number | undefined => {
  const fromMap = ptsFromMap(matchup.players_points, playerId)
  const fromStarters =
    Array.isArray(matchup.starters_points) && starterIndex >= 0
      ? asPts(matchup.starters_points[starterIndex])
      : undefined
  if (fromMap != null && fromMap > 0) return fromMap
  if (fromStarters != null && fromStarters > 0) return fromStarters
  if (fromMap === 0 || fromStarters === 0) return 0
  return fromMap ?? fromStarters
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

const starterPointsSum = (matchup: SleeperMatchup): number => {
  const ids = matchup.starters ?? []
  let sum = 0
  for (let index = 0; index < ids.length; index++) {
    const id = playerIdOf(ids[index])
    if (!id) continue
    const pts = pointsForPlayer(matchup, id, index)
    if (typeof pts === 'number') sum += pts
  }
  return sum
}

const teamTotal = (matchup: SleeperMatchup): number => {
  const custom = asPts(matchup.custom_points)
  if (custom != null) return custom
  const pts = asPts(matchup.points)
  if (pts != null && pts > 0) return pts
  return Math.max(pts ?? 0, starterPointsSum(matchup))
}

const hasCachedPlayers = (players: Record<string, CachedPlayer>): boolean => {
  for (const id in players) {
    if (Object.prototype.hasOwnProperty.call(players, id)) return true
  }
  return false
}

export const applyPlayerNames = (
  matchup: Matchup,
  players: Record<string, CachedPlayer>
): Matchup => {
  if (!hasCachedPlayers(players)) return matchup
  const named = (player: Player): Player => {
    const meta = lookupPlayer(players, player.playerId)
    if (!meta) return player
    return {
      ...player,
      name: meta.name || player.name,
      position: meta.position || player.position,
      nflTeam: meta.nflTeam || player.nflTeam,
      status: meta.status ?? player.status
    }
  }
  return {
    ...matchup,
    starters: matchup.starters.map(named),
    bench: matchup.bench.map(named),
    oppStarters: matchup.oppStarters.map(named),
    oppBench: matchup.oppBench.map(named)
  }
}

const ptsForPlayerId = (row: SleeperMatchup, playerId: string): number | undefined => {
  const id = playerIdOf(playerId) ?? playerId
  const index = (row.starters ?? []).map(playerIdOf).indexOf(id)
  return pointsForPlayer(row, id, index)
}

const hasLivePts = (row: SleeperMatchup): boolean => {
  if (row.custom_points != null) return true
  const pts = asPts(row.points)
  if (pts != null && pts > 0) return true
  if (row.starters_points?.some((value) => {
    const n = asPts(value)
    return n != null && n > 0
  })) return true
  if (row.players_points) {
    for (const value of Object.values(row.players_points)) {
      const n = asPts(value)
      if (n != null && n > 0) return true
    }
  }
  return false
}

const overlayTotal = (prevPts: number, row: SleeperMatchup): number => {
  const live = teamTotal(row)
  return hasLivePts(row) ? live : Math.max(prevPts, live)
}

const hasPositivePlayerPts = (row: SleeperMatchup): boolean => {
  if (row.starters_points?.some((value) => {
    const n = asPts(value)
    return n != null && n > 0
  })) return true
  if (row.players_points) {
    for (const value of Object.values(row.players_points)) {
      const n = asPts(value)
      if (n != null && n > 0) return true
    }
  }
  return false
}

const overlayPlayers = (players: Player[], row: SleeperMatchup): Player[] =>
  players.map((player) => {
    const pts = ptsForPlayerId(row, player.playerId)
    if (pts == null) return player
    if (hasLivePts(row)) {
      if (pts > 0 || hasPositivePlayerPts(row)) return { ...player, points: pts }
      return player
    }
    return { ...player, points: Math.max(pts, player.points ?? 0) }
  })

const sleeperOfficialWin = (
  mine?: number,
  opp?: number,
  prev?: Pick<Matchup, 'myWinPct' | 'oppWinPct' | 'winPctSource'>
): Pick<Matchup, 'myWinPct' | 'oppWinPct' | 'winPctSource'> => {
  const officialNow = mine != null || opp != null
  const keepOfficial = prev?.winPctSource === 'official' && (prev.myWinPct != null || prev.oppWinPct != null)
  if (!officialNow && !keepOfficial) return { winPctSource: 'estimated' }
  return {
    winPctSource: 'official',
    ...(mine != null ? { myWinPct: mine } : prev?.myWinPct != null ? { myWinPct: prev.myWinPct } : {}),
    ...(opp != null ? { oppWinPct: opp } : prev?.oppWinPct != null ? { oppWinPct: prev.oppWinPct } : {})
  }
}

const projectionOf = (map: Record<string, number>, playerId: string): number | undefined => {
  const direct = map[playerId]
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct
  const coerced = Number(playerId)
  if (!Number.isFinite(coerced)) return undefined
  const alt = map[String(coerced)] ?? map[coerced as unknown as string]
  return typeof alt === 'number' && Number.isFinite(alt) ? alt : undefined
}

/** Weekly starter projection sum. Any missing starter projection → undefined (pending). */
export const starterProjectedTotal = (
  starters: Player[],
  projections: Record<string, number>
): number | undefined => {
  const ids = starters.map((player) => player.playerId).filter((id) => Boolean(id))
  if (ids.length === 0) return undefined
  let sum = 0
  for (const id of ids) {
    const pts = projectionOf(projections, id)
    if (pts == null) return undefined
    sum += pts
  }
  return sum
}

/**
 * Remaining-aware starter final: players whose NFL game is final count their
 * actual points; everyone else max(actual, weekly projection). Undefined
 * (pending) when a starter still to play has no projection.
 */
export const starterProjectedFinal = (
  starters: Player[],
  projections: Record<string, number>,
  finalTeams: ReadonlySet<string> = new Set()
): number | undefined => {
  const rows = starters.filter((player) => Boolean(player.playerId))
  if (rows.length === 0) return undefined
  let sum = 0
  for (const player of rows) {
    const pts = playerProjectedFinal({
      actual: player.points,
      projected: projectionOf(projections, player.playerId),
      gameFinal: finalTeams.has(nflTeamKey(player.nflTeam))
    })
    if (pts == null) return undefined
    sum += pts
  }
  return sum
}

const withoutEstimatedWin = (matchup: Matchup): Matchup => {
  const {
    myWinPct: _mine,
    oppWinPct: _opp,
    myProjectedPoints: _myProj,
    oppProjectedPoints: _oppProj,
    winPctSource: _source,
    ...rest
  } = matchup
  return { ...rest, winPctSource: 'estimated' }
}

/**
 * Sleeper Est. win% from per-player remaining-aware finals + live points.
 * `finalTeams` are NFL teams whose game is final (scoreboard ticker).
 * Official REST win_probability is left alone. Missing projections stay pending.
 */
export const applySleeperWinEstimate = (
  matchup: Matchup,
  projections: Record<string, number> | null | undefined,
  finalTeams: ReadonlySet<string> = new Set()
): Matchup => {
  if (matchup.winPctSource === 'official') return matchup
  const pending = withoutEstimatedWin(matchup)
  if (!projections || !matchup.oppTeam) return pending
  const myProjected = starterProjectedFinal(matchup.starters, projections, finalTeams)
  const oppProjected = starterProjectedFinal(matchup.oppStarters, projections, finalTeams)
  if (!hasProjectedFinals(myProjected, oppProjected)) return pending
  const chance = estimatedChanceToWin({
    myLive: matchup.myPoints,
    oppLive: matchup.oppPoints,
    myProjected,
    oppProjected,
    scoresFinal: matchup.scoresFinal
  })
  return {
    ...pending,
    myProjectedPoints: myProjected,
    oppProjectedPoints: oppProjected,
    ...(chance
      ? { myWinPct: chance.mine, oppWinPct: chance.opp, winPctSource: 'estimated' as const }
      : { winPctSource: 'estimated' as const })
  }
}

export const overlaySleeperMatchups = (prev: Matchup, matchups: SleeperMatchup[]): Matchup | null => {
  const myId = asInt(prev.myTeam.id)
  if (myId == null) return null
  const mine = matchups.find((row) => rosterIdOf(row) === myId)
  if (!mine) return null
  const liveIds = (mine.starters ?? []).map(playerIdOf).filter((id): id is string => id != null)
  if (!overlayStartersBelong(prev.starters, liveIds)) return null
  const oppId = prev.oppTeam ? asInt(prev.oppTeam.id) : undefined
  const opp =
    oppId != null
      ? matchups.find((row) => rosterIdOf(row) === oppId)
      : matchups.find(
          (row) => matchupIdOf(row) === matchupIdOf(mine) && rosterIdOf(row) !== rosterIdOf(mine)
        )
  const next: Matchup = {
    ...prev,
    myPoints: overlayTotal(prev.myPoints, mine),
    oppPoints: opp ? overlayTotal(prev.oppPoints, opp) : prev.oppPoints,
    starters: overlayPlayers(prev.starters, mine),
    bench: overlayPlayers(prev.bench, mine),
    oppStarters: opp ? overlayPlayers(prev.oppStarters, opp) : prev.oppStarters,
    oppBench: opp ? overlayPlayers(prev.oppBench, opp) : prev.oppBench,
    scoresFinal: mine.custom_points != null || opp?.custom_points != null
  }
  const win = sleeperOfficialWin(mine.win_probability, opp?.win_probability, prev)
  if (win.winPctSource === 'official') return { ...next, ...win }
  return withoutEstimatedWin(next)
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
  const myRosterId = rosterIdOf(myRoster)
  if (myRosterId == null) return null
  const myMatchup = args.matchups.find((row) => rosterIdOf(row) === myRosterId)
  if (!myMatchup) return null
  const myMatchupId = matchupIdOf(myMatchup)
  const oppMatchup =
    myMatchupId == null
      ? undefined
      : args.matchups.find((row) => matchupIdOf(row) === myMatchupId && rosterIdOf(row) !== myRosterId)
  const oppRoster = oppMatchup
    ? args.rosters.find((roster) => rosterIdOf(roster) === rosterIdOf(oppMatchup))
    : undefined

  const starterIds = (myMatchup.starters ?? []).map(playerIdOf).filter((id): id is string => id != null)
  const starters = starterIds.map((id, index) => toPlayer(id, myMatchup, index, args.players))
  const starterSet = new Set(starterIds)
  const bench = (myMatchup.players ?? [])
    .map(playerIdOf)
    .filter((id): id is string => id != null && !starterSet.has(id))
    .map((id) => toPlayer(id, myMatchup, -1, args.players))

  const oppStarterIds = (oppMatchup?.starters ?? []).map(playerIdOf).filter((id): id is string => id != null)
  const oppStarters = oppStarterIds.map((id, index) =>
    toPlayer(id, oppMatchup as SleeperMatchup, index, args.players)
  )
  const oppStarterSet = new Set(oppStarterIds)
  const oppBench = (oppMatchup?.players ?? [])
    .map(playerIdOf)
    .filter((id): id is string => id != null && !oppStarterSet.has(id))
    .map((id) => toPlayer(id, oppMatchup as SleeperMatchup, -1, args.players))

  return {
    myTeam: teamFromRoster(myRoster, args.users),
    oppTeam: oppRoster ? teamFromRoster(oppRoster, args.users) : null,
    myPoints: teamTotal(myMatchup),
    oppPoints: oppMatchup ? teamTotal(oppMatchup) : 0,
    starters,
    bench,
    oppStarters: oppMatchup ? oppStarters : [],
    oppBench: oppMatchup ? oppBench : [],
    scoresFinal: myMatchup.custom_points != null || oppMatchup?.custom_points != null,
    ...sleeperOfficialWin(myMatchup.win_probability, oppMatchup?.win_probability)
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
        id: String(row.transaction_id),
        type: mapTransactionKind(row.type, addIds.length, dropIds.length),
        players: ids.map((id) => lookupPlayer(players, id).name),
        timestamp: asInt(row.status_updated) || asInt(row.created) || 0
      }
    })
}

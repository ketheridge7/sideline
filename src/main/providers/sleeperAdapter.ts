import { matchupHasLineup, overlayStartersBelong } from '@shared/display'
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
  seasonType: raw.season_type,
  ...(raw.leg != null ? { leg: raw.leg } : {})
})

/**
 * Matchup / transaction / projection week.
 * Regular season uses `display_week` (it matches `leg` on the public state).
 * In the postseason, Sleeper can leave `leg` on the fantasy week (14–18) while
 * `display_week` jumps to the NFL week (19+). League matchups are stored under `leg`.
 * A `leg` of 1 during `post` is a playoff round, not a matchup week, so it is ignored.
 */
export const sleeperMatchupWeek = (
  nfl: { displayWeek: number; seasonType: string; leg?: number }
): number => {
  const leg = nfl.leg
  if (nfl.seasonType === 'post' && leg != null && leg >= 14 && leg <= 18 && nfl.displayWeek > leg) {
    return leg
  }
  return nfl.displayWeek
}

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

/** Only a real dump hit. A miss must keep the name already on the row, never paint the raw id. */
const cachedPlayer = (players: Record<string, CachedPlayer>, playerId: string): CachedPlayer | undefined => {
  const direct = players[playerId]
  if (direct) return direct
  const coerced = Number(playerId)
  if (!Number.isFinite(coerced)) return undefined
  return players[String(coerced)] ?? players[coerced as unknown as string]
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
  // Zero in one source means "not posted yet". A negative DST or fumble in the other source is real.
  if (fromMap != null && fromMap !== 0) return fromMap
  if (fromStarters != null && fromStarters !== 0) return fromStarters
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

/** Sleeper writes "0" into an empty starter slot. That id is not a player. */
const isScoringStarterId = (id: string | undefined): id is string =>
  id != null && id !== '' && id !== '0'

const idInSet = (set: ReadonlySet<string>, id: string): boolean => {
  if (set.has(id)) return true
  const coerced = Number(id)
  return Number.isFinite(coerced) && set.has(String(coerced))
}

const NO_INACTIVE: ReadonlySet<string> = new Set()

/** Float slack for "this total is exactly the bench pile". Distinct tenths stay distinct. */
const POINTS_EPS = 0.02

type StarterSlot = { id: string; index: number }

const starterSlots = (matchup: SleeperMatchup): StarterSlot[] => {
  const ids = matchup.starters ?? []
  const slots: StarterSlot[] = []
  for (let index = 0; index < ids.length; index++) {
    const id = playerIdOf(ids[index])
    if (!id) continue
    slots.push({ id, index })
  }
  return slots
}

const isScoringSlot = (slot: StarterSlot, inactive: ReadonlySet<string>): boolean =>
  isScoringStarterId(slot.id) && !idInSet(inactive, slot.id)

/** IR and taxi never score, even if a stale starters list still names them. */
const inactiveIds = (roster: SleeperRoster | undefined): ReadonlySet<string> => {
  if (!roster) return NO_INACTIVE
  const ids = new Set<string>()
  for (const raw of [...(roster.reserve ?? []), ...(roster.taxi ?? [])]) {
    const id = playerIdOf(raw)
    if (!isScoringStarterId(id)) continue
    ids.add(id)
  }
  return ids.size > 0 ? ids : NO_INACTIVE
}

export const sleeperInactiveByRoster = (
  rosters: SleeperRoster[] | undefined
): ReadonlyMap<number, ReadonlySet<string>> => {
  const map = new Map<number, ReadonlySet<string>>()
  if (!rosters) return map
  for (const roster of rosters) {
    const rosterId = rosterIdOf(roster)
    if (rosterId == null) continue
    const inactive = inactiveIds(roster)
    if (inactive !== NO_INACTIVE) map.set(rosterId, inactive)
  }
  return map
}

const starterPointsSum = (matchup: SleeperMatchup, inactive: ReadonlySet<string>): number => {
  let sum = 0
  for (const slot of starterSlots(matchup)) {
    if (!isScoringSlot(slot, inactive)) continue
    const pts = pointsForPlayer(matchup, slot.id, slot.index)
    if (typeof pts === 'number') sum += pts
  }
  return sum
}

/**
 * Positive points for anyone who is not a scoring starter: bench, and IR/taxi
 * still sitting in the starters array. Key "0" is skipped so an empty slot
 * cannot explain a real team total.
 */
const nonStarterPointsSum = (matchup: SleeperMatchup, inactive: ReadonlySet<string>): number => {
  // A compact row that omits `starters` cannot be split. Its player map may be
  // the starter chips themselves; do not treat that map as bench.
  if (!Array.isArray(matchup.starters)) return 0
  const scoring = new Set<string>()
  for (const slot of starterSlots(matchup)) {
    if (!isScoringSlot(slot, inactive)) continue
    scoring.add(slot.id)
  }
  let sum = 0
  const seen = new Set<string>()
  const add = (id: string, pts: number | undefined): void => {
    if (!isScoringStarterId(id) || idInSet(scoring, id) || idInSet(seen, id)) return
    if (pts == null || pts <= 0) return
    seen.add(id)
    sum += pts
  }
  if (matchup.players_points) {
    for (const [key, value] of Object.entries(matchup.players_points)) {
      const id = playerIdOf(key)
      if (!id) continue
      add(id, asPts(value))
    }
  }
  for (const slot of starterSlots(matchup)) {
    if (!isScoringStarterId(slot.id) || !idInSet(inactive, slot.id)) continue
    add(slot.id, pointsForPlayer(matchup, slot.id, slot.index))
  }
  return sum
}

/** Points parked on empty starter slots. They are not a player and never score. */
const emptySlotPoints = (matchup: SleeperMatchup): number => {
  if (!Array.isArray(matchup.starters)) return 0
  let sum = 0
  for (const slot of starterSlots(matchup)) {
    if (slot.id !== '0') continue
    const pts = pointsForPlayer(matchup, slot.id, slot.index)
    if (pts != null && pts > 0) sum += pts
  }
  return sum
}

const teamTotal = (matchup: SleeperMatchup, inactive: ReadonlySet<string> = NO_INACTIVE): number => {
  const custom = asPts(matchup.custom_points)
  if (custom != null) return custom
  const pts = asPts(matchup.points)
  const starterSum = starterPointsSum(matchup, inactive)
  const benchSum = nonStarterPointsSum(matchup, inactive)
  // An empty-slot phantom only explains the total when no real bench/IR points do.
  // Adding the two together would hide a real starter total that is still ahead of
  // zeroed starter chips but smaller than bench + phantom.
  const explained = benchSum > 0 ? benchSum : emptySlotPoints(matchup)
  // TNF: every scoring starter is still 0, and the published total is the bench /
  // IR / empty-slot pile (or Sleeper's own 0). A negative total is a real score
  // (DST, fumbles), not that pile.
  if (starterSum === 0 && explained > 0 && (pts == null || (pts >= 0 && pts <= explained + POINTS_EPS))) {
    return 0
  }
  // `points` matches starters + bench, so it is the whole roster rather than the
  // official starter total. Count starters only.
  if (
    pts != null &&
    benchSum > POINTS_EPS &&
    Math.abs(pts - (starterSum + benchSum)) <= POINTS_EPS
  ) {
    return starterSum
  }
  if (pts != null && pts !== 0) return pts
  return starterSum
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
    const meta = cachedPlayer(players, player.playerId)
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

const overlayTotal = (prevPts: number, row: SleeperMatchup, inactive: ReadonlySet<string>): number => {
  const live = teamTotal(row, inactive)
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

const sleeperPlayerId = (value: unknown): string | undefined => {
  const id = playerIdOf(value)
  if (!id || id === '0') return undefined
  return id
}

const playersById = (players: Player[]): Map<string, Player> => {
  const map = new Map<string, Player>()
  for (const player of players) {
    if (!player.playerId) continue
    map.set(player.playerId, player)
    const coerced = Number(player.playerId)
    if (Number.isFinite(coerced)) map.set(String(coerced), player)
  }
  return map
}

/** Rebuild starter/bench from this `/matchups` row when it carries a starters list. Omitted starters keep the previous partition. */
const reseatSleeperSide = (
  prevStarters: Player[],
  prevBench: Player[],
  row: SleeperMatchup,
  inactive: ReadonlySet<string>
): { starters: Player[]; bench: Player[] } | null => {
  if (!Array.isArray(row.starters)) return null
  const starterIds = row.starters
    .map(sleeperPlayerId)
    .filter((id): id is string => id != null && !idInSet(inactive, id))
  if (starterIds.length === 0) return null
  const known = playersById([...prevStarters, ...prevBench])
  const lookup = (id: string): Player =>
    known.get(id) ?? { playerId: id, name: id, position: '?', nflTeam: '' }
  const isStarter = (id: string): boolean => idInSet(new Set(starterIds), id)
  const fromPlayers = Array.isArray(row.players)
    ? row.players.map(sleeperPlayerId).filter((id): id is string => id != null)
    : [...prevStarters, ...prevBench].map((player) => player.playerId).filter((id) => id !== '')
  const parked = row.starters.map(sleeperPlayerId).filter((id): id is string => id != null && idInSet(inactive, id))
  const benchIds: string[] = []
  const seen = new Set<string>()
  for (const id of [...fromPlayers, ...parked]) {
    if (isStarter(id) || idInSet(seen, id)) continue
    seen.add(id)
    benchIds.push(id)
  }
  return {
    starters: starterIds.map(lookup),
    bench: benchIds.map(lookup)
  }
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
 * actual points; everyone else max(actual, weekly projection). A starter still
 * at 0 keeps a negative projection. Undefined (pending) when a starter still
 * to play has no projection.
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

export const sleeperRosterIdForUser = (
  rosters: readonly SleeperRoster[] | undefined,
  userId: string | undefined
): number | undefined => {
  if (!rosters || !userId) return undefined
  const mine = rosters.find((roster) => isMyRoster(roster, userId))
  if (!mine) return undefined
  return rosterIdOf(mine)
}

/**
 * A rebuild from a not-yet-posted row has no named starters. Keep the last
 * lineup when it is still the same roster and opponent, so Tuesday does not
 * flash blank. A different opponent is a new pairing and stays as rebuilt.
 * A zero total that is not final is the unposted stub, not a real score.
 */
export const keepSameMatchupLineup = (prev: Matchup | null, next: Matchup | null): Matchup | null => {
  if (!next || !prev) return next
  if (matchupHasLineup(next) || !matchupHasLineup(prev)) return next
  if (prev.myTeam.id !== next.myTeam.id) return next
  if ((prev.oppTeam?.id ?? null) !== (next.oppTeam?.id ?? null)) return next
  const myPoints = next.scoresFinal || next.myPoints !== 0 ? next.myPoints : prev.myPoints
  const oppPoints = next.scoresFinal || next.oppPoints !== 0 ? next.oppPoints : prev.oppPoints
  return {
    ...next,
    myPoints,
    oppPoints,
    starters: prev.starters,
    bench: prev.bench,
    oppStarters: prev.oppStarters,
    oppBench: prev.oppBench
  }
}

export const overlaySleeperMatchups = (
  prev: Matchup,
  matchups: SleeperMatchup[],
  inactiveByRoster?: ReadonlyMap<number, ReadonlySet<string>>,
  myRosterId?: number
): Matchup | null => {
  const myId = asInt(prev.myTeam.id)
  if (myId == null) return null
  // The roster cache says this user moved. Overlapping starter ids must not keep the old team.
  if (myRosterId != null && myRosterId !== myId) return null
  const mine = matchups.find((row) => rosterIdOf(row) === myId)
  if (!mine) return null
  // A compact row that omits matchup_id cannot prove who is paired this week.
  // Trusting prev.oppTeam.roster_id paints last week's opponent with this week's points.
  if (mine.matchup_id === undefined) return null
  // Omitted starters stay an empty iteration so a not-yet-posted row can keep names.
  // A present array is passed through, including "0" / "" slots, so those cannot.
  const starterSlots = mine.starters
  const liveIds = Array.isArray(starterSlots) ? starterSlots.map((slot) => playerIdOf(slot) ?? '') : []
  if (!overlayStartersBelong(prev.starters, liveIds, { listed: Array.isArray(starterSlots) })) return null
  const liveRosterId = rosterIdOf(mine)
  const myMatchupId = matchupIdOf(mine)
  const opp =
    liveRosterId == null || myMatchupId == null
      ? undefined
      : matchups.find((row) => matchupIdOf(row) === myMatchupId && rosterIdOf(row) !== liveRosterId)
  const prevOpp = prev.oppTeam ? asInt(prev.oppTeam.id) ?? null : null
  const nextOpp = opp ? rosterIdOf(opp) ?? null : null
  if (prevOpp !== nextOpp) return null
  const inactiveFor = (row: SleeperMatchup | undefined): ReadonlySet<string> => {
    if (!row || !inactiveByRoster) return NO_INACTIVE
    const rosterId = rosterIdOf(row)
    if (rosterId == null) return NO_INACTIVE
    return inactiveByRoster.get(rosterId) ?? NO_INACTIVE
  }
  const mineInactive = inactiveFor(mine)
  const oppInactive = inactiveFor(opp)
  const mineSeat = reseatSleeperSide(prev.starters, prev.bench, mine, mineInactive)
  const oppSeat = opp ? reseatSleeperSide(prev.oppStarters, prev.oppBench, opp, oppInactive) : null
  const next: Matchup = {
    ...prev,
    myPoints: overlayTotal(prev.myPoints, mine, mineInactive),
    oppPoints: opp ? overlayTotal(prev.oppPoints, opp, oppInactive) : prev.oppPoints,
    starters: overlayPlayers(mineSeat?.starters ?? prev.starters, mine),
    bench: overlayPlayers(mineSeat?.bench ?? prev.bench, mine),
    oppStarters: opp ? overlayPlayers(oppSeat?.starters ?? prev.oppStarters, opp) : prev.oppStarters,
    oppBench: opp ? overlayPlayers(oppSeat?.bench ?? prev.oppBench, opp) : prev.oppBench,
    scoresFinal: mine.custom_points != null || opp?.custom_points != null
  }
  const win = sleeperOfficialWin(mine.win_probability, opp?.win_probability, prev)
  if (win.winPctSource === 'official') return { ...next, ...win }
  return withoutEstimatedWin(next)
}

const lineupFromMatchup = (
  matchup: SleeperMatchup,
  inactive: ReadonlySet<string>,
  players: Record<string, CachedPlayer>
): { starters: Player[]; bench: Player[] } => {
  const slots = starterSlots(matchup).filter((slot) => isScoringSlot(slot, inactive))
  const scoring = new Set(slots.map((slot) => slot.id))
  const bench: Player[] = []
  const seen = new Set<string>()
  const pushBench = (id: string, index: number): void => {
    if (!isScoringStarterId(id) || idInSet(scoring, id) || idInSet(seen, id)) return
    seen.add(id)
    bench.push(toPlayer(id, matchup, index, players))
  }
  for (const slot of starterSlots(matchup)) {
    if (isScoringSlot(slot, inactive)) continue
    pushBench(slot.id, slot.index)
  }
  for (const raw of matchup.players ?? []) {
    const id = playerIdOf(raw)
    if (!id) continue
    pushBench(id, -1)
  }
  return {
    starters: slots.map((slot) => toPlayer(slot.id, matchup, slot.index, players)),
    bench
  }
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

  const myInactive = inactiveIds(myRoster)
  const oppInactive = inactiveIds(oppRoster)
  const myLineup = lineupFromMatchup(myMatchup, myInactive, args.players)
  const oppLineup = oppMatchup ? lineupFromMatchup(oppMatchup, oppInactive, args.players) : null

  return {
    myTeam: teamFromRoster(myRoster, args.users),
    oppTeam: oppRoster ? teamFromRoster(oppRoster, args.users) : null,
    myPoints: teamTotal(myMatchup, myInactive),
    oppPoints: oppMatchup ? teamTotal(oppMatchup, oppInactive) : 0,
    starters: myLineup.starters,
    bench: myLineup.bench,
    oppStarters: oppLineup?.starters ?? [],
    oppBench: oppLineup?.bench ?? [],
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

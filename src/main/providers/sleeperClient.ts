import { fetchJson, HttpError, type FetchPriority } from '../http'

export type CachedPlayer = {
  name: string
  position: string
  nflTeam: string
  status?: string
}

export type SleeperUser = {
  user_id: string
  username?: string
  display_name?: string
}

export type SleeperNflState = {
  week: number
  display_week: number
  season: string
  league_season: string
  season_type: string
}

export type SleeperLeague = {
  league_id: string
  name: string
  season: string
}

export type SleeperRoster = {
  roster_id: number
  owner_id: string | null
  co_owners?: string[] | null
  players?: string[] | null
  starters?: string[] | null
  settings?: {
    wins?: number
    losses?: number
    ties?: number
  }
}

export type SleeperLeagueUser = {
  user_id: string
  display_name?: string
  metadata?: {
    team_name?: string
  } | null
}

export type SleeperMatchup = {
  roster_id: number
  matchup_id: number | null
  points?: number
  custom_points?: number | null
  starters?: string[]
  players?: string[]
  players_points?: Record<string, number>
  starters_points?: number[]
}

export type SleeperTransaction = {
  transaction_id: string
  type: string
  status?: string
  status_updated?: number
  created?: number
  adds?: Record<string, number> | null
  drops?: Record<string, number> | null
}

const BASE = 'https://api.sleeper.app/v1'

export const isSleeperLeagueId = (id: string): boolean => /^\d+$/.test(id)

const WRAP_KEYS = [
  'matchups',
  'matchup',
  'rosters',
  'roster',
  'users',
  'leagues',
  'league',
  'transactions',
  'transaction',
  'data',
  'results',
  'items',
  'payload'
] as const

const asJsonObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

const asRecordRows = (value: unknown): Record<string, unknown>[] | undefined => {
  if (Array.isArray(value)) {
    const rows = value.filter((item): item is Record<string, unknown> => Boolean(asJsonObject(item)))
    if (rows.length > 0) return rows
    return value.length === 0 ? rows : undefined
  }
  const row = asJsonObject(value)
  if (!row) return undefined
  const keys = Object.keys(row)
  if (keys.length === 0) return undefined
  const indexKeys = keys.filter((key) => /^\d+$/.test(key)).map((key) => Number(key))
  if (indexKeys.length !== keys.length) return undefined
  indexKeys.sort((a, b) => a - b)
  const dense = indexKeys[0] === 0 && indexKeys[indexKeys.length - 1] === indexKeys.length - 1
  if (!dense && indexKeys[0] <= 0) return undefined
  const out = indexKeys
    .map((i) => asJsonObject(row[String(i)]))
    .filter((item): item is Record<string, unknown> => item != null)
  return out.length > 0 ? out : undefined
}

const asJsonArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[]
  const row = asJsonObject(value)
  if (!row) return []
  let empty: T[] | undefined
  for (const key of WRAP_KEYS) {
    const nested = row[key]
    if (Array.isArray(nested)) {
      if (nested.length > 0) return nested as T[]
      empty = nested as T[]
      continue
    }
    const fromMap = asRecordRows(nested)
    if (fromMap) return fromMap as T[]
    const wrapped = asJsonObject(nested)
    if (
      wrapped &&
      (wrapped.roster_id != null ||
        wrapped.league_id != null ||
        wrapped.user_id != null ||
        wrapped.transaction_id != null ||
        wrapped.matchup_id != null)
    ) {
      return [wrapped] as T[]
    }
  }
  const fromMap = asRecordRows(row)
  if (fromMap) return fromMap as T[]
  if (
    row.roster_id != null ||
    row.league_id != null ||
    row.user_id != null ||
    row.transaction_id != null ||
    row.matchup_id != null
  ) {
    return [row] as T[]
  }
  return empty ?? []
}

const OBJECT_WRAP_KEYS = [
  ...WRAP_KEYS,
  'user',
  'state',
  'nfl',
  'matchup',
  'roster',
  'league',
  'transaction'
] as const

const unwrapSleeperObject = (
  raw: unknown,
  hasIdentity: (row: Record<string, unknown>) => boolean
): Record<string, unknown> | null => {
  const row = asJsonObject(raw)
  if (!row) return null
  if (hasIdentity(row)) return row
  for (const key of OBJECT_WRAP_KEYS) {
    const nested = asJsonObject(row[key])
    if (nested && hasIdentity(nested)) return nested
  }
  return row
}

export type SleeperGetOpts = {
  timeoutMs?: number
  retries?: number
  cacheBust?: string
  priority?: FetchPriority
}

export class SleeperHttpError extends Error {
  status: number

  constructor(status: number, path: string) {
    super(`Sleeper ${path} failed (${status})`)
    this.status = status
    this.name = 'SleeperHttpError'
  }
}

const withCacheBust = (path: string, cacheBust?: string): string => {
  if (!cacheBust) return path
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}_=${encodeURIComponent(cacheBust)}`
}

/** Cloudflare s-maxage on these paths; keep in sync with poller TTLs. */
const CDN_MATCHUPS_MS = 3_000
const CDN_TX_MS = 30_000
const CDN_STATE_MS = 60_000
const CDN_USER_MS = 120_000
const CDN_LIST_MS = 300_000

const cdnBust = (intervalMs: number, explicit?: string): string =>
  explicit ?? String(Math.floor(Date.now() / intervalMs))

const withCdnBust = (opts: SleeperGetOpts, intervalMs: number): SleeperGetOpts => ({
  ...opts,
  cacheBust: cdnBust(intervalMs, opts.cacheBust)
})

const getJson = async <T>(path: string, opts: SleeperGetOpts = {}): Promise<T> => {
  try {
    return await fetchJson<T>({
      url: `${BASE}${withCacheBust(path, opts.cacheBust)}`,
      headers: { Accept: 'application/json' },
      timeoutMs: opts.timeoutMs ?? 5_000,
      retries: opts.retries ?? 0,
      priority: opts.priority
    })
  } catch (error) {
    if (error instanceof HttpError) {
      throw new SleeperHttpError(error.status, path)
    }
    throw error
  }
}

const getJsonArray = async <T>(path: string, opts: SleeperGetOpts = {}): Promise<T[]> => {
  try {
    return asJsonArray<T>(await getJson<unknown>(path, opts))
  } catch (error) {
    if (error instanceof SleeperHttpError && error.status === 200) return []
    throw error
  }
}

const asInt = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isInteger(parsed)) return parsed
  }
  return undefined
}

const asStr = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim() !== '') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

const asFinite = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

const chipPlayerId = (row: Record<string, unknown>): string | undefined =>
  asStr(row.player_id) ?? asStr(row.playerId) ?? asStr(row.id)

const asPlayerId = (value: unknown): string | undefined => {
  const direct = asStr(value)
  if (direct) return direct
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return chipPlayerId(value as Record<string, unknown>)
}

const asIdList = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) {
    const out = value.map(asPlayerId).filter((id): id is string => Boolean(id))
    if (out.length > 0) return out
    return value.length === 0 ? out : undefined
  }
  if (!value || typeof value !== 'object') return undefined
  const row = value as Record<string, unknown>
  const keys = Object.keys(row)
  if (keys.length === 0) return undefined
  const indexKeys = keys.filter((key) => /^\d+$/.test(key)).map((key) => Number(key))
  if (indexKeys.length !== keys.length) return undefined
  indexKeys.sort((a, b) => a - b)
  if (indexKeys[0] === 0 && indexKeys[indexKeys.length - 1] === indexKeys.length - 1) {
    const out = indexKeys
      .map((i) => asPlayerId(row[String(i)]))
      .filter((id): id is string => Boolean(id))
    return out.length > 0 ? out : undefined
  }
  if (indexKeys[0] > 0) return indexKeys.map((id) => String(id))
  return undefined
}

const asChipPts = (value: unknown): number | undefined => {
  const direct = asFinite(value)
  if (direct != null) return direct
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const row = value as Record<string, unknown>
  return (
    asFinite(row.points) ??
    asFinite(row.pts) ??
    asFinite(row.score) ??
    asFinite(row.liveScore) ??
    asFinite(row.pointsLive) ??
    asFinite(row.live) ??
    asFinite(row.fpts) ??
    asFinite(row.fp)
  )
}

const asNamedChipMap = (value: unknown[]): Record<string, number> | undefined => {
  if (value.length === 0) return undefined
  const out: Record<string, number> = {}
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return undefined
    const row = item as Record<string, unknown>
    const id = chipPlayerId(row)
    const pts = asChipPts(row)
    if (!id || pts == null) return undefined
    out[id] = pts
  }
  return out
}

const asPtsMap = (value: unknown, ids?: string[]): Record<string, number> | undefined => {
  if (Array.isArray(value)) {
    const named = asNamedChipMap(value)
    if (named) return named
    if (!ids || ids.length === 0) return undefined
    const out: Record<string, number> = {}
    const n = Math.min(value.length, ids.length)
    for (let i = 0; i < n; i++) {
      const id = ids[i]
      const pts = asChipPts(value[i])
      if (id && pts != null) out[id] = pts
    }
    return Object.keys(out).length > 0 ? out : undefined
  }
  if (!value || typeof value !== 'object') return undefined
  const out: Record<string, number> = {}
  for (const [key, pts] of Object.entries(value as Record<string, unknown>)) {
    const id = asStr(key)
    const n = asChipPts(pts)
    if (id && n != null) out[id] = n
  }
  return Object.keys(out).length > 0 ? out : undefined
}

const ptsMapIds = (
  value: unknown,
  players?: string[],
  starters?: string[]
): string[] | undefined => {
  if (!Array.isArray(value)) return players ?? starters
  if (players && value.length === players.length) return players
  if (starters && value.length === starters.length) return starters
  return players ?? starters
}

const asPtsList = (value: unknown, ids?: string[]): number[] | undefined => {
  if (Array.isArray(value)) {
    const named = asNamedChipMap(value)
    if (named) {
      if (!ids || ids.length === 0) return undefined
      const out = ids.map((id) => named[id] ?? Number.NaN)
      return out.some((pts) => Number.isFinite(pts)) ? out : undefined
    }
    return value.map((pts) => asChipPts(pts) ?? Number.NaN)
  }
  if (!value || typeof value !== 'object') return undefined
  const row = value as Record<string, unknown>
  const keys = Object.keys(row)
  if (keys.length === 0) return undefined
  const indexKeys = keys.filter((key) => /^\d+$/.test(key)).map((key) => Number(key))
  if (indexKeys.length === keys.length) {
    indexKeys.sort((a, b) => a - b)
    if (indexKeys[0] === 0 && indexKeys[indexKeys.length - 1] === indexKeys.length - 1) {
      return indexKeys.map((i) => asChipPts(row[String(i)]) ?? Number.NaN)
    }
  }
  if (!ids || ids.length === 0) return undefined
  const out = ids.map((id) => asChipPts(row[id]) ?? asChipPts(row[Number(id)]) ?? Number.NaN)
  return out.some((pts) => Number.isFinite(pts)) ? out : undefined
}

const mergePtsMaps = (
  leftover: Record<string, number> | undefined,
  preferred: Record<string, number> | undefined
): Record<string, number> | undefined => {
  if (!leftover) return preferred
  if (!preferred) return leftover
  return { ...leftover, ...preferred }
}

const asRosterMap = (value: unknown): Record<string, number> | null => {
  const rosterIdOf = (next: unknown): number | undefined => {
    const direct = asInt(next)
    if (direct != null) return direct
    const nested = asJsonObject(next)
    if (!nested) return undefined
    return asInt(nested.roster_id) ?? asInt(nested.rosterId)
  }
  if (Array.isArray(value)) {
    const out: Record<string, number> = {}
    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const row = item as Record<string, unknown>
      const id = chipPlayerId(row)
      const rid = rosterIdOf(row)
      if (id && rid != null) out[id] = rid
    }
    return Object.keys(out).length > 0 ? out : null
  }
  if (!value || typeof value !== 'object') return null
  const out: Record<string, number> = {}
  for (const [key, rosterId] of Object.entries(value as Record<string, unknown>)) {
    const nested = asJsonObject(rosterId)
    const id = (nested ? chipPlayerId(nested) : undefined) ?? asStr(key)
    const rid = rosterIdOf(rosterId)
    if (id && rid != null) out[id] = rid
  }
  return Object.keys(out).length > 0 ? out : null
}

const asRosterSettings = (value: unknown): SleeperRoster['settings'] | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const row = value as Record<string, unknown>
  return {
    wins: asInt(row.wins),
    losses: asInt(row.losses),
    ties: asInt(row.ties)
  }
}

export const parseSleeperNflState = (raw: unknown): SleeperNflState | null => {
  const row = unwrapSleeperObject(raw, (next) => asInt(next.week) != null)
  if (!row) return null
  const week = asInt(row.week)
  const displayWeek = asInt(row.display_week) ?? week
  const season = asStr(row.season)
  const leagueSeason = asStr(row.league_season) ?? season
  const seasonType = asStr(row.season_type) ?? 'regular'
  if (week == null || displayWeek == null || !season || !leagueSeason) return null
  return {
    week,
    display_week: displayWeek,
    season,
    league_season: leagueSeason,
    season_type: seasonType
  }
}

const mapParsed = <T>(rows: unknown[], parse: (raw: unknown) => T | null): T[] =>
  rows.map(parse).filter((row): row is T => row != null)

export const parseSleeperUser = (raw: unknown): SleeperUser | null => {
  const row = unwrapSleeperObject(raw, (next) => asStr(next.user_id) != null)
  if (!row) return null
  const userId = asStr(row.user_id)
  if (!userId) return null
  return {
    user_id: userId,
    username: asStr(row.username),
    display_name: asStr(row.display_name)
  }
}

export const parseSleeperLeague = (raw: unknown): SleeperLeague | null => {
  const row = unwrapSleeperObject(raw, (next) => asStr(next.league_id) != null)
  if (!row) return null
  const leagueId = asStr(row.league_id)
  if (!leagueId) return null
  return {
    league_id: leagueId,
    name: asStr(row.name) ?? leagueId,
    season: asStr(row.season) ?? ''
  }
}

export const parseSleeperRoster = (raw: unknown): SleeperRoster | null => {
  const row = unwrapSleeperObject(raw, (next) => asInt(next.roster_id) != null)
  if (!row) return null
  const rosterId = asInt(row.roster_id)
  if (rosterId == null) return null
  const coOwners = Array.isArray(row.co_owners)
    ? row.co_owners.map((owner) => asStr(owner)).filter((owner): owner is string => Boolean(owner))
    : null
  return {
    roster_id: rosterId,
    owner_id: row.owner_id == null ? null : asStr(row.owner_id) ?? null,
    co_owners: coOwners,
    players: asIdList(row.players),
    starters: asIdList(row.starters),
    settings: asRosterSettings(row.settings)
  }
}

export const parseSleeperLeagueUser = (raw: unknown): SleeperLeagueUser | null => {
  const row = unwrapSleeperObject(raw, (next) => asStr(next.user_id) != null)
  if (!row) return null
  const userId = asStr(row.user_id)
  if (!userId) return null
  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null
  return {
    user_id: userId,
    display_name: asStr(row.display_name),
    metadata: meta ? { team_name: asStr(meta.team_name) } : null
  }
}

export const parseSleeperMatchup = (raw: unknown): SleeperMatchup | null => {
  const row = unwrapSleeperObject(raw, (next) => asInt(next.roster_id) != null)
  if (!row) return null
  const rosterId = asInt(row.roster_id)
  if (rosterId == null) return null
  const starters = asIdList(row.starters)
  const players = asIdList(row.players)
  const playersPoints = row.players_points ?? row.player_points
  const startersPoints = row.starters_points ?? row.starter_points
  const starterPts = asPtsList(startersPoints, starters)
  const playerPts = asPtsMap(playersPoints, ptsMapIds(playersPoints, players, starters))
  const starterPtsAsMap =
    starterPts == null && startersPoints != null ? asPtsMap(startersPoints) : undefined
  return {
    roster_id: rosterId,
    matchup_id: row.matchup_id == null ? null : (asInt(row.matchup_id) ?? null),
    points:
      asChipPts(row.points) ??
      asChipPts(row.pts) ??
      asChipPts(row.live_points) ??
      asChipPts(row.liveScore) ??
      asChipPts(row.pointsLive) ??
      asChipPts(row.fpts) ??
      asChipPts(row.fp),
    custom_points: row.custom_points == null ? null : asChipPts(row.custom_points),
    starters,
    players,
    players_points: mergePtsMaps(starterPtsAsMap, playerPts),
    starters_points: starterPts
  }
}

export const getNflState = async (opts: SleeperGetOpts = {}): Promise<SleeperNflState> => {
  const parsed = parseSleeperNflState(await getJson('/state/nfl', withCdnBust(opts, CDN_STATE_MS)))
  if (!parsed) throw new SleeperHttpError(200, '/state/nfl')
  return parsed
}

export const getUser = async (username: string, opts: SleeperGetOpts = {}): Promise<SleeperUser> => {
  const trimmed = username.trim()
  if (!trimmed) return Promise.reject(new SleeperHttpError(400, '/user/'))
  const parsed = parseSleeperUser(
    await getJson(`/user/${encodeURIComponent(trimmed)}`, withCdnBust(opts, CDN_USER_MS))
  )
  if (!parsed) throw new SleeperHttpError(200, `/user/${trimmed}`)
  return parsed
}

export const getUserLeagues = async (
  userId: string,
  season: string,
  opts: SleeperGetOpts = {}
): Promise<SleeperLeague[]> => {
  if (!userId || !season) return Promise.resolve([])
  return mapParsed(
    await getJsonArray(
      `/user/${encodeURIComponent(userId)}/leagues/nfl/${encodeURIComponent(season)}`,
      withCdnBust(opts, CDN_LIST_MS)
    ),
    parseSleeperLeague
  )
}

export const getLeague = async (leagueId: string, opts: SleeperGetOpts = {}): Promise<SleeperLeague> => {
  if (!isSleeperLeagueId(leagueId)) return Promise.reject(new SleeperHttpError(400, `/league/${leagueId}`))
  const parsed = parseSleeperLeague(
    await getJson(`/league/${encodeURIComponent(leagueId)}`, withCdnBust(opts, CDN_LIST_MS))
  )
  if (!parsed) throw new SleeperHttpError(200, `/league/${leagueId}`)
  return parsed
}

export const getRosters = async (leagueId: string, opts: SleeperGetOpts = {}): Promise<SleeperRoster[]> => {
  if (!isSleeperLeagueId(leagueId)) return Promise.resolve([])
  return mapParsed(
    await getJsonArray(`/league/${encodeURIComponent(leagueId)}/rosters`, withCdnBust(opts, CDN_LIST_MS)),
    parseSleeperRoster
  )
}

export const getLeagueUsers = async (
  leagueId: string,
  opts: SleeperGetOpts = {}
): Promise<SleeperLeagueUser[]> => {
  if (!isSleeperLeagueId(leagueId)) return Promise.resolve([])
  return mapParsed(
    await getJsonArray(`/league/${encodeURIComponent(leagueId)}/users`, withCdnBust(opts, CDN_LIST_MS)),
    parseSleeperLeagueUser
  )
}

export const isSleeperScoringWeek = (week: number): boolean =>
  Number.isInteger(week) && week >= 1 && week <= 25

export const getMatchups = async (
  leagueId: string,
  week: number,
  opts: SleeperGetOpts = {}
): Promise<SleeperMatchup[]> => {
  if (!isSleeperScoringWeek(week) || !isSleeperLeagueId(leagueId)) return Promise.resolve([])
  return mapParsed(
    await getJsonArray(
      `/league/${encodeURIComponent(leagueId)}/matchups/${week}`,
      withCdnBust(opts, CDN_MATCHUPS_MS)
    ),
    parseSleeperMatchup
  )
}

export const parseSleeperTransaction = (raw: unknown): SleeperTransaction | null => {
  const row = unwrapSleeperObject(raw, (next) => asStr(next.transaction_id) != null)
  if (!row) return null
  const id = asStr(row.transaction_id)
  const type = asStr(row.type)
  if (!id || !type) return null
  return {
    transaction_id: id,
    type,
    status: asStr(row.status),
    status_updated: asInt(row.status_updated),
    created: asInt(row.created),
    adds: asRosterMap(row.adds),
    drops: asRosterMap(row.drops)
  }
}

export const getTransactions = async (
  leagueId: string,
  week: number,
  opts: SleeperGetOpts = {}
): Promise<SleeperTransaction[]> => {
  if (!isSleeperScoringWeek(week) || !isSleeperLeagueId(leagueId)) return Promise.resolve([])
  return mapParsed(
    await getJsonArray(
      `/league/${encodeURIComponent(leagueId)}/transactions/${week}`,
      withCdnBust(opts, CDN_TX_MS)
    ),
    parseSleeperTransaction
  )
}

export const getPlayersNfl = (): Promise<Record<string, unknown>> =>
  getJson('/players/nfl', {
    timeoutMs: 30_000,
    retries: 0,
    cacheBust: String(Math.floor(Date.now() / 86_400_000))
  })

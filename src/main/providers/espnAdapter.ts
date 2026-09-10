import { matchupHasLineup, overlayStartersBelong, visibleInjury } from '@shared/display'
import type { League, Matchup, Player, Team, Transaction } from '@shared/types'
import { mapTransactionKind } from '@shared/transactionKind'
import type { EspnCookies } from './espnClient'

export const BENCH_SLOT_IDS = new Set([20, 21])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const ESPN_WRAP_KEYS = ['data', 'payload', 'league', 'result', 'body'] as const

const unwrapEspnPayload = (
  raw: unknown,
  hasIdentity: (row: Record<string, unknown>) => boolean
): Record<string, unknown> | null => {
  if (!isRecord(raw)) return null
  if (hasIdentity(raw)) return raw
  for (const key of ESPN_WRAP_KEYS) {
    const nested = raw[key]
    if (isRecord(nested) && hasIdentity(nested)) return nested
  }
  return raw
}

const hasEspnLeagueShape = (row: Record<string, unknown>): boolean =>
  row.schedule != null ||
  row.teams != null ||
  row.liveScoring != null ||
  row.scoringPeriodId != null ||
  row.members != null ||
  isRecord(row.settings)

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

const asScheduleGames = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value.filter(isRecord)
  if (!isRecord(value)) return []
  if (isRecord(value.home) || isRecord(value.away)) return [value]
  for (const key of ['games', 'matchups', 'schedule', 'items'] as const) {
    const nested = value[key]
    if (Array.isArray(nested)) {
      const rows = nested.filter(isRecord)
      if (rows.length > 0) return rows
    }
    if (isRecord(nested) && (isRecord(nested.home) || isRecord(nested.away))) return [nested]
  }
  return Object.values(value).filter(isRecord).filter((row) => isRecord(row.home) || isRecord(row.away))
}

const asStatRows = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value.filter(isRecord)
  if (!isRecord(value)) return []
  if (num(value.statSourceId) != null) return [value]
  return Object.values(value).filter(isRecord)
}

const statsForLive = (
  row: Record<string, unknown>,
  ppe: Record<string, unknown> | null | undefined
): Record<string, unknown>[] => {
  const player = ppe && isRecord(ppe.player) ? ppe.player : isRecord(row.player) ? row.player : null
  const fromPlayer = player ? asStatRows(player.stats) : []
  if (fromPlayer.length > 0) return fromPlayer
  const fromPpe = ppe ? asStatRows(ppe.stats) : []
  if (fromPpe.length > 0) return fromPpe
  return asStatRows(row.stats)
}

const num = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

const liveChipPts = (value: unknown): number | undefined => {
  const direct = num(value)
  if (direct != null) return direct
  if (!isRecord(value)) return undefined
  return (
    num(value.points) ??
    num(value.pts) ??
    num(value.score) ??
    num(value.liveScore) ??
    num(value.pointsLive) ??
    num(value.live) ??
    num(value.totalPointsLive) ??
    num(value.appliedActiveReal)
  )
}

const hasWeekApplied = (row: Record<string, unknown>): boolean => {
  const ppe = isRecord(row.playerPoolEntry) ? row.playerPoolEntry : null
  return (
    liveChipPts(row.appliedTotal) != null ||
    liveChipPts(row.appliedStatTotal) != null ||
    liveChipPts(row.appliedActiveReal) != null ||
    (ppe != null &&
      (liveChipPts(ppe.appliedTotal) != null ||
        liveChipPts(ppe.appliedStatTotal) != null ||
        liveChipPts(ppe.appliedActiveReal) != null))
  )
}

const stampLiveChip = (row: Record<string, unknown>): Record<string, unknown> => {
  const nestedPts = liveChipPts(row)
  if (
    nestedPts != null &&
    !hasWeekApplied(row) &&
    liveChipPts(row.totalPointsLive) == null &&
    liveChipPts(row.liveScore) == null &&
    liveChipPts(row.pointsLive) == null
  ) {
    return { ...row, liveScore: nestedPts }
  }
  return row
}

const livePtsFrom = (row: Record<string, unknown> | null | undefined): number | undefined => {
  if (!row) return undefined
  for (const field of [row.totalPointsLive, row.liveScore, row.appliedActiveReal, row.pointsLive]) {
    const pts = liveChipPts(field)
    if (pts != null && pts > 0) return pts
  }
  const liveScore = liveChipPts(row.liveScore)
  const appliedActive = liveChipPts(row.appliedActiveReal)
  const pointsLive = liveChipPts(row.pointsLive)
  if (liveScore === 0 || appliedActive === 0 || pointsLive === 0) return 0
  return liveChipPts(row.points) ?? liveChipPts(row.totalPointsLive) ?? liveScore ?? appliedActive ?? pointsLive
}

const livePtsFromRows = (
  ...rows: (Record<string, unknown> | null | undefined)[]
): number | undefined => {
  for (const row of rows) {
    const pts = livePtsFrom(row)
    if (pts != null && pts > 0) return pts
  }
  for (const row of rows) {
    const pts = livePtsFrom(row)
    if (pts != null) return pts
  }
  return undefined
}

const str = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim() !== '') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

const espnGameIsFinal = (game: Record<string, unknown> | null | undefined): boolean => {
  const winner = str(game?.winner)?.toUpperCase()
  return winner === 'HOME' || winner === 'AWAY' || winner === 'TIE'
}

const isBenchSlot = (slotId: unknown): boolean => {
  const id = num(slotId)
  return id != null && BENCH_SLOT_IDS.has(id)
}

const POSITION_BY_ID: Record<number, string> = {
  1: 'QB',
  2: 'RB',
  3: 'WR',
  4: 'TE',
  5: 'K',
  16: 'D/ST'
}

export type EspnRosterEntry = {
  lineupSlotId?: number
  playerId?: number
  playerPoolEntry?: {
    id?: number
    appliedStatTotal?: number
    player?: {
      fullName?: string
      defaultPositionId?: number
      proTeamId?: number
      injuryStatus?: string
      stats?: Array<{
        statSourceId?: number
        statSplitTypeId?: number
        scoringPeriodId?: number
        appliedTotal?: number
      }>
    }
  }
}

export const getAppliedTotal = (entry: EspnRosterEntry, scoringPeriodId?: number): number | undefined => {
  const row = entry as unknown as Record<string, unknown>
  const ppe = isRecord(entry.playerPoolEntry) ? entry.playerPoolEntry : undefined
  const live = livePtsFromRows(row, ppe)
  const stats = statsForLive(row, ppe)
  let hasWeekProjection = false
  if (stats.length > 0) {
    const actuals = stats.filter(
      (row) => num(row.statSourceId) === 0 && num(row.statSplitTypeId) === 1 && num(row.appliedTotal) != null
    )
    const forWeek = actuals.filter(
      (row) =>
        scoringPeriodId == null ||
        row.scoringPeriodId == null ||
        num(row.scoringPeriodId) === scoringPeriodId
    )
    const unscoped = forWeek.filter((row) => row.scoringPeriodId == null)
    const unscopedBest = unscoped.reduce<number | undefined>((max, row) => {
      const pts = num(row.appliedTotal)
      if (pts == null) return max
      return max == null || pts > max ? pts : max
    }, undefined)
    const pool = unscopedBest != null && unscopedBest > 0 ? unscoped : forWeek
    const best = pool.reduce<number | undefined>((max, row) => {
      const pts = num(row.appliedTotal)
      if (pts == null) return max
      return max == null || pts > max ? pts : max
    }, undefined)
    if (best != null) {
      if (live != null && live > 0) return live
      if (live === 0) return 0
      return best
    }
    hasWeekProjection = stats.some(
      (row) =>
        num(row.statSourceId) === 1 &&
        num(row.statSplitTypeId) === 1 &&
        num(row.appliedTotal) != null &&
        (scoringPeriodId == null || row.scoringPeriodId == null || num(row.scoringPeriodId) === scoringPeriodId)
    )
  }
  if (live != null && (live > 0 || !hasWeekProjection)) return live
  if (hasWeekProjection) return undefined
  return num(ppe?.appliedStatTotal) ?? num(row.appliedStatTotal)
}

const swidNorm = (value: string): string => {
  let decoded = value
  try {
    decoded = decodeURIComponent(value)
  } catch {
    decoded = value
  }
  return decoded.replace(/[{}]/g, '').toLowerCase()
}

const ownerSwid = (owner: unknown): string | undefined => {
  if (typeof owner === 'string' && owner.trim() !== '') return owner
  if (isRecord(owner)) return str(owner.id) ?? str(owner.swid) ?? str(owner.value)
  return str(owner)
}

const teamOwnsSwid = (team: Record<string, unknown>, swid: string): boolean => {
  const target = swidNorm(swid)
  const primary = str(team.primaryOwner)
  if (primary && swidNorm(primary) === target) return true
  return asArray(team.owners).some((owner) => {
    const id = ownerSwid(owner)
    return Boolean(id && swidNorm(id) === target)
  })
}

const teamName = (team: Record<string, unknown>): string => {
  const named = str(team.name)
  if (named) return named
  const location = str(team.location) ?? ''
  const nickname = str(team.nickname) ?? ''
  const combined = `${location} ${nickname}`.trim()
  if (combined) return combined
  return str(team.abbrev) || `Team ${String(team.id ?? '')}`
}

const teamRecord = (team: Record<string, unknown>): string => {
  const record = isRecord(team.record) ? team.record : null
  const overall = record && isRecord(record.overall) ? record.overall : null
  if (!overall) return '0-0'
  const wins = num(overall.wins) ?? 0
  const losses = num(overall.losses) ?? 0
  const ties = num(overall.ties) ?? 0
  if (ties > 0) return `${wins}-${losses}-${ties}`
  return `${wins}-${losses}`
}

export const ESPN_PRO_TEAM: Record<number, string> = {
  0: 'FA',
  1: 'ATL',
  2: 'BUF',
  3: 'CHI',
  4: 'CIN',
  5: 'CLE',
  6: 'DAL',
  7: 'DEN',
  8: 'DET',
  9: 'GB',
  10: 'TEN',
  11: 'IND',
  12: 'KC',
  13: 'LV',
  14: 'LAR',
  15: 'MIA',
  16: 'MIN',
  17: 'NE',
  18: 'NO',
  19: 'NYG',
  20: 'NYJ',
  21: 'PHI',
  22: 'ARI',
  23: 'PIT',
  24: 'LAC',
  25: 'SF',
  26: 'SEA',
  27: 'TB',
  28: 'WSH',
  29: 'CAR',
  30: 'JAX',
  33: 'BAL',
  34: 'HOU'
}

export const espnTeamAbbr = (proTeamId?: number): string => {
  if (proTeamId == null) return ''
  return ESPN_PRO_TEAM[proTeamId] ?? ''
}

export const espnInjuryLabel = (status?: string): string | undefined =>
  visibleInjury(status) ?? undefined

const membersOf = (payload: Record<string, unknown>): Record<string, unknown>[] => {
  const value = payload.members
  if (Array.isArray(value)) return value.filter(isRecord)
  if (!isRecord(value)) return []
  return Object.entries(value).flatMap(([key, row]) => {
    if (!isRecord(row)) return []
    const id = str(row.id) ?? str(row.swid)
    if (id) return [{ ...row, id }]
    if (key.startsWith('{') || key.includes('-')) return [{ ...row, id: key }]
    return [row]
  })
}

const ownerName = (team: Record<string, unknown>, members: Record<string, unknown>[]): string => {
  const ownerId = str(team.primaryOwner)
  if (ownerId) {
    const member = members.find((row) => {
      const id = str(row.id)
      return Boolean(id && swidNorm(id) === swidNorm(ownerId))
    })
    const name =
      (member && (str(member.displayName) || [str(member.firstName), str(member.lastName)].filter(Boolean).join(' '))) ||
      ''
    if (name.trim()) return name.trim()
  }
  return ''
}

const toTeam = (team: Record<string, unknown>, members: Record<string, unknown>[]): Team => ({
  id: String(team.id ?? ''),
  name: teamName(team),
  owner: ownerName(team, members),
  record: teamRecord(team)
})

const positiveId = (value: unknown): number | undefined => {
  const id = num(value)
  return id != null && id > 0 ? id : undefined
}

const nestedTeamId = (row: Record<string, unknown>): number | undefined => {
  const team = isRecord(row.team) ? row.team : null
  if (!team) return undefined
  return positiveId(team.teamId) ?? positiveId(team.id)
}

const teamIdOfRow = (row: Record<string, unknown>, keyId?: number): number | undefined =>
  positiveId(row.teamId) ?? positiveId(row.id) ?? nestedTeamId(row) ?? keyId

const scheduleSideId = (side: Record<string, unknown> | null | undefined): number | undefined =>
  side ? teamIdOfRow(side) : undefined

const withTeamId = (row: Record<string, unknown>, keyId?: number): Record<string, unknown> => {
  const teamId = teamIdOfRow(row, keyId)
  return teamId != null ? { ...row, teamId, id: positiveId(row.id) ?? teamId } : row
}

const hasPlayerChips = (row: Record<string, unknown>): boolean =>
  Array.isArray(row.players) || isRecord(row.players)

const hasRosterPeriod = (row: Record<string, unknown>): boolean =>
  isRecord(row.rosterForCurrentScoringPeriod) ||
  isRecord(row.rosterForMatchupPeriod) ||
  isRecord(row.roster) ||
  hasPlayerChips(row)

const stampCompactTeamPts = (row: Record<string, unknown>, keyId?: number): Record<string, unknown> => {
  const tagged = withTeamId(row, keyId)
  const nestedPts = liveChipPts(row)
  if (
    nestedPts != null &&
    !hasRosterPeriod(row) &&
    liveChipPts(tagged.totalPointsLive) == null &&
    liveChipPts(tagged.liveScore) == null &&
    liveChipPts(tagged.pointsLive) == null
  ) {
    return { ...tagged, liveScore: nestedPts }
  }
  return tagged
}

const asLiveTeamRows = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value.filter(isRecord).map((row) => stampCompactTeamPts(row))
  if (!isRecord(value)) return []
  return Object.entries(value).flatMap(([key, row]) => {
    const fromKey = Number.parseInt(key, 10)
    const keyId = Number.isFinite(fromKey) && fromKey > 0 ? fromKey : undefined
    if (isRecord(row)) {
      const teamId = teamIdOfRow(row, keyId)
      if (teamId != null) return [stampCompactTeamPts(row, keyId)]
      const nestedPts = liveChipPts(row)
      if (nestedPts != null && keyId != null) return [{ teamId: keyId, id: keyId, liveScore: nestedPts }]
      return []
    }
    const pts = liveChipPts(row)
    if (pts == null || keyId == null) return []
    return [{ teamId: keyId, id: keyId, liveScore: pts }]
  })
}

const asTeamRows = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.filter(isRecord).map((row) => {
      const teamId = teamIdOfRow(row)
      return teamId != null ? { ...row, id: positiveId(row.id) ?? teamId } : row
    })
  }
  if (!isRecord(value)) return []
  return Object.entries(value).flatMap(([key, row]) => {
    if (!isRecord(row)) return []
    const fromKey = Number.parseInt(key, 10)
    const keyId = Number.isFinite(fromKey) && fromKey > 0 ? fromKey : undefined
    const teamId = teamIdOfRow(row, keyId)
    if (teamId == null) return []
    return [{ ...row, id: positiveId(row.id) ?? teamId }]
  })
}

const liveScoringTeamRows = (live: unknown): Record<string, unknown>[] => {
  if (Array.isArray(live)) return asLiveTeamRows(live)
  if (!isRecord(live)) return []
  const nested = asLiveTeamRows(live.teams)
  if (nested.length > 0) return nested
  return asLiveTeamRows(live)
}

const compactTeamPts = (row: Record<string, unknown> | null | undefined): number | undefined => {
  if (!row || hasRosterPeriod(row)) return undefined
  return (
    liveChipPts(row.appliedActiveReal) ??
    liveChipPts(row.appliedTotal) ??
    liveChipPts(row.appliedStatTotal) ??
    liveChipPts(row.points) ??
    liveChipPts(row.pts)
  )
}

const liveTeamPts = (row: Record<string, unknown> | null | undefined): number | undefined => {
  if (!row) return undefined
  for (const field of [row.totalPointsLive, row.liveScore, row.pointsLive]) {
    const pts = liveChipPts(field)
    if (pts != null && pts > 0) return pts
  }
  const liveScore = liveChipPts(row.liveScore)
  const appliedActive = liveChipPts(row.appliedActiveReal)
  const pointsLive = liveChipPts(row.pointsLive)
  if (liveScore === 0 || appliedActive === 0 || pointsLive === 0) return 0
  return compactTeamPts(row)
}

const looksLikeLiveTeamRow = (row: Record<string, unknown>): boolean =>
  liveTeamPts(row) != null || asPlayerRows(row.players).length > 0

const liveScoringFromPayload = (payload: Record<string, unknown>): Record<string, unknown>[] => {
  if (Object.prototype.hasOwnProperty.call(payload, 'liveScoring')) {
    return liveScoringTeamRows(payload.liveScoring)
  }
  const unwrapped = liveScoringTeamRows(payload)
  return unwrapped.some(looksLikeLiveTeamRow) ? unwrapped : []
}

const liveScoringTeams = (payload: Record<string, unknown>): Record<string, unknown>[] =>
  liveScoringFromPayload(payload)

const liveTeamFor = (
  liveTeams: Record<string, unknown>[],
  teamId: number | undefined
): Record<string, unknown> | null => {
  if (teamId == null) return null
  return (
    liveTeams.find((row) => num(row.teamId) === teamId || num(row.id) === teamId) ?? null
  )
}

const nestedPlayerId = (row: Record<string, unknown>): number | undefined => {
  const ppe = isRecord(row.playerPoolEntry) ? row.playerPoolEntry : null
  const player = isRecord(row.player)
    ? row.player
    : ppe && isRecord(ppe.player)
      ? ppe.player
      : null
  return (ppe ? num(ppe.id) : undefined) ?? (player ? num(player.id) : undefined)
}

const playerIdOfRow = (row: Record<string, unknown>, keyId?: number): number | undefined =>
  num(row.playerId) ?? num(row.player_id) ?? num(row.playerID) ?? num(row.id) ?? nestedPlayerId(row) ?? keyId

const withPlayerId = (row: Record<string, unknown>, keyId?: number): Record<string, unknown> => {
  const playerId = playerIdOfRow(row, keyId)
  return playerId != null ? { ...row, playerId, id: num(row.id) ?? playerId } : row
}

const asEntryRows = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value.filter(isRecord).map((row) => withPlayerId(row)).map(stampLiveChip)
  if (!isRecord(value)) return []
  return Object.entries(value).flatMap(([key, row]) => {
    const fromKey = Number.parseInt(key, 10)
    const keyId = Number.isFinite(fromKey) && fromKey > 0 ? fromKey : undefined
    if (isRecord(row)) {
      const playerId = playerIdOfRow(row, keyId)
      if (playerId != null) return [stampLiveChip(withPlayerId(row, keyId))]
      const nestedPts = liveChipPts(row)
      if (nestedPts != null && keyId != null) return [{ playerId: keyId, id: keyId, liveScore: nestedPts }]
      return []
    }
    const pts = liveChipPts(row)
    if (pts == null || keyId == null) return []
    return [{ playerId: keyId, id: keyId, liveScore: pts }]
  })
}

const stampCompactPlayerPts = (row: Record<string, unknown>, keyId?: number): Record<string, unknown> =>
  stampLiveChip(withPlayerId(row, keyId))

const asPlayerRows = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value.filter(isRecord).map((row) => stampCompactPlayerPts(row))
  if (!isRecord(value)) return []
  return Object.entries(value).flatMap(([key, row]) => {
    const fromKey = Number.parseInt(key, 10)
    const keyId = Number.isFinite(fromKey) ? fromKey : undefined
    if (isRecord(row)) {
      const playerId = playerIdOfRow(row, keyId)
      if (playerId != null) return [stampCompactPlayerPts(row, keyId)]
      const nestedPts = liveChipPts(row)
      if (nestedPts != null && keyId != null && keyId > 0) {
        return [{ playerId: keyId, id: keyId, liveScore: nestedPts }]
      }
      return []
    }
    const pts = liveChipPts(row)
    if (pts == null || keyId == null) return []
    return [{ playerId: keyId, id: keyId, liveScore: pts }]
  })
}

const compactLivePoints = (row: Record<string, unknown>): number | undefined => {
  const ppe = isRecord(row.playerPoolEntry) ? row.playerPoolEntry : null
  const stats = statsForLive(row, ppe)
  const hasWeekProjection = stats.some(
    (stat) =>
      isRecord(stat) && num(stat.statSourceId) === 1 && num(stat.statSplitTypeId) === 1 && num(stat.appliedTotal) != null
  )
  const direct = livePtsFromRows(row, ppe)
  if (direct != null && (direct > 0 || !hasWeekProjection)) return direct
  const hasStats = stats.some((stat) => isRecord(stat) && num(stat.statSourceId) != null)
  if (hasStats) return undefined
  return (
    num(row.appliedStatTotal) ??
    num(row.appliedTotal) ??
    num(row.appliedActiveReal) ??
    (ppe ? num(ppe.appliedStatTotal) ?? num(ppe.appliedTotal) ?? num(ppe.appliedActiveReal) : undefined)
  )
}

const withWeekActual = (entry: Record<string, unknown>): Record<string, unknown> => {
  const compactPts = compactLivePoints(entry)
  const ppe = isRecord(entry.playerPoolEntry) ? entry.playerPoolEntry : {}
  const player = isRecord(ppe.player) ? ppe.player : isRecord(entry.player) ? entry.player : {}
  const fromPlayer = asStatRows(player.stats)
  const stats = fromPlayer.length > 0 ? fromPlayer : asStatRows(entry.stats)
  const playerId = num(entry.playerId) ?? num(entry.id) ?? num(ppe.id)
  const hasActual = stats.some(
    (stat) => num(stat.statSourceId) === 0 && num(stat.statSplitTypeId) === 1 && num(stat.appliedTotal) != null
  )
  const nextStats =
    compactPts == null || hasActual
      ? stats
      : [...stats, { statSourceId: 0, statSplitTypeId: 1, appliedTotal: compactPts }]
  const nextPlayer = nextStats.length > 0 ? { ...player, stats: nextStats } : player
  return {
    ...entry,
    lineupSlotId: num(entry.lineupSlotId),
    playerId,
    playerPoolEntry: {
      ...ppe,
      id: num(ppe.id) ?? playerId,
      ...(compactPts != null && compactPts > 0 ? { appliedStatTotal: compactPts } : {}),
      player: nextPlayer
    }
  }
}

const periodEntries = (period: unknown): Record<string, unknown>[] =>
  isRecord(period) ? asEntryRows(period.entries).map(withWeekActual) : []

const rosterPeriod = (row: Record<string, unknown> | null): Record<string, unknown> | null => {
  if (!row) return null
  const currentEntries = periodEntries(row.rosterForCurrentScoringPeriod)
  if (currentEntries.length > 0) {
    return { ...(row.rosterForCurrentScoringPeriod as Record<string, unknown>), entries: currentEntries }
  }
  const matchupEntries = periodEntries(row.rosterForMatchupPeriod)
  if (matchupEntries.length > 0) {
    return { ...(row.rosterForMatchupPeriod as Record<string, unknown>), entries: matchupEntries }
  }
  const players = asPlayerRows(row.players).map(withWeekActual)
  if (players.length > 0) return { entries: players }
  if (isRecord(row.rosterForCurrentScoringPeriod)) return row.rosterForCurrentScoringPeriod
  if (isRecord(row.rosterForMatchupPeriod)) return row.rosterForMatchupPeriod
  return null
}

const statKey = (row: Record<string, unknown>): string | null => {
  const src = num(row.statSourceId)
  const split = num(row.statSplitTypeId)
  if (src == null || split == null) return null
  return `${src}:${split}:${num(row.scoringPeriodId) ?? ''}`
}

const mergeStats = (sideStats: unknown[], liveStats: unknown[]): unknown[] => {
  if (liveStats.length === 0) return sideStats
  if (sideStats.length === 0) return liveStats
  const byKey = new Map<string, Record<string, unknown>>()
  for (const row of [...sideStats, ...liveStats]) {
    if (!isRecord(row)) continue
    const key = statKey(row)
    if (!key) continue
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, row)
      continue
    }
    const liveApplied = num(row.appliedTotal)
    const prevApplied = num(prev.appliedTotal)
    const applied = liveApplied != null ? liveApplied : prevApplied
    byKey.set(key, { ...prev, ...row, ...(applied != null ? { appliedTotal: applied } : {}) })
  }
  if (byKey.size === 0) return liveStats
  return [...byKey.values()]
}

const mergeRosterEntry = (side: Record<string, unknown>, live: Record<string, unknown>): Record<string, unknown> => {
  const sideP = isRecord(side.playerPoolEntry) ? side.playerPoolEntry : {}
  const liveP = isRecord(live.playerPoolEntry) ? live.playerPoolEntry : {}
  const liveApplied = num(liveP.appliedStatTotal)
  const sideApplied = num(sideP.appliedStatTotal)
  const appliedStatTotal = liveApplied != null ? liveApplied : sideApplied
  const sidePlayer = isRecord(sideP.player) ? sideP.player : {}
  const livePlayer = isRecord(liveP.player) ? liveP.player : {}
  const liveStats = asStatRows(livePlayer.stats)
  const sideStats = asStatRows(sidePlayer.stats)
  const livePts = livePtsFromRows(live, liveP)
  const liveFields =
    livePts != null && livePts > 0
      ? { totalPointsLive: livePts, liveScore: livePts, appliedActiveReal: livePts }
      : livePts === 0
        ? { totalPointsLive: 0, liveScore: 0, appliedActiveReal: 0 }
        : null
  return {
    ...side,
    ...live,
    lineupSlotId: num(live.lineupSlotId) ?? num(side.lineupSlotId),
    playerId: num(live.playerId) ?? num(side.playerId),
    ...(liveFields ?? {}),
    playerPoolEntry: {
      ...sideP,
      ...liveP,
      ...(liveFields ?? {}),
      ...(appliedStatTotal != null ? { appliedStatTotal } : {}),
      player: {
        ...sidePlayer,
        ...livePlayer,
        fullName: str(livePlayer.fullName) || str(sidePlayer.fullName),
        stats: mergeStats(sideStats, liveStats)
      }
    }
  }
}

const mergeRosterPeriod = (
  side: Record<string, unknown> | null,
  live: Record<string, unknown> | null
): Record<string, unknown> | undefined => {
  const sideR = rosterPeriod(side)
  const liveR = rosterPeriod(live)
  const sideEntries = sideR ? asEntryRows(sideR.entries) : []
  const liveEntries = liveR ? asEntryRows(liveR.entries) : []
  if (liveEntries.length === 0) return sideR ?? undefined
  if (sideEntries.length === 0) return liveR ?? undefined
  const sideById = new Map<number, Record<string, unknown>>()
  for (const entry of sideEntries) {
    const id = num(entry.playerId)
    if (id != null) sideById.set(id, entry)
  }
  const liveIds = new Set<number>()
  const entries = liveEntries.map((entry) => {
    const id = num(entry.playerId)
    if (id != null) liveIds.add(id)
    const leftover = id != null ? sideById.get(id) : undefined
    return leftover ? mergeRosterEntry(leftover, entry) : entry
  })
  for (const leftover of sideEntries) {
    const id = num(leftover.playerId)
    if (id != null && liveIds.has(id)) continue
    entries.push(leftover)
  }
  return { ...sideR, ...liveR, entries }
}

const mergePeriodPoints = (
  side: Record<string, unknown> | null,
  live: Record<string, unknown> | null
): Record<string, number> | undefined => {
  const left = side && isRecord(side.pointsByScoringPeriod) ? side.pointsByScoringPeriod : {}
  const right = live && isRecord(live.pointsByScoringPeriod) ? live.pointsByScoringPeriod : {}
  const keys = new Set([...Object.keys(left), ...Object.keys(right)])
  if (keys.size === 0) return undefined
  const out: Record<string, number> = {}
  for (const key of keys) {
    const livePts = num(right[key])
    const sidePts = num(left[key])
    if (livePts != null) {
      out[key] = livePts
      continue
    }
    if (sidePts != null) out[key] = sidePts
  }
  return out
}

const starterLiveSum = (side: Record<string, unknown> | null): number => {
  if (!side) return 0
  const live = rosterPeriod(side)
  const entries = live ? asEntryRows(live.entries) : []
  let sum = 0
  let hasLive = false
  for (const entry of entries) {
    if (isBenchSlot(entry.lineupSlotId)) continue
    const ppe = isRecord(entry.playerPoolEntry) ? entry.playerPoolEntry : undefined
    const pts = livePtsFromRows(entry, ppe)
    if (pts == null || pts <= 0) continue
    hasLive = true
    sum += pts
  }
  return hasLive ? sum : 0
}

const compactStarterChipSum = (side: Record<string, unknown> | null): number => {
  if (!side) return 0
  const live = rosterPeriod(side)
  const entries = live ? asEntryRows(live.entries) : []
  let sum = 0
  let hasChip = false
  for (const entry of entries) {
    if (isBenchSlot(entry.lineupSlotId)) continue
    const ppe = isRecord(entry.playerPoolEntry) ? entry.playerPoolEntry : undefined
    const pts =
      livePtsFromRows(entry, ppe) ??
      num(entry.appliedTotal) ??
      (ppe ? num(ppe.appliedTotal) ?? num(ppe.appliedStatTotal) : undefined)
    if (pts == null || pts <= 0) continue
    hasChip = true
    sum += pts
  }
  return hasChip ? sum : 0
}

const mergeSide = (
  side: Record<string, unknown> | null,
  live: Record<string, unknown> | null
): Record<string, unknown> | null => {
  if (!side && !live) return null
  const merged: Record<string, unknown> = { ...(side ?? {}), ...(live ?? {}) }
  const fromLive = liveTeamPts(live)
  const fromSide = liveTeamPts(side)
  if (fromLive != null && fromLive > 0) {
    merged.totalPointsLive = fromLive
    merged.liveScore = fromLive
  } else if (fromLive === 0) {
    merged.totalPointsLive = 0
    merged.liveScore = 0
  } else {
    const liveChips = compactStarterChipSum(live)
    if (liveChips > 0) {
      merged.totalPointsLive = liveChips
      merged.liveScore = liveChips
    } else {
      const liveTotals = [fromSide, fromLive].filter((value): value is number => value != null)
      if (liveTotals.length > 0) merged.totalPointsLive = Math.max(...liveTotals)
    }
  }
  const periodPoints = mergePeriodPoints(side, live)
  if (periodPoints) merged.pointsByScoringPeriod = periodPoints
  const roster = mergeRosterPeriod(side, live)
  if (roster) merged.rosterForCurrentScoringPeriod = roster
  return merged
}

const entryToPlayer = (entry: EspnRosterEntry, scoringPeriodId?: number): Player => {
  const player = entry.playerPoolEntry?.player
  const playerId = String(entry.playerId ?? entry.playerPoolEntry?.id ?? '')
  return {
    playerId,
    name: player?.fullName || playerId,
    position: POSITION_BY_ID[num(player?.defaultPositionId) ?? -1] ?? '',
    nflTeam: espnTeamAbbr(num(player?.proTeamId)),
    status: espnInjuryLabel(player?.injuryStatus),
    points: getAppliedTotal(entry, scoringPeriodId)
  }
}

const lineupPlayers = (
  entries: EspnRosterEntry[],
  scoringPeriodId?: number
): { starters: Player[]; bench: Player[] } => {
  const starters: Player[] = []
  const bench: Player[] = []
  for (const entry of entries) {
    const player = entryToPlayer(entry, scoringPeriodId)
    if (!player.playerId) continue
    if (isBenchSlot(entry.lineupSlotId)) bench.push(player)
    else starters.push(player)
  }
  return { starters, bench }
}

const periodActual = (side: Record<string, unknown>, scoringPeriodId?: number): number | undefined => {
  const row = isRecord(side.pointsByScoringPeriod) ? side.pointsByScoringPeriod : null
  if (!row || scoringPeriodId == null) return undefined
  return num(row[scoringPeriodId]) ?? num(row[String(scoringPeriodId)])
}

const starterActualSum = (side: Record<string, unknown>, scoringPeriodId?: number): number => {
  const live = rosterPeriod(side)
  const entries = live ? (asEntryRows(live.entries) as EspnRosterEntry[]) : []
  let sum = 0
  for (const entry of entries) {
    if (isBenchSlot(entry.lineupSlotId)) continue
    const pts = getAppliedTotal(entry, scoringPeriodId)
    if (pts != null) sum += pts
  }
  return sum
}

const sideTotal = (side: Record<string, unknown>, scoringPeriodId?: number): number => {
  const live = liveTeamPts(side)
  if (live != null && live > 0) return live
  if (live === 0) return 0
  const liveStarters = starterLiveSum(side)
  if (liveStarters > 0) return liveStarters
  const starters = starterActualSum(side, scoringPeriodId)
  const period = periodActual(side, scoringPeriodId)
  const final = num(side.totalPoints)
  return Math.max(period ?? 0, final ?? 0, starters)
}

const rosterEntries = (side: Record<string, unknown>, teams: Record<string, unknown>[]): EspnRosterEntry[] => {
  const live = rosterPeriod(side)
  const liveEntries = live ? (asEntryRows(live.entries) as EspnRosterEntry[]) : []
  if (liveEntries.length > 0) return liveEntries
  const teamId = num(side.teamId)
  const team = teams.find((row) => num(row.id) === teamId)
  const roster = team && isRecord(team.roster) ? team.roster : null
  return roster ? (asEntryRows(roster.entries) as EspnRosterEntry[]) : []
}

export const scoringPeriodFromStatus = (payload: unknown, fallbackWeek: number): number => {
  const row = unwrapEspnPayload(payload, (next) => next.scoringPeriodId != null || isRecord(next.status))
  if (!row) return fallbackWeek
  const status = isRecord(row.status) ? row.status : null
  return num(status?.latestScoringPeriod) ?? num(status?.currentMatchupPeriod) ?? num(row.scoringPeriodId) ?? fallbackWeek
}

export const leagueNameFromPayload = (payload: unknown, fallback: string): string => {
  const row = unwrapEspnPayload(payload, (next) => isRecord(next.settings))
  if (!row) return fallback
  const settings = isRecord(row.settings) ? row.settings : null
  return str(settings?.name) || fallback
}

export const toEspnLeague = (args: {
  leagueId: string
  payload: unknown
  leagueSeason: string
  displayWeek: number
}): League => ({
  id: args.leagueId,
  name: leagueNameFromPayload(args.payload, `ESPN ${args.leagueId}`),
  provider: 'espn',
  season: args.leagueSeason,
  week: args.displayWeek
})

export const espnTeamsHaveOwners = (teams: Record<string, unknown>[]): boolean =>
  teams.some((team) => Boolean(str(team.primaryOwner)) || asArray(team.owners).length > 0)

export const findMyTeam = (
  teams: Record<string, unknown>[],
  cookies: EspnCookies | null
): Record<string, unknown> | undefined => {
  if (!cookies) return espnTeamsHaveOwners(teams) ? undefined : teams[0]
  return teams.find((team) => teamOwnsSwid(team, cookies.SWID))
}

export const espnTeamsFromPayload = (payload: unknown): Record<string, unknown>[] => {
  const row = unwrapEspnPayload(payload, (next) => next.teams != null)
  if (!row) return []
  return asTeamRows(row.teams)
}

export const mergeEspnTeams = (
  live: unknown,
  cached: Record<string, unknown>[] | undefined
): unknown => {
  const row = unwrapEspnPayload(live, hasEspnLeagueShape)
  if (!row || !cached || cached.length === 0) return live
  const liveTeams = espnTeamsFromPayload(row)
  if (espnTeamsHaveOwners(liveTeams)) return row
  const byId = new Map<number, Record<string, unknown>>()
  for (const team of cached) {
    const id = num(team.id)
    if (id != null) byId.set(id, team)
  }
  if (liveTeams.length === 0) return { ...row, teams: cached }
  return {
    ...row,
    teams: liveTeams.map((team) => {
      const prior = num(team.id) != null ? byId.get(num(team.id) as number) : undefined
      if (!prior) return team
      return {
        ...prior,
        ...team,
        primaryOwner: team.primaryOwner ?? prior.primaryOwner,
        owners: asArray(team.owners).length > 0 ? team.owners : prior.owners,
        location: team.location ?? prior.location,
        nickname: team.nickname ?? prior.nickname,
        record: team.record ?? prior.record
      }
    })
  }
}

const scheduleGameHasSides = (game: Record<string, unknown>): boolean => {
  const home = isRecord(game.home) ? game.home : null
  const away = isRecord(game.away) ? game.away : null
  return scheduleSideId(home) != null || scheduleSideId(away) != null
}

const scheduleGameKey = (game: Record<string, unknown>): string | null => {
  const home = isRecord(game.home) ? game.home : null
  const away = isRecord(game.away) ? game.away : null
  const homeId = scheduleSideId(home)
  const awayId = scheduleSideId(away)
  if (homeId == null || awayId == null) return null
  const period = num(game.matchupPeriodId) ?? num(game.scoringPeriodId)
  return `${period ?? ''}:${homeId}:${awayId}`
}

/** Compact `mLiveScoring` week stubs are `{ matchupPeriodId }` only — no home/away team ids. */
export const espnLivePayloadIsStub = (payload: unknown): boolean => {
  const row = unwrapEspnPayload(payload, hasEspnLeagueShape)
  if (!row) return true
  if (liveScoringFromPayload(row).some(looksLikeLiveTeamRow)) return false
  const schedule = payloadSchedule(row)
  if (schedule.length === 0) return false
  return !schedule.some(scheduleGameHasSides)
}

const teamFromId = (
  id: number | undefined,
  teams: Record<string, unknown>[],
  members: Record<string, unknown>[],
  side?: Record<string, unknown> | null
): Team | null => {
  if (id == null) return null
  const raw = teams.find((team) => num(team.id) === id)
  if (raw) return toTeam(raw, members)
  if (side) {
    const fromSide = toTeam({ ...side, id }, members)
    if (fromSide.name && fromSide.name !== `Team ${id}`) return fromSide
  }
  return { id: String(id), name: `Team ${id}`, owner: '', record: '0-0' }
}

const overlaySchedule = (
  base: Record<string, unknown>[],
  live: Record<string, unknown>[]
): Record<string, unknown>[] | null => {
  if (live.length === 0 || base.length === 0) return null
  const liveByKey = new Map<string, Record<string, unknown>>()
  for (const game of live) {
    const key = scheduleGameKey(game)
    if (key) liveByKey.set(key, game)
  }
  if (liveByKey.size === 0) return null
  let overlaid = 0
  const next = base.map((game) => {
    const overlay = liveByKey.get(scheduleGameKey(game) ?? '')
    if (!overlay) return game
    overlaid += 1
    return {
      ...game,
      home: mergeSide(isRecord(game.home) ? game.home : null, isRecord(overlay.home) ? overlay.home : null),
      away: mergeSide(isRecord(game.away) ? game.away : null, isRecord(overlay.away) ? overlay.away : null)
    }
  })
  return overlaid > 0 ? next : null
}

const payloadSchedule = (payload: Record<string, unknown>): Record<string, unknown>[] => {
  const top = asScheduleGames(payload.schedule)
  const nested = isRecord(payload.liveScoring) ? asScheduleGames(payload.liveScoring.schedule) : []
  const merged = overlaySchedule(top, nested)
  if (merged) return merged
  if (nested.some((game) => scheduleGameKey(game) != null)) return nested
  return top
}

export const overlayLiveScoring = (base: unknown, livePayload: unknown): unknown => {
  const baseRow = unwrapEspnPayload(base, hasEspnLeagueShape)
  const liveRow = unwrapEspnPayload(livePayload, hasEspnLeagueShape)
  if (!baseRow) return liveRow ?? livePayload
  if (!liveRow) return baseRow
  const next: Record<string, unknown> = { ...baseRow }
  let changed = false
  if (Object.prototype.hasOwnProperty.call(liveRow, 'liveScoring')) {
    const liveBlob = liveRow.liveScoring
    const empty = liveBlob == null || liveScoringTeamRows(liveBlob).length === 0
    if (!empty) {
      next.liveScoring = liveBlob
      changed = true
    }
  } else if (liveScoringFromPayload(liveRow).length > 0) {
    next.liveScoring = liveRow
    changed = true
  }
  const nested = isRecord(liveRow.liveScoring) ? asScheduleGames(liveRow.liveScoring.schedule) : []
  const liveSchedule = [...asScheduleGames(liveRow.schedule), ...nested]
  const mergedSchedule = overlaySchedule(asScheduleGames(baseRow.schedule), liveSchedule)
  if (mergedSchedule) {
    next.schedule = mergedSchedule
    changed = true
  }
  return changed ? next : baseRow
}

const livePointsByPlayerId = (
  side: Record<string, unknown>,
  scoringPeriodId?: number
): Map<string, number> => {
  const byId = new Map<string, number>()
  const put = (entry: Record<string, unknown>, overwrite: boolean): void => {
    const id = num(entry.playerId) ?? num(entry.id)
    if (id == null) return
    const compact = compactLivePoints(entry)
    const applied = getAppliedTotal(entry as EspnRosterEntry, scoringPeriodId)
    const pts = compact != null ? compact : applied
    if (pts == null) return
    const key = String(id)
    if (overwrite && compact != null) {
      byId.set(key, compact)
      return
    }
    if (overwrite && pts > 0) {
      byId.set(key, pts)
      return
    }
    const prev = byId.get(key)
    if (prev == null) {
      byId.set(key, pts)
      return
    }
    if (compact != null) byId.set(key, compact)
  }
  const period = rosterPeriod(side)
  const entries = period ? asEntryRows(period.entries) : []
  for (const entry of entries) put(entry, false)
  for (const row of asPlayerRows(side.players)) put(row, true)
  return byId
}

const overlayEspnPlayers = (
  players: Player[],
  byId: Map<string, number>,
  preferLive: boolean
): Player[] => {
  let hasPositiveChip = false
  for (const pts of byId.values()) {
    if (pts > 0) {
      hasPositiveChip = true
      break
    }
  }
  return players.map((player) => {
    const coerced = num(player.playerId)
    const pts = byId.get(player.playerId) ?? (coerced != null ? byId.get(String(coerced)) : undefined)
    if (pts == null) return player
    if (preferLive) {
      if (pts > 0 || hasPositiveChip) return { ...player, points: pts }
      return player
    }
    return { ...player, points: Math.max(pts, player.points ?? 0) }
  })
}

const hasEspnLivePts = (
  side: Record<string, unknown> | null,
  byId: Map<string, number>,
  displayWeek: number
): boolean => {
  if (side && sideTotal(side, displayWeek) > 0) return true
  for (const pts of byId.values()) {
    if (pts > 0) return true
  }
  return false
}

export const overlayEspnMatchup = (
  prev: Matchup,
  livePayload: unknown,
  displayWeek: number,
  preferLive = false
): Matchup | null => {
  const payload = unwrapEspnPayload(livePayload, hasEspnLeagueShape)
  if (!payload) return null
  if (espnLivePayloadIsStub(payload)) return null
  if (!matchupHasLineup(prev)) return null
  const myId = num(prev.myTeam.id)
  if (myId == null || myId <= 0) return null
  const liveTeams = liveScoringTeams(payload)
  const schedule = payloadSchedule(payload)
  const game = schedule.find((row) => {
    const matchupPeriod = num(row.matchupPeriodId) ?? num(row.scoringPeriodId)
    if (matchupPeriod != null && matchupPeriod !== displayWeek) return false
    const home = isRecord(row.home) ? row.home : null
    const away = isRecord(row.away) ? row.away : null
    return scheduleSideId(home) === myId || scheduleSideId(away) === myId
  })
  const home = game && isRecord(game.home) ? game.home : null
  const away = game && isRecord(game.away) ? game.away : null
  const iAmHome = scheduleSideId(home) === myId
  const liveMine = liveTeamFor(liveTeams, myId)
  const mySide = mergeSide(iAmHome ? home : away, liveMine)
  if (!mySide) return null
  const oppId = prev.oppTeam
    ? num(prev.oppTeam.id)
    : scheduleSideId(iAmHome ? away : home)
  const liveOpp = liveTeamFor(liveTeams, oppId)
  const oppSide = mergeSide(iAmHome ? away : home, liveOpp)
  const myById = livePointsByPlayerId(mySide, displayWeek)
  const oppById = oppSide ? livePointsByPlayerId(oppSide, displayWeek) : new Map<string, number>()
  if (!overlayStartersBelong(prev.starters, myById.keys())) return null
  const trustMine = preferLive && hasEspnLivePts(mySide, myById, displayWeek)
  const trustOpp = Boolean(preferLive && oppSide && hasEspnLivePts(oppSide, oppById, displayWeek))
  const overlayTotal = (prevPts: number, livePts: number, trust: boolean): number =>
    trust ? livePts : Math.max(prevPts, livePts)
  return {
    ...prev,
    myPoints: overlayTotal(prev.myPoints, sideTotal(mySide, displayWeek), trustMine),
    oppPoints: oppSide ? overlayTotal(prev.oppPoints, sideTotal(oppSide, displayWeek), trustOpp) : prev.oppPoints,
    starters: overlayEspnPlayers(prev.starters, myById, trustMine),
    bench: overlayEspnPlayers(prev.bench, myById, trustMine),
    oppStarters: oppSide ? overlayEspnPlayers(prev.oppStarters, oppById, trustOpp) : prev.oppStarters,
    oppBench: oppSide ? overlayEspnPlayers(prev.oppBench, oppById, trustOpp) : prev.oppBench,
    scoresFinal: espnGameIsFinal(game)
  }
}

export const toEspnMatchup = (args: {
  payload: unknown
  cookies: EspnCookies | null
  displayWeek: number
  myTeamId?: number
}): Matchup | null => {
  const payload = unwrapEspnPayload(args.payload, hasEspnLeagueShape)
  if (!payload) return null
  const teams = espnTeamsFromPayload(payload)
  const swidTeam = findMyTeam(teams, args.cookies)
  const hinted =
    args.myTeamId != null ? teams.find((team) => num(team.id) === args.myTeamId) ?? { id: args.myTeamId } : undefined
  const myTeamRaw = swidTeam ?? hinted
  if (!myTeamRaw) return null
  const myId = num(myTeamRaw.id)
  const period = args.displayWeek > 0 ? args.displayWeek : scoringPeriodFromStatus(payload, args.displayWeek)
  const schedule = payloadSchedule(payload)
  const game = schedule.find((row) => {
    const matchupPeriod = num(row.matchupPeriodId) ?? num(row.scoringPeriodId)
    if (matchupPeriod != null && matchupPeriod !== period) return false
    const home = isRecord(row.home) ? row.home : null
    const away = isRecord(row.away) ? row.away : null
    return scheduleSideId(home) === myId || scheduleSideId(away) === myId
  })
  const members = membersOf(payload)
  const liveTeams = liveScoringTeams(payload)
  const periodGames = schedule.filter((row) => {
    const matchupPeriod = num(row.matchupPeriodId) ?? num(row.scoringPeriodId)
    return matchupPeriod == null || matchupPeriod === period
  })
  const scheduleHasSides = periodGames.some(scheduleGameHasSides)
  if (!game) {
    if (!scheduleHasSides && periodGames.length > 0) return null
    const liveMine = liveTeamFor(liveTeams, myId)
    if (!scheduleHasSides && !liveMine) return null
    if (!liveMine) {
      return {
        myTeam: toTeam(myTeamRaw, members),
        oppTeam: null,
        myPoints: 0,
        oppPoints: 0,
        starters: [],
        bench: [],
        oppStarters: [],
        oppBench: []
      }
    }
    const entries = rosterEntries(liveMine, teams)
    const { starters, bench } = lineupPlayers(entries, period)
    return {
      myTeam: toTeam(myTeamRaw, members),
      oppTeam: null,
      myPoints: sideTotal(liveMine, period),
      oppPoints: 0,
      starters,
      bench,
      oppStarters: [],
      oppBench: []
    }
  }
  const home = isRecord(game.home) ? game.home : null
  const away = isRecord(game.away) ? game.away : null
  const iAmHome = scheduleSideId(home) === myId
  const mySide = mergeSide(iAmHome ? home : away, liveTeamFor(liveTeams, myId))
  const oppId = scheduleSideId(iAmHome ? away : home)
  const oppSide = mergeSide(iAmHome ? away : home, liveTeamFor(liveTeams, oppId))
  if (!mySide) return null
  const entries = rosterEntries(mySide, teams)
  const { starters, bench } = lineupPlayers(entries, period)
  const oppEntries = oppSide ? rosterEntries(oppSide, teams) : []
  const oppLineup = lineupPlayers(oppEntries, period)
  return {
    myTeam: toTeam(myTeamRaw, members),
    oppTeam: teamFromId(oppId, teams, members, iAmHome ? away : home),
    myPoints: sideTotal(mySide, period),
    oppPoints: oppSide ? sideTotal(oppSide, period) : 0,
    starters,
    bench,
    oppStarters: oppLineup.starters,
    oppBench: oppLineup.bench,
    scoresFinal: espnGameIsFinal(game)
  }
}

export const toEspnTransactions = (payload: unknown): Transaction[] => {
  const row = unwrapEspnPayload(payload, (next) => next.transactions != null)
  if (!row) return []
  const rows = asArray(row.transactions).filter(isRecord)
  return rows
    .filter((row) => {
      const status = str(row.status)?.toUpperCase()
      return !status || status === 'EXECUTED' || status === 'COMPLETE'
    })
    .map((row) => {
      const items = asArray(row.items).filter(isRecord)
      const players = items.map((item) => {
        const player = isRecord(item.player) ? item.player : null
        return str(player?.fullName) || String(item.playerId ?? '')
      })
      const rawType = (str(row.type) || 'transaction').toLowerCase()
      const adds = items.filter((item) => (str(item.type) ?? '').toUpperCase() === 'ADD').length
      const drops = items.filter((item) => (str(item.type) ?? '').toUpperCase() === 'DROP').length
      return {
        id: String(row.id ?? row.proposedDate ?? Math.random()),
        type: mapTransactionKind(rawType, adds, drops),
        players,
        timestamp: num(row.proposedDate) ?? num(row.processDate) ?? 0
      }
    })
}

const ADD_MESSAGE_TYPES = new Set([178, 180])
const DROP_MESSAGE_TYPES = new Set([179, 181, 239])
const TRADE_MESSAGE_TYPES = new Set([244])

const activityPlayerName = (msg: Record<string, unknown>): string => {
  const target = isRecord(msg.for) ? msg.for : isRecord(msg.targetData) ? msg.targetData : null
  if (target) {
    return (
      str(target.fullName) ||
      [str(target.firstName), str(target.lastName)].filter(Boolean).join(' ') ||
      String(target.id ?? '')
    )
  }
  return str(msg.message) || ''
}

export const toEspnActivity = (payload: unknown): Transaction[] => {
  const row = unwrapEspnPayload(payload, (next) => next.topics != null)
  if (!row) return []
  const topics = asArray(row.topics).filter(isRecord)
  return topics.map((topic) => {
    const messages = asArray(topic.messages).filter(isRecord)
    let adds = 0
    let drops = 0
    let traded = false
    const players: string[] = []
    for (const msg of messages) {
      const typeId = num(msg.messageTypeId)
      if (typeId != null && ADD_MESSAGE_TYPES.has(typeId)) adds += 1
      if (typeId != null && DROP_MESSAGE_TYPES.has(typeId)) drops += 1
      if (typeId != null && TRADE_MESSAGE_TYPES.has(typeId)) traded = true
      const name = activityPlayerName(msg)
      if (name) players.push(name)
    }
    const raw = traded ? 'trade' : adds > 0 && drops > 0 ? 'add_drop' : adds > 0 ? 'add' : drops > 0 ? 'drop' : 'status'
    return {
      id: String(topic.id ?? topic.date ?? players.join('-')),
      type: mapTransactionKind(raw, adds, drops),
      players,
      timestamp: num(topic.date) ?? num(messages[0]?.date) ?? 0
    }
  })
}

export const leaguesFromFanPayload = (
  payload: unknown,
  leagueSeason: string,
  displayWeek: number
): League[] => {
  const row = unwrapEspnPayload(
    payload,
    (next) =>
      next.preferences != null || next.favoriteLeagues != null || next.leagues != null
  )
  if (!row) return []
  const preferences = isRecord(row.preferences) ? row.preferences : row
  const bags: unknown[] = [
    ...asArray(row.favoriteLeagues),
    ...asArray(row.leagues),
    ...asArray(isRecord(preferences) ? preferences.favoriteLeagues : undefined)
  ]
  const out: League[] = []
  for (const row of bags) {
    if (!isRecord(row)) continue
    const id = str(row.leagueId) || str(row.id) || (num(row.leagueId) != null ? String(row.leagueId) : null)
    if (!id) continue
    const sport = str(row.sport) || str(row.gameId) || ''
    if (sport && !/ffl|football/i.test(sport)) continue
    out.push({
      id,
      name: str(row.leagueName) || str(row.name) || `ESPN ${id}`,
      provider: 'espn',
      season: str(row.seasonId) || leagueSeason,
      week: displayWeek
    })
  }
  return out
}

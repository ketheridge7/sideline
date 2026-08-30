import type { League, Matchup, Player, Team, Transaction } from '@shared/types'
import { mapTransactionKind } from '@shared/transactionKind'
import type { EspnCookies } from './espnClient'

export const BENCH_SLOT_IDS = new Set([20, 21])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

const num = (value: unknown): number | undefined => (typeof value === 'number' ? value : undefined)

const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

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

export const getAppliedTotal = (entry: EspnRosterEntry): number | undefined => {
  const stats = entry.playerPoolEntry?.player?.stats
  if (Array.isArray(stats)) {
    const live = stats.find((row) => row.statSourceId === 0 && row.statSplitTypeId === 1)
    if (live && typeof live.appliedTotal === 'number') return live.appliedTotal
  }
  const fallback = entry.playerPoolEntry?.appliedStatTotal
  return typeof fallback === 'number' ? fallback : undefined
}

const swidNorm = (value: string): string => value.replace(/[{}]/g, '').toLowerCase()

const teamOwnsSwid = (team: Record<string, unknown>, swid: string): boolean => {
  const target = swidNorm(swid)
  const primary = str(team.primaryOwner)
  if (primary && swidNorm(primary) === target) return true
  return asArray(team.owners).some((owner) => typeof owner === 'string' && swidNorm(owner) === target)
}

const teamName = (team: Record<string, unknown>): string => {
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

const ownerName = (team: Record<string, unknown>): string => str(team.abbrev) || 'Owner'

const toTeam = (team: Record<string, unknown>): Team => ({
  id: String(team.id ?? ''),
  name: teamName(team),
  owner: ownerName(team),
  record: teamRecord(team)
})

const entryToPlayer = (entry: EspnRosterEntry): Player => {
  const player = entry.playerPoolEntry?.player
  return {
    playerId: String(entry.playerId ?? ''),
    name: player?.fullName || String(entry.playerId ?? ''),
    position: POSITION_BY_ID[player?.defaultPositionId ?? -1] ?? '',
    nflTeam: player?.proTeamId != null ? String(player.proTeamId) : '',
    status: player?.injuryStatus,
    points: getAppliedTotal(entry)
  }
}

const sideTotal = (side: Record<string, unknown>): number => {
  return num(side.totalPointsLive) ?? num(side.totalPoints) ?? 0
}

const rosterEntries = (side: Record<string, unknown>, teams: Record<string, unknown>[]): EspnRosterEntry[] => {
  const live = isRecord(side.rosterForCurrentScoringPeriod) ? side.rosterForCurrentScoringPeriod : null
  if (live && Array.isArray(live.entries)) return live.entries as EspnRosterEntry[]
  const teamId = num(side.teamId)
  const team = teams.find((row) => num(row.id) === teamId)
  const roster = team && isRecord(team.roster) ? team.roster : null
  if (roster && Array.isArray(roster.entries)) return roster.entries as EspnRosterEntry[]
  return []
}

export const scoringPeriodFromStatus = (payload: unknown, fallbackWeek: number): number => {
  if (!isRecord(payload)) return fallbackWeek
  const status = isRecord(payload.status) ? payload.status : null
  return num(status?.latestScoringPeriod) ?? num(status?.currentMatchupPeriod) ?? num(payload.scoringPeriodId) ?? fallbackWeek
}

export const leagueNameFromPayload = (payload: unknown, fallback: string): string => {
  if (!isRecord(payload)) return fallback
  const settings = isRecord(payload.settings) ? payload.settings : null
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

export const findMyTeam = (
  teams: Record<string, unknown>[],
  cookies: EspnCookies | null
): Record<string, unknown> | undefined => {
  if (!cookies) return teams[0]
  return teams.find((team) => teamOwnsSwid(team, cookies.SWID)) ?? teams[0]
}

export const toEspnMatchup = (args: {
  payload: unknown
  cookies: EspnCookies | null
  displayWeek: number
}): Matchup | null => {
  if (!isRecord(args.payload)) return null
  const teams = asArray(args.payload.teams).filter(isRecord)
  const myTeamRaw = findMyTeam(teams, args.cookies)
  if (!myTeamRaw) return null
  const myId = num(myTeamRaw.id)
  const period = scoringPeriodFromStatus(args.payload, args.displayWeek)
  const schedule = asArray(args.payload.schedule).filter(isRecord)
  const game = schedule.find((row) => {
    const matchupPeriod = num(row.matchupPeriodId) ?? num(row.scoringPeriodId)
    if (matchupPeriod !== period && matchupPeriod !== args.displayWeek) return false
    const home = isRecord(row.home) ? row.home : null
    const away = isRecord(row.away) ? row.away : null
    return num(home?.teamId) === myId || num(away?.teamId) === myId
  })
  if (!game) {
    return {
      myTeam: toTeam(myTeamRaw),
      oppTeam: null,
      myPoints: 0,
      oppPoints: 0,
      starters: [],
      bench: [],
      oppStarters: [],
      oppBench: []
    }
  }
  const home = isRecord(game.home) ? game.home : null
  const away = isRecord(game.away) ? game.away : null
  const iAmHome = num(home?.teamId) === myId
  const mySide = iAmHome ? home : away
  const oppSide = iAmHome ? away : home
  if (!mySide) return null
  const oppId = oppSide ? num(oppSide.teamId) : undefined
  const oppTeamRaw = teams.find((team) => num(team.id) === oppId)
  const entries = rosterEntries(mySide, teams)
  const starters = entries.filter((entry) => !BENCH_SLOT_IDS.has(entry.lineupSlotId ?? -1)).map(entryToPlayer)
  const bench = entries.filter((entry) => BENCH_SLOT_IDS.has(entry.lineupSlotId ?? -1)).map(entryToPlayer)
  const oppEntries = oppSide ? rosterEntries(oppSide, teams) : []
  const oppStarters = oppEntries
    .filter((entry) => !BENCH_SLOT_IDS.has(entry.lineupSlotId ?? -1))
    .map(entryToPlayer)
  const oppBench = oppEntries.filter((entry) => BENCH_SLOT_IDS.has(entry.lineupSlotId ?? -1)).map(entryToPlayer)
  return {
    myTeam: toTeam(myTeamRaw),
    oppTeam: oppTeamRaw ? toTeam(oppTeamRaw) : null,
    myPoints: sideTotal(mySide),
    oppPoints: oppSide ? sideTotal(oppSide) : 0,
    starters,
    bench,
    oppStarters,
    oppBench
  }
}

export const toEspnTransactions = (payload: unknown): Transaction[] => {
  if (!isRecord(payload)) return []
  const rows = asArray(payload.transactions).filter(isRecord)
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

export const leaguesFromFanPayload = (
  payload: unknown,
  leagueSeason: string,
  displayWeek: number
): League[] => {
  if (!isRecord(payload)) return []
  const preferences = isRecord(payload.preferences) ? payload.preferences : payload
  const bags: unknown[] = [
    ...asArray(payload.favoriteLeagues),
    ...asArray(payload.leagues),
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

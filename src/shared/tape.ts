import type { League, Matchup, Player, TapeEvent, TapeKind, Transaction } from './types'
import { leagueKey, parseLeagueKey } from './types'
import { transactionKindLabel } from './transactionKind'
import { tapePlayerLabel, visibleInjury } from './display'

const allPlayers = (matchup: Matchup): Player[] => [
  ...matchup.starters,
  ...matchup.bench,
  ...matchup.oppStarters,
  ...matchup.oppBench
]

export const transactionToTape = (league: League, row: Transaction): TapeEvent => ({
  id: `tx:${leagueKey(league.provider, league.id)}:${row.id}`,
  at: row.timestamp || 0,
  kind: row.type,
  player: row.players.filter(Boolean).join(', ') || league.name,
  detail: transactionKindLabel(row.type),
  leagueKey: leagueKey(league.provider, league.id),
  leagueName: league.name
})

/** Adds/drops/trades/status clutter ESPN tape; scores and injuries stay. */
export const isEspnTransactionTapeKind = (kind: TapeKind): boolean => {
  switch (kind) {
    case 'score':
    case 'injury':
      return false
    case 'add':
    case 'add_drop':
    case 'drop':
    case 'trade':
    case 'status':
      return true
    default: {
      const _never: never = kind
      return _never
    }
  }
}

export const isEspnTransactionTapeEvent = (row: TapeEvent): boolean => {
  if (!isEspnTransactionTapeKind(row.kind)) return false
  const parsed = row.leagueKey ? parseLeagueKey(row.leagueKey) : null
  return parsed?.provider === 'espn'
}

/** ESPN transactions stay off the scoring rail; Sleeper waiver/trade rows still map. */
export const transactionsToTape = (league: League, rows: Transaction[]): TapeEvent[] => {
  switch (league.provider) {
    case 'espn':
      return []
    case 'sleeper':
      return rows.map((row) => transactionToTape(league, row))
    default: {
      const _never: never = league.provider
      return _never
    }
  }
}

export const withTickDeltas = (
  league: Pick<League, 'provider' | 'id'>,
  matchup: Matchup,
  prev: Map<string, number>
): Matchup => {
  const prefix = leagueKey(league.provider, league.id)
  const tick = (player: Player): Player => {
    if (typeof player.points !== 'number') {
      return player.tickDelta == null ? player : { ...player, tickDelta: undefined }
    }
    const key = `${prefix}:${player.playerId}`
    const last = prev.get(key)
    if (typeof last !== 'number') {
      return player.tickDelta == null ? player : { ...player, tickDelta: undefined }
    }
    const delta = Math.round((player.points - last) * 100) / 100
    if (delta === 0) return { ...player, tickDelta: undefined }
    return { ...player, tickDelta: delta }
  }
  return {
    ...matchup,
    starters: matchup.starters.map(tick),
    bench: matchup.bench.map(tick),
    oppStarters: matchup.oppStarters.map(tick),
    oppBench: matchup.oppBench.map(tick)
  }
}

export const scoreTapeFromDiff = (
  league: League,
  matchup: Matchup,
  prev: Map<string, number>
): TapeEvent[] => {
  const events: TapeEvent[] = []
  const prefix = leagueKey(league.provider, league.id)
  for (const player of allPlayers(matchup)) {
    if (typeof player.points !== 'number') continue
    const key = `${prefix}:${player.playerId}`
    const last = prev.get(key)
    prev.set(key, player.points)
    if (typeof last !== 'number') continue
    const delta = Math.round((player.points - last) * 100) / 100
    if (delta === 0) continue
    events.push({
      id: `score:${key}:${player.points}`,
      at: Date.now(),
      kind: 'score',
      player: tapePlayerLabel(player),
      detail: player.lastPlay || player.position,
      delta,
      leagueKey: prefix,
      leagueName: league.name
    })
  }
  return events
}

export const injuryTapeFromDiff = (
  league: League,
  matchup: Matchup,
  prev: Map<string, string>
): TapeEvent[] => {
  const events: TapeEvent[] = []
  const prefix = leagueKey(league.provider, league.id)
  for (const player of allPlayers(matchup)) {
    const next = visibleInjury(player.status) ?? ''
    const key = `${prefix}:${player.playerId}`
    const last = prev.get(key)
    prev.set(key, next)
    // Empty prev is a cold baseline (app open / first paint), not a transition.
    if (last === undefined) continue
    if (!next || next === last) continue
    events.push({
      id: `inj:${key}:${next}`,
      at: Date.now(),
      kind: 'injury',
      player: tapePlayerLabel(player),
      detail: player.lastPlay || next,
      leagueKey: prefix,
      leagueName: league.name
    })
  }
  return events
}

export const mergeTape = (live: TapeEvent[], snapshot: TapeEvent[], limit = 24): TapeEvent[] => {
  const seen = new Set<string>()
  const out: TapeEvent[] = []
  for (const row of [...live, ...snapshot].sort((a, b) => b.at - a.at)) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    out.push(row)
    if (out.length >= limit) break
  }
  return out
}

const ROSTER_TAPE_KINDS: ReadonlySet<TapeKind> = new Set(['add', 'drop', 'add_drop', 'trade'])

export const isRosterTapeEvent = (row: TapeEvent): boolean => ROSTER_TAPE_KINDS.has(row.kind)

export const SESSION_TAPE_LIMIT = 32
export const ROSTER_TAPE_LIMIT = 16

/** Session tape: Sleeper roster add/drop/trade rows persist even when newer score ticks would cap them out. ESPN transaction-style rows never enter the rail. */
export const mergeSessionTape = (
  live: TapeEvent[],
  snapshot: TapeEvent[],
  limit = SESSION_TAPE_LIMIT
): TapeEvent[] => {
  const seen = new Set<string>()
  const roster: TapeEvent[] = []
  const rest: TapeEvent[] = []
  for (const row of [...live, ...snapshot].sort((a, b) => b.at - a.at)) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    if (isEspnTransactionTapeEvent(row)) continue
    if (isRosterTapeEvent(row)) {
      if (roster.length < ROSTER_TAPE_LIMIT) roster.push(row)
      continue
    }
    rest.push(row)
  }
  const room = Math.max(0, limit - roster.length)
  return [...roster, ...rest.slice(0, room)].sort((a, b) => b.at - a.at)
}

/** Drop ESPN add/drop/trade/status rows anywhere the scoring rail is painted. */
export const scoringTapeEvents = (events: TapeEvent[]): TapeEvent[] =>
  events.filter((row) => !isEspnTransactionTapeEvent(row))

/** SCOREBOARD tape follows the selected league; rows without a key (status toasts) still pass. */
export const tapeForLeague = (events: TapeEvent[], selectedKey: string | null | undefined): TapeEvent[] => {
  const visible = scoringTapeEvents(events)
  if (!selectedKey) return visible
  return visible.filter((row) => !row.leagueKey || row.leagueKey === selectedKey)
}

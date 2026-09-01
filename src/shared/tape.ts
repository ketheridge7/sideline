import type { League, Matchup, Player, TapeEvent, Transaction } from './types'
import { leagueKey } from './types'
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
    const next = visibleInjury(player.status)
    const key = `${prefix}:${player.playerId}`
    const last = prev.get(key) ?? null
    if (next) prev.set(key, next)
    else prev.delete(key)
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

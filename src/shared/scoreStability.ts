import type { Matchup, Player } from './types'

/** Decreases commit after this many consecutive polls agree (0.1 rounding). */
export const SCORE_STABILITY_CONFIRM_POLLS = 2

export type ScoreCommitPlan =
  | 'seed'
  | 'commit-increase'
  | 'keep'
  | 'hold-pending'
  | 'commit-confirmed'
  | 'commit-official'

export type ScorePending = {
  value: number
  polls: number
}

export type ScoreLane = {
  committed: number | null
  pending?: ScorePending
}

export type MatchupScoreMemory = {
  week?: number
  mine: ScoreLane
  opp: ScoreLane
  players: Map<string, ScoreLane>
}

export const emptyScoreMemory = (): MatchupScoreMemory => ({
  mine: { committed: null },
  opp: { committed: null },
  players: new Map()
})

export const roundScore = (value: number): number => Math.round(value * 10) / 10

export const scoreCommitPlan = (opts: {
  committed: number | null
  next: number
  pendingValue?: number
  pendingPolls?: number
  official?: boolean
}): ScoreCommitPlan => {
  if (opts.committed == null || !Number.isFinite(opts.committed)) return 'seed'
  if (!Number.isFinite(opts.next)) return 'keep'
  const committedR = roundScore(opts.committed)
  const nextR = roundScore(opts.next)
  if (nextR > committedR) return 'commit-increase'
  if (nextR === committedR) return 'keep'
  if (opts.official) return 'commit-official'
  const pendingR = opts.pendingValue != null && Number.isFinite(opts.pendingValue) ? roundScore(opts.pendingValue) : null
  const polls = pendingR === nextR ? (opts.pendingPolls ?? 0) + 1 : 1
  if (polls >= SCORE_STABILITY_CONFIRM_POLLS) return 'commit-confirmed'
  return 'hold-pending'
}

export const commitScore = (
  lane: ScoreLane,
  next: number,
  official = false
): ScoreLane => {
  const plan = scoreCommitPlan({
    committed: lane.committed,
    next,
    pendingValue: lane.pending?.value,
    pendingPolls: lane.pending?.polls,
    official
  })
  switch (plan) {
    case 'seed':
    case 'commit-increase':
    case 'commit-confirmed':
    case 'commit-official':
      return { committed: next }
    case 'keep':
      return { committed: lane.committed }
    case 'hold-pending': {
      const samePending =
        lane.pending != null && Number.isFinite(lane.pending.value) && roundScore(lane.pending.value) === roundScore(next)
      return {
        committed: lane.committed,
        pending: { value: next, polls: samePending ? (lane.pending?.polls ?? 0) + 1 : 1 }
      }
    }
    default: {
      const _never: never = plan
      return _never
    }
  }
}

const playerPts = (player: Player | undefined): number | undefined =>
  typeof player?.points === 'number' && Number.isFinite(player.points) ? player.points : undefined

const playerById = (players: Player[]): Map<string, Player> => {
  const byId = new Map<string, Player>()
  for (const player of players) {
    if (player.playerId) byId.set(player.playerId, player)
  }
  return byId
}

const stabilizePlayers = (
  prev: Player[],
  next: Player[],
  memory: Map<string, ScoreLane>,
  official: boolean
): Player[] => {
  const prevById = playerById(prev)
  return next.map((player) => {
    const last = prevById.get(player.playerId)
    const live = playerPts(player)
    if (live == null) {
      const held = playerPts(last)
      return held == null ? player : { ...player, points: held }
    }
    const seeded = memory.get(player.playerId) ?? { committed: playerPts(last) ?? null }
    const lane = commitScore(seeded, live, official)
    memory.set(player.playerId, lane)
    return lane.committed == null ? player : { ...player, points: lane.committed }
  })
}

const prunePlayers = (memory: Map<string, ScoreLane>, keep: Iterable<Player>): void => {
  const ids = new Set<string>()
  for (const player of keep) {
    if (player.playerId) ids.add(player.playerId)
  }
  for (const id of memory.keys()) {
    if (!ids.has(id)) memory.delete(id)
  }
}

export const stabilizeMatchup = (
  prev: Matchup | null,
  next: Matchup,
  memory: MatchupScoreMemory,
  opts?: { week?: number; official?: boolean }
): Matchup => {
  if (opts?.week != null && memory.week != null && memory.week !== opts.week) {
    memory.week = opts.week
    memory.mine = { committed: next.myPoints }
    memory.opp = { committed: next.oppPoints }
    memory.players = new Map()
    return next
  }
  if (opts?.week != null) memory.week = opts.week
  const official = Boolean(opts?.official || next.scoresFinal)
  const mine = commitScore(
    { committed: memory.mine.committed ?? prev?.myPoints ?? null, pending: memory.mine.pending },
    next.myPoints,
    official
  )
  const opp = commitScore(
    { committed: memory.opp.committed ?? prev?.oppPoints ?? null, pending: memory.opp.pending },
    next.oppPoints,
    official
  )
  memory.mine = mine
  memory.opp = opp
  const starters = stabilizePlayers(prev?.starters ?? [], next.starters, memory.players, official)
  const bench = stabilizePlayers(prev?.bench ?? [], next.bench, memory.players, official)
  const oppStarters = stabilizePlayers(prev?.oppStarters ?? [], next.oppStarters, memory.players, official)
  const oppBench = stabilizePlayers(prev?.oppBench ?? [], next.oppBench, memory.players, official)
  prunePlayers(memory.players, [...starters, ...bench, ...oppStarters, ...oppBench])
  return {
    ...next,
    myPoints: mine.committed ?? next.myPoints,
    oppPoints: opp.committed ?? next.oppPoints,
    starters,
    bench,
    oppStarters,
    oppBench
  }
}

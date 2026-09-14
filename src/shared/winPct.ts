/**
 * Provider matchup chance-to-win.
 *
 * ESPN publishes `schedule[].home.winProbability` / `away.winProbability` on
 * `mMatchupScore` (0–1). Compact `mLiveScoring` omits it — leftover boxscore
 * values are kept, never replaced with our CDF or live score-share.
 *
 * Sleeper public `GET /league/{id}/matchups/{week}` has no win% field
 * (probed 2026 week 1). GraphQL `MatchupLeg` has `proj_points` / `max_points`
 * but no win% and is cookie-gated. If a published 0–1 (or 0–100) field appears
 * on the REST matchup row, parse it; otherwise LeadBar is pending.
 */

export type ChanceToWin = {
  mine: number
  opp: number
}

const finiteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const clampUnit = (value: number): number => Math.min(1, Math.max(0, value))

/** Coerce a published win% (0–1 or 0–100) to a unit interval. */
export const asWinProbability = (value: unknown): number | undefined => {
  const n = finiteNumber(value)
  if (n == null || n < 0) return undefined
  if (n <= 1) return n
  if (n <= 100) return n / 100
  return undefined
}

/**
 * Official provider win share. Null when the field is missing — do not fake
 * from score-share or projected-final CDF.
 */
export const providerChanceToWin = (mine?: number, opp?: number): ChanceToWin | null => {
  const my = asWinProbability(mine)
  const their = asWinProbability(opp)
  if (my == null && their == null) return null
  const a = my ?? (their != null ? 1 - their : undefined)
  const b = their ?? (my != null ? 1 - my : undefined)
  if (a == null || b == null) return null
  if (a === 0 && b === 0) return null
  return { mine: clampUnit(a), opp: clampUnit(b) }
}

export const chanceToWinPercents = (share: ChanceToWin): { mine: number; opp: number } => {
  const mine = Math.round(share.mine * 100)
  return { mine, opp: 100 - mine }
}

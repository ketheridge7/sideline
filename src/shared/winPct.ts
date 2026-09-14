/**
 * Matchup chance-to-win.
 *
 * ESPN SCOREBOARD mirrors official `schedule[].home.winProbability` /
 * `away.winProbability` on `mMatchupScore` (0–1). Compact `mLiveScoring`
 * omits it — leftover boxscore values are kept. Never replace ESPN with a CDF.
 *
 * Sleeper public `GET /league/{id}/matchups/{week}` has no win% field
 * (probed 2026 week 1). SCOREBOARD uses **Est. win%** from weekly projections
 * (`GET /projections/nfl/{season_type}/{season}/{week}` on api.sleeper.app)
 * plus live starter points (remaining-aware CDF). Missing projections stay
 * pending — do not fake score-share. If a published REST win% appears, treat
 * it as official the same way as ESPN.
 */

export type ChanceToWin = {
  mine: number
  opp: number
}

export type WinPctSource = 'official' | 'estimated'

export const WEEKLY_TEAM_STD = 24
export const TYPICAL_REMAINING = 120

const finiteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const liveOrZero = (value: unknown): number => finiteNumber(value) ?? 0

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

/** Φ(z) for a standard normal. Abramowitz & Stegun 26.2.17. */
export const normalCdf = (z: number): number => {
  if (!Number.isFinite(z)) return 0.5
  const abs = Math.abs(z)
  const t = 1 / (1 + 0.2316419 * abs)
  const d = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)
  const p =
    d *
    t *
    (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return z >= 0 ? 1 - p : p
}

export const remainingStd = (remaining: number): number => {
  if (!(remaining > 0)) return 0
  return WEEKLY_TEAM_STD * Math.sqrt(remaining / TYPICAL_REMAINING)
}

export const projectedFinal = (live: number, projected?: number): number => {
  const proj = finiteNumber(projected)
  if (proj == null) return live
  return Math.max(live, proj)
}

const fromLive = (mine: number, opp: number): ChanceToWin => {
  if (mine > opp) return { mine: 1, opp: 0 }
  if (mine < opp) return { mine: 0, opp: 1 }
  return { mine: 0.5, opp: 0.5 }
}

export const hasProjectedFinals = (myProjected?: number, oppProjected?: number): boolean => {
  const mine = finiteNumber(myProjected)
  const opp = finiteNumber(oppProjected)
  return mine != null && opp != null && (mine > 0 || opp > 0)
}

/**
 * Remaining-aware estimate from live scores + weekly projected team totals.
 * Projected final F = max(live, weekly projection). Null when projections
 * are missing — never score-share.
 */
export const estimatedChanceToWin = (opts: {
  myLive: number
  oppLive: number
  myProjected?: number
  oppProjected?: number
  scoresFinal?: boolean
}): ChanceToWin | null => {
  const myLive = liveOrZero(opts.myLive)
  const oppLive = liveOrZero(opts.oppLive)
  if (opts.scoresFinal) return fromLive(myLive, oppLive)
  if (!hasProjectedFinals(opts.myProjected, opts.oppProjected)) return null
  const myFinal = projectedFinal(myLive, opts.myProjected)
  const oppFinal = projectedFinal(oppLive, opts.oppProjected)
  const sigma = Math.hypot(remainingStd(Math.max(0, myFinal - myLive)), remainingStd(Math.max(0, oppFinal - oppLive)))
  if (!(sigma > 0.05)) return fromLive(myLive, oppLive)
  const mine = clampUnit(normalCdf((myFinal - oppFinal) / sigma))
  return { mine, opp: 1 - mine }
}

export const chanceToWinPercents = (share: ChanceToWin): { mine: number; opp: number } => {
  const mine = Math.round(share.mine * 100)
  return { mine, opp: 100 - mine }
}

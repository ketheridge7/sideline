/**
 * Matchup chance-to-win from live scores + projected finals.
 *
 * ESPN `totalProjectedPointsLive` is the live-updated projected **final**
 * (current points + remaining projection). It is never live scoring.
 *
 * Model (ESPN-bar shaped, remaining-aware):
 *   1. Projected final F = max(live, projectedTeamTotal)
 *   2. Remaining R = F − live
 *   3. Remaining noise ~ N(0, σ²) with
 *        σ = WEEKLY_TEAM_STD × √(R / TYPICAL_REMAINING)
 *      so a full remaining slate has ~weekly team-score error, and the
 *      bar snaps toward 100/0 as games finish.
 *   4. P(win) = Φ((F_mine − F_opp) / hypot(σ_mine, σ_opp))
 *
 * When remaining noise is ~0 or the matchup is official (`scoresFinal`),
 * the bar is 100 / 0 / 50 from live scores.
 * Without both projected finals (Sleeper today), return null — do not
 * fake a prediction from score-share.
 */

export const WEEKLY_TEAM_STD = 24
export const TYPICAL_REMAINING = 120

export type ChanceToWin = {
  mine: number
  opp: number
}

const finiteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const liveOrZero = (value: unknown): number => finiteNumber(value) ?? 0

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

const clampUnit = (value: number): number => Math.min(1, Math.max(0, value))

export const hasProjectedFinals = (myProjected?: number, oppProjected?: number): boolean => {
  const mine = finiteNumber(myProjected)
  const opp = finiteNumber(oppProjected)
  return mine != null && opp != null && (mine > 0 || opp > 0)
}

export const chanceToWin = (opts: {
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

export const SCORE_TICK_DELTA_MS = 1100
export const SCORE_TICK_SETTLE_MS = 1600

export type ScoreTickKind = 'up' | 'down'

export type ScoreTickChange = {
  delta: number
  kind: ScoreTickKind
  celebrate: boolean
}

export type ScoreTickPhase = 'idle' | 'delta' | 'settle'

export type ScoreTickActive = boolean | ScoreTickKind | null | undefined

const round1 = (value: number): number => Math.round(value * 10) / 10

const format1 = (value: number): string => round1(value).toFixed(1)

export const scoreTickChange = (
  prev: number | null | undefined,
  next: number | null | undefined
): ScoreTickChange | null => {
  if (typeof prev !== 'number' || typeof next !== 'number') return null
  if (!Number.isFinite(prev) || !Number.isFinite(next)) return null
  const delta = round1(round1(next) - round1(prev))
  if (delta === 0) return null
  const kind: ScoreTickKind = delta > 0 ? 'up' : 'down'
  return { delta, kind, celebrate: kind === 'up' }
}

export const scoreTickActive = (active: ScoreTickActive): boolean =>
  active === true || active === 'up' || active === 'down'

export const scoreTickPhase = (elapsedMs: number, active: ScoreTickActive): ScoreTickPhase => {
  if (!scoreTickActive(active) || elapsedMs < 0) return 'idle'
  if (elapsedMs < SCORE_TICK_DELTA_MS) return 'delta'
  if (elapsedMs < SCORE_TICK_SETTLE_MS) return 'settle'
  return 'idle'
}

export const scoreTickLabel = (phase: ScoreTickPhase, value: number, delta: number): string => {
  if (phase === 'delta') {
    const abs = format1(Math.abs(delta))
    return delta >= 0 ? `+${abs}` : `-${abs}`
  }
  return format1(value)
}

const flashT = (elapsedMs: number, active: ScoreTickActive): number => {
  const phase = scoreTickPhase(elapsedMs, active)
  switch (phase) {
    case 'delta':
      return 1
    case 'settle': {
      const span = SCORE_TICK_SETTLE_MS - SCORE_TICK_DELTA_MS
      return Math.max(0, 1 - (elapsedMs - SCORE_TICK_DELTA_MS + 1) / (span + 1))
    }
    case 'idle':
      return 0
    default: {
      const _never: never = phase
      return _never
    }
  }
}

export const scoreTickLimeT = (elapsedMs: number, active: ScoreTickActive): number => {
  const up = active === true || active === 'up'
  return flashT(elapsedMs, up)
}

export const scoreTickRedT = (elapsedMs: number, active: ScoreTickActive): number => {
  return flashT(elapsedMs, active === 'down')
}

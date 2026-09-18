import type { Player } from '@shared/types'

export const BENCH_ROW_HEIGHT_PX = 44
export const BENCH_VISIBLE_ROW_CAP = 5
export const BENCH_COLUMN_BODY_FRACTION = 0.48
export const BENCH_FOOT_HEIGHT_PX = 40
export const BENCH_HAIRLINE_PX = 2
export const BENCH_OPEN_MS = 200
export const BENCH_CLOSE_MS = 160

export type BenchSide = 'mine' | 'opp'

export type BenchFootCopy =
  | { kind: 'count'; count: number }
  | { kind: 'empty' }
  | { kind: 'missing' }

export type BenchOpenState = { mine: boolean; opp: boolean }

export type BenchDismissAction =
  | { type: 'toggle'; side: BenchSide; allowed: boolean }
  | { type: 'esc'; lastFocused: BenchSide }
  | { type: 'outside'; side: BenchSide }

export const benchFootCopy = (count: number, missing = false): BenchFootCopy => {
  if (missing) return { kind: 'missing' }
  if (count <= 0) return { kind: 'empty' }
  return { kind: 'count', count }
}

export const canOpenBench = (copy: BenchFootCopy): boolean => copy.kind === 'count' && copy.count > 0

const hasLetter = /[A-Za-z]/

export const isDisplayableBenchPlayer = (player: Player): boolean => {
  const name = player.name.trim()
  if (!name || !hasLetter.test(name)) return false
  if (name === player.playerId) return false
  if (/^\d+$/.test(name)) return false
  return true
}

export const displayableBenchPlayers = (players: Player[]): Player[] =>
  players.filter(isDisplayableBenchPlayer)

export const lineupPositionLabel = (position: string | undefined): string => {
  const pos = position?.trim() ?? ''
  if (!pos || pos === '?') return '—'
  return pos
}

export const benchPopoverMaxHeightPx = (columnBodyHeightPx: number): number => {
  const rowCap = BENCH_ROW_HEIGHT_PX * BENCH_VISIBLE_ROW_CAP
  if (columnBodyHeightPx <= 0) return rowCap
  return Math.min(rowCap, columnBodyHeightPx * BENCH_COLUMN_BODY_FRACTION)
}

export const applyBenchDismiss = (state: BenchOpenState, action: BenchDismissAction): BenchOpenState => {
  switch (action.type) {
    case 'toggle':
      if (!action.allowed) return state
      return { ...state, [action.side]: !state[action.side] }
    case 'esc': {
      if (state[action.lastFocused]) return { ...state, [action.lastFocused]: false }
      if (state.mine) return { ...state, mine: false }
      if (state.opp) return { ...state, opp: false }
      return state
    }
    case 'outside':
      return { ...state, [action.side]: false }
    default: {
      const _never: never = action
      return _never
    }
  }
}

export const prefersBenchReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

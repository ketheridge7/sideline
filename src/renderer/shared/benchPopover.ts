import type { Player } from '@shared/types'

export const BENCH_FOOT_HEIGHT_PX = 40
export const BENCH_HAIRLINE_PX = 2
export const BENCH_OPEN_MS = 200
export const BENCH_CLOSE_MS = 160
/** Same gutters as starter lineup rows (`BoardRosterColumn`). */
export const BOARD_ROSTER_PAD_X = 'px-5'
export const BOARD_ROSTER_PAD_Y = 'py-3'
/** Opaque companion card fill — `--color-card`, never a translucent wash. */
export const BENCH_CARD_FILL = '#101216'
/** Opaque page fill behind the rounded card so column corners cannot leak starters. */
export const BENCH_PAGE_FILL = '#07080a'

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

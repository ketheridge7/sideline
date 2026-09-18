import { describe, expect, it } from 'vitest'
import type { Player } from '@shared/types'
import {
  applyBenchDismiss,
  BENCH_CLOSE_MS,
  BENCH_FOOT_HEIGHT_PX,
  BENCH_HAIRLINE_PX,
  BENCH_OPEN_MS,
  BENCH_ROW_HEIGHT_PX,
  BENCH_VISIBLE_ROW_CAP,
  benchFootCopy,
  benchPopoverMaxHeightPx,
  canOpenBench,
  displayableBenchPlayers,
  isDisplayableBenchPlayer,
  lineupPositionLabel
} from './benchPopover'

const closed = { mine: false, opp: false }

const player = (row: Partial<Player> & Pick<Player, 'playerId' | 'name' | 'position'>): Player => ({
  nflTeam: 'SF',
  ...row
})

describe('benchFootCopy', () => {
  it('labels count, empty, and missing opponent benches', () => {
    expect(benchFootCopy(6)).toEqual({ kind: 'count', count: 6 })
    expect(benchFootCopy(0)).toEqual({ kind: 'empty' })
    expect(benchFootCopy(4, true)).toEqual({ kind: 'missing' })
    expect(canOpenBench(benchFootCopy(6))).toBe(true)
    expect(canOpenBench(benchFootCopy(0))).toBe(false)
    expect(canOpenBench(benchFootCopy(3, true))).toBe(false)
  })
})

describe('benchPopoverMaxHeightPx', () => {
  it('caps at five rows, then 48% of the column body', () => {
    const fiveRows = BENCH_ROW_HEIGHT_PX * BENCH_VISIBLE_ROW_CAP
    expect(fiveRows).toBe(220)
    expect(benchPopoverMaxHeightPx(0)).toBe(fiveRows)
    expect(benchPopoverMaxHeightPx(1000)).toBe(fiveRows)
    expect(benchPopoverMaxHeightPx(400)).toBe(192)
  })
})

describe('applyBenchDismiss', () => {
  it('toggles only the requested side when the bench can open', () => {
    const mineOpen = applyBenchDismiss(closed, { type: 'toggle', side: 'mine', allowed: true })
    expect(mineOpen).toEqual({ mine: true, opp: false })
    const both = applyBenchDismiss(mineOpen, { type: 'toggle', side: 'opp', allowed: true })
    expect(both).toEqual({ mine: true, opp: true })
    expect(applyBenchDismiss(both, { type: 'toggle', side: 'mine', allowed: true })).toEqual({
      mine: false,
      opp: true
    })
  })

  it('does not open an empty or missing bench', () => {
    expect(applyBenchDismiss(closed, { type: 'toggle', side: 'mine', allowed: false })).toEqual(closed)
    expect(applyBenchDismiss(closed, { type: 'toggle', side: 'opp', allowed: false })).toEqual(closed)
  })

  it('closes the last-focused column on Esc without linking the other side', () => {
    const both = { mine: true, opp: true }
    expect(applyBenchDismiss(both, { type: 'esc', lastFocused: 'mine' })).toEqual({
      mine: false,
      opp: true
    })
    expect(applyBenchDismiss(both, { type: 'esc', lastFocused: 'opp' })).toEqual({
      mine: true,
      opp: false
    })
    expect(applyBenchDismiss({ mine: false, opp: true }, { type: 'esc', lastFocused: 'mine' })).toEqual({
      mine: false,
      opp: false
    })
  })

  it('closes only the column that received an outside click', () => {
    const both = { mine: true, opp: true }
    expect(applyBenchDismiss(both, { type: 'outside', side: 'mine' })).toEqual({
      mine: false,
      opp: true
    })
    expect(applyBenchDismiss(both, { type: 'outside', side: 'opp' })).toEqual({
      mine: true,
      opp: false
    })
  })
})

describe('open-unit geometry', () => {
  it('keeps the 40px foot and stacks the card above it with a 2px hairline', () => {
    expect(BENCH_FOOT_HEIGHT_PX).toBe(40)
    expect(BENCH_HAIRLINE_PX).toBe(2)
    expect(BENCH_OPEN_MS).toBe(200)
    expect(BENCH_CLOSE_MS).toBe(160)
  })
})

describe('displayable bench rows', () => {
  it('keeps named POS|NAME|PTS rows and drops ? placeholders and raw ids', () => {
    const kittle = player({ playerId: 'bn', name: 'George Kittle', position: 'TE', points: 4.2 })
    const question = player({ playerId: '4034', name: '4034', position: '?', nflTeam: '' })
    const idName = player({ playerId: '8137', name: '8137', position: 'WR', nflTeam: 'KC' })
    const sameId = player({ playerId: 'abc', name: 'abc', position: '?', nflTeam: '' })
    expect(isDisplayableBenchPlayer(kittle)).toBe(true)
    expect(isDisplayableBenchPlayer(question)).toBe(false)
    expect(isDisplayableBenchPlayer(idName)).toBe(false)
    expect(isDisplayableBenchPlayer(sameId)).toBe(false)
    expect(displayableBenchPlayers([kittle, question, idName, sameId])).toEqual([kittle])
    expect(lineupPositionLabel('TE')).toBe('TE')
    expect(lineupPositionLabel('?')).toBe('—')
    expect(lineupPositionLabel('')).toBe('—')
    expect(lineupPositionLabel(undefined)).toBe('—')
  })
})

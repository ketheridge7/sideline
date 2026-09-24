import { describe, expect, it } from 'vitest'
import { applyPreset, hudGroupBox, layoutFromPreset, overwritePreset, setHudGroupBox } from './overlayLayout'
import {
  applyStudioSlider,
  idsForStudioBlock,
  setStudioBlockBox,
  studioBlockBox,
  STUDIO_BLOCK_IDS
} from './overlayStudioBlocks'

const widget = (presetId: '1' | '2' | '3' | '4' | '5', id: string) =>
  layoutFromPreset(presetId).widgets.find((row) => row.id === id)

describe('studioBlockBox', () => {
  it('groups name, score, and player rows into one team frame', () => {
    const layout = layoutFromPreset('1')
    const mine = studioBlockBox(layout, 'mine')
    const name = widget('1', 'team.mine.name')
    const rail = widget('1', 'col.mine.name')
    expect(mine.x).toBe(name?.x)
    expect(mine.y).toBe(name?.y)
    expect(mine.x + mine.w).toBeCloseTo((rail?.x ?? 0) + (rail?.w ?? 0), 5)
    expect(mine.y + mine.h).toBeCloseTo((rail?.y ?? 0) + (rail?.h ?? 0), 5)
    expect(idsForStudioBlock('mine')).toContain('col.mine.name')
    expect(idsForStudioBlock('mine')).toContain('score.mine')
    expect(idsForStudioBlock('opp')).toContain('col.opp.name')
    expect(idsForStudioBlock('ticker')).toEqual(['ticker.nfl'])
  })

  it('keeps the ticker as its own block at the bottom', () => {
    const layout = layoutFromPreset('1')
    const ticker = studioBlockBox(layout, 'ticker')
    expect(ticker.y).toBeGreaterThan(90)
    expect(ticker.h).toBeGreaterThanOrEqual(8)
    expect(ticker.w).toBe(100)
    expect(widget('1', 'ticker.nfl')?.hidden).toBe(false)
  })
})

describe('setStudioBlockBox', () => {
  it('moves only the selected team frame', () => {
    const layout = layoutFromPreset('1')
    const mine = studioBlockBox(layout, 'mine')
    const opp = studioBlockBox(layout, 'opp')
    const ticker = studioBlockBox(layout, 'ticker')
    const moved = setStudioBlockBox(layout, 'mine', { ...mine, x: mine.x + 4, y: mine.y + 3 })
    const nextMine = studioBlockBox(moved, 'mine')
    expect(nextMine.x).toBeCloseTo(mine.x + 4, 5)
    expect(nextMine.y).toBeCloseTo(mine.y + 3, 5)
    expect(studioBlockBox(moved, 'opp')).toEqual(opp)
    expect(studioBlockBox(moved, 'ticker')).toEqual(ticker)
    expect(moved.widgets.find((row) => row.id === 'col.opp.name')?.x).toBe(
      layout.widgets.find((row) => row.id === 'col.opp.name')?.x
    )
  })

  it('routes sliders to the selected block only', () => {
    const layout = layoutFromPreset('2')
    const opp = studioBlockBox(layout, 'opp')
    const ticker = studioBlockBox(layout, 'ticker')
    const none = applyStudioSlider(layout, null, { x: 40 })
    expect(none).toBe(layout)
    const shifted = applyStudioSlider(layout, 'opp', { y: opp.y + 5 })
    expect(studioBlockBox(shifted, 'opp').y).toBeCloseTo(opp.y + 5, 5)
    expect(studioBlockBox(shifted, 'mine')).toEqual(studioBlockBox(layout, 'mine'))
    expect(studioBlockBox(shifted, 'ticker')).toEqual(ticker)
    const tickerMoved = applyStudioSlider(shifted, 'ticker', { y: 88 })
    expect(studioBlockBox(tickerMoved, 'ticker').y).toBeCloseTo(88, 5)
    expect(studioBlockBox(tickerMoved, 'opp').y).toBeCloseTo(opp.y + 5, 5)
  })

  it('does not scale the whole HUD group when a block is targeted', () => {
    const layout = layoutFromPreset('1')
    const group = hudGroupBox(layout)
    const mine = studioBlockBox(layout, 'mine')
    const next = applyStudioSlider(layout, 'mine', { x: mine.x + 6 })
    const whole = setHudGroupBox(layout, { ...group, x: group.x + 6 })
    expect(studioBlockBox(next, 'opp').x).toBe(studioBlockBox(layout, 'opp').x)
    expect(studioBlockBox(whole, 'opp').x).not.toBe(studioBlockBox(layout, 'opp').x)
  })
})

describe('studio blocks survive save-over', () => {
  it('restores a moved team frame when the preset is re-applied', () => {
    const base = layoutFromPreset('3')
    const mine = studioBlockBox(base, 'mine')
    const shifted = applyStudioSlider(base, 'mine', { x: mine.x + 5, y: mine.y + 4 })
    const saved = overwritePreset(shifted, '3')
    const other = applyPreset('1', saved)
    expect(studioBlockBox(other, 'mine').x).not.toBeCloseTo(studioBlockBox(shifted, 'mine').x, 1)
    const restored = applyPreset('3', other)
    expect(restored.presetId).toBe('3')
    expect(studioBlockBox(restored, 'mine').x).toBeCloseTo(studioBlockBox(shifted, 'mine').x, 5)
    expect(studioBlockBox(restored, 'mine').y).toBeCloseTo(studioBlockBox(shifted, 'mine').y, 5)
  })

  it('exposes every studio block on every canned preset', () => {
    for (const preset of ['1', '2', '3', '4', '5'] as const) {
      const layout = layoutFromPreset(preset)
      for (const id of STUDIO_BLOCK_IDS) {
        const box = studioBlockBox(layout, id)
        expect(box.w).toBeGreaterThan(1)
        expect(box.h).toBeGreaterThan(1)
      }
    }
  })
})

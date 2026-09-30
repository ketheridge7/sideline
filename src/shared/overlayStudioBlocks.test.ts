import { describe, expect, it } from 'vitest'
import { applyPreset, hudGroupBox, layoutFromPreset, overwritePreset, setHudGroupBox } from './overlayLayout'
import {
  applyStudioSlider,
  displayWidgets,
  hudPlateBoxes,
  idsForStudioBlock,
  mirrorStudioBlock,
  nudgeStudioBlock,
  otherTeamBlock,
  resetStudioBlock,
  setStudioBlockBox,
  studioBlockBox,
  translateStudioBlock,
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
    expect(mine.y).toBeLessThanOrEqual(name?.y ?? 0)
    expect((name?.y ?? 0) + (name?.h ?? 0)).toBeLessThanOrEqual(mine.y + mine.h)
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
    expect(ticker.h).toBeGreaterThanOrEqual(4)
    expect(ticker.h).toBeLessThan(6)
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

describe('studio block moves', () => {
  it('translates without resizing and stops at the canvas edge', () => {
    const layout = layoutFromPreset('1')
    const from = studioBlockBox(layout, 'mine')
    const moved = studioBlockBox(translateStudioBlock(layout, 'mine', from, 10, 5), 'mine')
    expect(moved.x).toBeCloseTo(from.x + 10, 1)
    expect(moved.y).toBeCloseTo(from.y + 5, 1)
    expect(moved.w).toBeCloseTo(from.w, 1)
    const pinned = studioBlockBox(translateStudioBlock(layout, 'mine', from, 500, -500), 'mine')
    expect(pinned.x + pinned.w).toBeCloseTo(100, 1)
    expect(pinned.y).toBeCloseTo(0, 1)
    expect(pinned.w).toBeCloseTo(from.w, 1)
  })

  it('nudges from the current box', () => {
    const layout = layoutFromPreset('1')
    const from = studioBlockBox(layout, 'opp')
    const next = studioBlockBox(nudgeStudioBlock(layout, 'opp', -5, 1), 'opp')
    expect(next.x).toBeCloseTo(from.x - 5, 1)
    expect(next.y).toBeCloseTo(from.y + 1, 1)
  })

  it('mirrors one team onto the other across the center line', () => {
    const layout = layoutFromPreset('1')
    const mine = studioBlockBox(layout, 'mine')
    const mirrored = studioBlockBox(mirrorStudioBlock(layout, 'mine'), 'opp')
    expect(mirrored.x).toBeCloseTo(100 - mine.x - mine.w, 1)
    expect(mirrored.y).toBeCloseTo(mine.y, 1)
    expect(mirrored.w).toBeCloseTo(mine.w, 1)
    expect(mirrorStudioBlock(layout, 'ticker')).toBe(layout)
    expect(otherTeamBlock('opp')).toBe('mine')
    expect(otherTeamBlock('ticker')).toBeNull()
  })

  it('resets one block to the baseline and leaves the others alone', () => {
    const layout = layoutFromPreset('1')
    const moved = nudgeStudioBlock(nudgeStudioBlock(layout, 'mine', 10, 10), 'opp', -10, 0)
    const reset = resetStudioBlock(moved, 'mine', layout.widgets)
    expect(studioBlockBox(reset, 'mine')).toEqual(studioBlockBox(layout, 'mine'))
    expect(studioBlockBox(reset, 'opp')).toEqual(studioBlockBox(moved, 'opp'))
  })
})

describe('display toggles', () => {
  const hidden = (layout: ReturnType<typeof layoutFromPreset>, id: string) =>
    displayWidgets(layout).find((row) => row.id === id)?.hidden

  it('passes widgets through when everything is on', () => {
    const layout = layoutFromPreset('1')
    expect(displayWidgets(layout)).toBe(layout.widgets)
  })

  it('hides the ticker, lead chip, and name rails on request', () => {
    const layout = layoutFromPreset('1')
    const off = { ...layout, display: { ...layout.display, ticker: false, lead: false, rails: false } }
    expect(hidden(off, 'ticker.nfl')).toBe(true)
    expect(hidden(off, 'score.delta')).toBe(true)
    expect(hidden(off, 'col.mine.name')).toBe(true)
    expect(hidden(off, 'col.opp.name')).toBe(true)
    expect(hidden(off, 'team.mine.name')).toBe(false)
    expect(off.widgets.find((row) => row.id === 'ticker.nfl')?.hidden).toBe(hidden(layout, 'ticker.nfl'))
  })
})

describe('hudPlateBoxes', () => {
  it('backs each team frame with a padded plate', () => {
    const layout = layoutFromPreset('1')
    const plates = hudPlateBoxes(layout)
    expect(plates.map((row) => row.side)).toEqual(['mine', 'opp'])
    for (const plate of plates) {
      const frame = studioBlockBox(layout, plate.side)
      expect(plate.box.x).toBeLessThanOrEqual(frame.x)
      expect(plate.box.x + plate.box.w).toBeGreaterThanOrEqual(frame.x + frame.w - 0.01)
      expect(plate.box.x).toBeGreaterThanOrEqual(0)
      expect(plate.box.y + plate.box.h).toBeLessThanOrEqual(100)
    }
  })

  it('shrinks when rails are hidden', () => {
    const layout = layoutFromPreset('1')
    const full = hudPlateBoxes(layout)[0].box
    const bare = hudPlateBoxes({ ...layout, display: { ...layout.display, rails: false } })[0].box
    expect(bare.w * bare.h).toBeLessThanOrEqual(full.w * full.h)
  })
})

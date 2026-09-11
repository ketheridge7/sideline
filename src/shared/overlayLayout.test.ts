import { describe, expect, it } from 'vitest'
import {
  applyPreset,
  coalesceRailColumns,
  coversLiveVideo,
  dragIdsFor,
  hudGroupBox,
  layoutFromPreset,
  overwritePreset,
  parseOverlayLayout,
  parsePresetId,
  patchWidget,
  presetShowsCrawler,
  setHudGroupBox,
  translateWidgets,
  OVERLAY_PRESET_IDS,
  OVERLAY_WIDGET_IDS,
  PRESET_LABELS,
  PRESET_PLACEMENTS
} from './overlayLayout'

const visible = (presetId: (typeof OVERLAY_PRESET_IDS)[number]) =>
  layoutFromPreset(presetId).widgets.filter((row) => !row.hidden)

const HIDDEN_EVERYWHERE = [
  'bench.mine',
  'bench.opp',
  'col.mine.nfl',
  'col.opp.nfl',
  'col.mine.pos',
  'col.opp.pos',
  'col.mine.pts',
  'col.opp.pts',
  'meta.league',
  'meta.week',
  'toast.slot'
] as const

const widget = (presetId: (typeof OVERLAY_PRESET_IDS)[number], id: string) =>
  layoutFromPreset(presetId).widgets.find((row) => row.id === id)

describe('layoutFromPreset', () => {
  it('includes every widget id in every preset and hides split rail columns', () => {
    expect(OVERLAY_PRESET_IDS).toEqual(['1', '2', '3', '4', '5'])
    for (const id of OVERLAY_PRESET_IDS) {
      const layout = layoutFromPreset(id)
      expect(layout.widgets.map((row) => row.id).sort()).toEqual([...OVERLAY_WIDGET_IDS].sort())
      expect(layout.showCrawler).toBe(presetShowsCrawler(id))
      expect(layout.showCrawler).toBe(false)
      expect(PRESET_LABELS[id].startsWith('Preset ')).toBe(true)
      expect(PRESET_PLACEMENTS[id].length).toBeGreaterThan(0)
      for (const hiddenId of HIDDEN_EVERYWHERE) {
        expect(layout.widgets.find((row) => row.id === hiddenId)?.hidden).toBe(true)
      }
      expect(layout.widgets.find((row) => row.id === 'col.mine.name')?.hidden).toBe(false)
      expect(layout.widgets.find((row) => row.id === 'col.opp.name')?.hidden).toBe(false)
    }
  })

  it('keeps you left / them right frost rails in every placement', () => {
    for (const id of OVERLAY_PRESET_IDS) {
      const mine = widget(id, 'col.mine.name')
      const opp = widget(id, 'col.opp.name')
      expect(mine?.x).toBeLessThan(opp?.x ?? 0)
      expect(widget(id, 'team.mine.name')?.x).toBeLessThan(widget(id, 'team.opp.name')?.x ?? 0)
      expect(visible(id).every((row) => row.opacity === 0)).toBe(true)
      expect(mine?.w).toBeGreaterThanOrEqual(15)
      expect(mine?.hidden).toBe(false)
    }
  })

  it('Preset 1 sits on the far sides', () => {
    expect(widget('1', 'col.mine.name')?.x).toBeLessThan(8)
    expect(widget('1', 'col.opp.name')?.x).toBeGreaterThanOrEqual(80)
    expect(widget('1', 'col.mine.name')?.y).toBe(widget('1', 'col.opp.name')?.y)
  })

  it('Preset 2 tucks both rails into the upper corners', () => {
    expect(widget('2', 'team.mine.name')?.y).toBeLessThan(8)
    expect(widget('2', 'col.mine.name')?.h ?? 99).toBeLessThan(widget('1', 'col.mine.name')?.h ?? 0)
    expect(widget('2', 'col.opp.name')?.x).toBeGreaterThanOrEqual(80)
  })

  it('Preset 3 tucks both rails into the lower corners', () => {
    expect(widget('3', 'team.mine.name')?.y).toBeGreaterThan(40)
    expect(widget('3', 'col.mine.name')?.y).toBeGreaterThan(50)
    expect(widget('3', 'col.opp.name')?.x).toBeGreaterThanOrEqual(80)
  })

  it('Preset 4 insets the side rails from the far edges', () => {
    expect(widget('4', 'col.mine.name')?.x).toBeGreaterThan(widget('1', 'col.mine.name')?.x ?? 0)
    expect(widget('4', 'col.opp.name')?.x).toBeLessThan(widget('1', 'col.opp.name')?.x ?? 100)
    expect(widget('4', 'col.mine.name')?.w ?? 99).toBeLessThan(widget('1', 'col.mine.name')?.w ?? 0)
  })

  it('Preset 5 offsets the side bands so them sits lower than you', () => {
    expect(widget('5', 'col.mine.name')?.y ?? 99).toBeLessThan(widget('5', 'col.opp.name')?.y ?? 0)
    expect(widget('5', 'col.mine.name')?.x).toBeLessThan(8)
    expect(widget('5', 'col.opp.name')?.x).toBeGreaterThanOrEqual(80)
  })

  it('selecting a different preset actually moves the live rails', () => {
    const one = applyPreset('1')
    const two = applyPreset('2', one)
    const three = applyPreset('3', two)
    expect(two.presetId).toBe('2')
    expect(three.presetId).toBe('3')
    expect(widget('2', 'col.mine.name')?.y).not.toBe(widget('1', 'col.mine.name')?.y)
    expect(widget('3', 'col.mine.name')?.y).not.toBe(widget('2', 'col.mine.name')?.y)
    expect(two.widgets.find((row) => row.id === 'col.mine.name')?.y).toBe(widget('2', 'col.mine.name')?.y)
    expect(three.widgets.find((row) => row.id === 'col.mine.name')?.y).toBe(widget('3', 'col.mine.name')?.y)
  })

  it('no canned preset covers the live video rectangle', () => {
    for (const id of OVERLAY_PRESET_IDS) {
      expect(layoutFromPreset(id).widgets.filter(coversLiveVideo).map((row) => row.id)).toEqual([])
    }
  })
})

describe('parseOverlayLayout', () => {
  it('falls back to Preset 1 for garbage and migrates old names', () => {
    expect(parseOverlayLayout(null).presetId).toBe('1')
    expect(parsePresetId('national')).toBe('1')
    expect(parsePresetId('broadcast-l')).toBe('1')
    expect(parsePresetId('redzone')).toBe('5')
    expect(parsePresetId('corners')).toBe('2')
    expect(parseOverlayLayout({ presetId: 'broadcast-l' }).presetId).toBe('1')
    expect(parseOverlayLayout('nope').widgets).toHaveLength(OVERLAY_WIDGET_IDS.length)
  })

  it('coalesces split pos/name/pts columns into one aligned rail widget', () => {
    const parsed = parseOverlayLayout({
      presetId: 'national',
      widgets: [
        { id: 'col.mine.pos', x: 1.2, y: 23.2, w: 2.8, h: 58, hidden: false },
        { id: 'col.mine.name', x: 4, y: 23.2, w: 11, h: 58, hidden: false },
        { id: 'col.mine.pts', x: 15, y: 23.2, w: 4.2, h: 58, hidden: false }
      ]
    })
    const name = parsed.widgets.find((row) => row.id === 'col.mine.name')
    expect(name?.hidden).toBe(false)
    expect(name?.x).toBe(1.2)
    expect(name?.w).toBeCloseTo(18)
    expect(parsed.widgets.find((row) => row.id === 'col.mine.pos')?.hidden).toBe(true)
    expect(parsed.widgets.find((row) => row.id === 'col.mine.pts')?.hidden).toBe(true)
  })

  it('merges saved widget positions onto the named preset', () => {
    const parsed = parseOverlayLayout({
      presetId: '2',
      widgets: [{ id: 'score.mine', x: 10, y: 10, w: 20, h: 12 }]
    })
    expect(parsed.presetId).toBe('2')
    expect(parsed.widgets.find((row) => row.id === 'score.mine')?.x).toBe(10)
    expect(parsed.widgets.find((row) => row.id === 'score.opp')?.x).toBe(81.2)
  })

  it('clamps out-of-range geometry and allows a fully transparent fill', () => {
    const parsed = parseOverlayLayout({
      widgets: [{ id: 'score.delta', x: -4, y: 200, w: 0, h: 999, opacity: 2 }]
    })
    const delta = parsed.widgets.find((row) => row.id === 'score.delta')
    expect(delta?.x).toBe(0)
    expect(delta?.y).toBe(100)
    expect(delta?.w).toBe(1)
    expect(delta?.opacity).toBe(0.85)
    const clear = parseOverlayLayout({
      widgets: [{ id: 'score.mine', opacity: -1 }]
    })
    expect(clear.widgets.find((row) => row.id === 'score.mine')?.opacity).toBe(0)
  })
})

describe('layout edits', () => {
  it('keeps the selected preset id when a widget is patched', () => {
    const next = patchWidget(layoutFromPreset('3'), 'score.mine', { hidden: true })
    expect(next.presetId).toBe('3')
    expect(next.widgets.find((row) => row.id === 'score.mine')?.hidden).toBe(true)
  })

  it('moves the visible rail column', () => {
    const layout = layoutFromPreset('1')
    const ids = dragIdsFor(layout, 'col.mine.name')
    expect(ids).toContain('col.mine.name')
    expect(ids).not.toContain('col.mine.pos')
    expect(ids).not.toContain('col.mine.pts')
    const name = layout.widgets.find((row) => row.id === 'col.mine.name')
    const moved = translateWidgets(layout, ids, 1, 0)
    expect(moved.widgets.find((row) => row.id === 'col.mine.name')?.x).toBe((name?.x ?? 0) + 1)
  })

  it('overwrites a preset slot and reapplies it onto the live HUD', () => {
    const base = layoutFromPreset('1')
    const shifted = setHudGroupBox(base, { ...hudGroupBox(base), y: 18 })
    const saved = overwritePreset(shifted, '1')
    expect(saved.slots['1']).toBeTruthy()
    const other = applyPreset('4', saved)
    expect(other.presetId).toBe('4')
    expect(other.widgets.find((row) => row.id === 'col.mine.name')?.y).toBe(widget('4', 'col.mine.name')?.y)
    const restored = applyPreset('1', other)
    expect(restored.presetId).toBe('1')
    expect(restored.widgets.find((row) => row.id === 'team.mine.name')?.y).toBe(
      saved.widgets.find((row) => row.id === 'team.mine.name')?.y
    )
  })

  it('scales the HUD group from position and size sliders', () => {
    const layout = layoutFromPreset('1')
    const origin = hudGroupBox(layout)
    const next = setHudGroupBox(layout, { ...origin, x: origin.x + 2, y: origin.y + 3 })
    const box = hudGroupBox(next)
    expect(box.x).toBeCloseTo(origin.x + 2, 5)
    expect(box.y).toBeCloseTo(origin.y + 3, 5)
    expect(next.presetId).toBe('1')
  })
})

describe('coalesceRailColumns', () => {
  it('never leaves live points in a separate overlapping column', () => {
    const split = layoutFromPreset('1').widgets.map((row) => {
      if (row.id === 'col.mine.pos') return { ...row, hidden: false, x: 1, w: 3 }
      if (row.id === 'col.mine.name') return { ...row, hidden: false, x: 4, w: 10 }
      if (row.id === 'col.mine.pts') return { ...row, hidden: false, x: 14, w: 5 }
      return row
    })
    const next = coalesceRailColumns(split)
    expect(next.find((row) => row.id === 'col.mine.pos')?.hidden).toBe(true)
    expect(next.find((row) => row.id === 'col.mine.pts')?.hidden).toBe(true)
    expect(next.find((row) => row.id === 'col.mine.name')?.x).toBe(1)
    expect(next.find((row) => row.id === 'col.mine.name')?.w).toBe(18)
  })
})

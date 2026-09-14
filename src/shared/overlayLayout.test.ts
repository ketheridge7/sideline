import { describe, expect, it } from 'vitest'
import {
  applyPreset,
  coalesceRailColumns,
  coversLiveVideo,
  dragIdsFor,
  hudGroupBox,
  layoutFromPreset,
  overlayLayoutDidMigrate,
  overwritePreset,
  parseOverlayLayout,
  parsePresetId,
  patchWidget,
  presetShowsCrawler,
  setHudGroupBox,
  translateWidgets,
  OVERLAY_LAYOUT_SCHEMA_VERSION,
  OVERLAY_PRESET_IDS,
  OVERLAY_WIDGET_IDS,
  PRESET_HINTS,
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
      expect(PRESET_HINTS[id].length).toBeGreaterThan(0)
      expect(layout.widgets.find((row) => row.id === 'ticker.nfl')?.hidden).toBe(false)
      for (const hiddenId of HIDDEN_EVERYWHERE) {
        expect(layout.widgets.find((row) => row.id === hiddenId)?.hidden).toBe(true)
      }
      expect(layout.widgets.find((row) => row.id === 'col.mine.name')?.hidden).toBe(false)
      expect(layout.widgets.find((row) => row.id === 'col.opp.name')?.hidden).toBe(false)
      expect(layout.schemaVersion).toBe(OVERLAY_LAYOUT_SCHEMA_VERSION)
    }
  })

  it('keeps you left / them right frost rails except the same-side stack', () => {
    for (const id of OVERLAY_PRESET_IDS) {
      if (id === '4') continue
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

  it('Preset 4 stacks both team frames on the same side', () => {
    const mine = widget('4', 'col.mine.name')
    const opp = widget('4', 'col.opp.name')
    expect(mine?.x).toBe(opp?.x)
    expect(widget('4', 'team.mine.name')?.x).toBe(widget('4', 'team.opp.name')?.x)
    expect((mine?.y ?? 0) + (mine?.h ?? 0)).toBeLessThan(widget('4', 'team.opp.name')?.y ?? 0)
    expect((mine?.x ?? 0) + (mine?.w ?? 0)).toBeLessThanOrEqual(22)
    expect(PRESET_PLACEMENTS['4']).toBe('Same-side stack')
    expect(PRESET_HINTS['4']).toMatch(/same side/i)
    expect(PRESET_HINTS['4']).toMatch(/stacked/i)
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
    const four = applyPreset('4', three)
    expect(two.presetId).toBe('2')
    expect(three.presetId).toBe('3')
    expect(four.presetId).toBe('4')
    expect(widget('2', 'col.mine.name')?.y).not.toBe(widget('1', 'col.mine.name')?.y)
    expect(widget('3', 'col.mine.name')?.y).not.toBe(widget('2', 'col.mine.name')?.y)
    expect(two.widgets.find((row) => row.id === 'col.mine.name')?.y).toBe(widget('2', 'col.mine.name')?.y)
    expect(three.widgets.find((row) => row.id === 'col.mine.name')?.y).toBe(widget('3', 'col.mine.name')?.y)
    expect(four.widgets.find((row) => row.id === 'col.mine.name')?.x).toBe(
      four.widgets.find((row) => row.id === 'col.opp.name')?.x
    )
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
    expect(parseOverlayLayout(null).schemaVersion).toBe(OVERLAY_LAYOUT_SCHEMA_VERSION)
    expect(parsePresetId('national')).toBe('1')
    expect(parsePresetId('broadcast-l')).toBe('1')
    expect(parsePresetId('redzone')).toBe('5')
    expect(parsePresetId('corners')).toBe('2')
    expect(parsePresetId(4)).toBe('4')
    expect(parsePresetId('4')).toBe('4')
    expect(parseOverlayLayout({ presetId: 'broadcast-l' }).presetId).toBe('1')
    expect(parseOverlayLayout('nope').widgets).toHaveLength(OVERLAY_WIDGET_IDS.length)
  })

  it('resets stale freeform widget maps to Preset 1 without merging old geometry', () => {
    const factory = layoutFromPreset('1')
    const parsed = parseOverlayLayout({
      presetId: '2',
      widgets: [
        { id: 'score.mine', x: 40, y: 40, w: 20, h: 12 },
        { id: 'col.mine.name', x: 50, y: 10, w: 8, h: 20, hidden: false }
      ]
    })
    expect(overlayLayoutDidMigrate({ presetId: '2', widgets: [] })).toBe(true)
    expect(parsed.schemaVersion).toBe(OVERLAY_LAYOUT_SCHEMA_VERSION)
    expect(parsed.presetId).toBe('1')
    expect(parsed.widgets.find((row) => row.id === 'score.mine')?.x).toBe(
      factory.widgets.find((row) => row.id === 'score.mine')?.x
    )
    expect(parsed.widgets.find((row) => row.id === 'col.mine.name')?.x).toBe(
      factory.widgets.find((row) => row.id === 'col.mine.name')?.x
    )
    expect(parsed.widgets.find((row) => row.id === 'col.mine.name')?.y).toBe(
      factory.widgets.find((row) => row.id === 'col.mine.name')?.y
    )
  })

  it('keeps Save-over slots 1–5 when auto-migrating a stale live map', () => {
    const parsed = parseOverlayLayout({
      presetId: 'national',
      widgets: [{ id: 'score.mine', x: 40, y: 40, w: 10, h: 10 }],
      slots: {
        '1': [{ id: 'team.mine.name', x: 3, y: 12, w: 18, h: 4.8 }],
        '4': [{ id: 'col.mine.name', x: 8, y: 30, w: 15.4, h: 40 }]
      }
    })
    expect(parsed.presetId).toBe('1')
    expect(parsed.widgets.find((row) => row.id === 'score.mine')?.x).not.toBe(40)
    expect(parsed.slots['1']?.find((row) => row.id === 'team.mine.name')?.x).toBe(3)
    expect(parsed.slots['4']?.find((row) => row.id === 'col.mine.name')?.x).toBe(8)
    expect(applyPreset('4', parsed).widgets.find((row) => row.id === 'col.mine.name')?.x).toBe(8)
  })

  it('coalesces split pos/name/pts columns on a current-version save', () => {
    const parsed = parseOverlayLayout({
      schemaVersion: OVERLAY_LAYOUT_SCHEMA_VERSION,
      presetId: '1',
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

  it('merges saved widget positions when schemaVersion is current', () => {
    const parsed = parseOverlayLayout({
      schemaVersion: OVERLAY_LAYOUT_SCHEMA_VERSION,
      presetId: '2',
      widgets: [{ id: 'score.mine', x: 10, y: 10, w: 20, h: 12 }]
    })
    expect(parsed.presetId).toBe('2')
    expect(parsed.schemaVersion).toBe(OVERLAY_LAYOUT_SCHEMA_VERSION)
    expect(parsed.widgets.find((row) => row.id === 'score.mine')?.x).toBe(10)
    expect(parsed.widgets.find((row) => row.id === 'score.opp')?.x).toBe(81.2)
    expect(overlayLayoutDidMigrate(parsed)).toBe(false)
  })

  it('clamps out-of-range geometry and allows a fully transparent fill', () => {
    const parsed = parseOverlayLayout({
      schemaVersion: OVERLAY_LAYOUT_SCHEMA_VERSION,
      widgets: [{ id: 'score.delta', x: -4, y: 200, w: 0, h: 999, opacity: 2 }]
    })
    const delta = parsed.widgets.find((row) => row.id === 'score.delta')
    expect(delta?.x).toBe(0)
    expect(delta?.y).toBe(100)
    expect(delta?.w).toBe(1)
    expect(delta?.opacity).toBe(0.85)
    const clear = parseOverlayLayout({
      schemaVersion: OVERLAY_LAYOUT_SCHEMA_VERSION,
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
    expect(other.widgets.find((row) => row.id === 'col.mine.name')?.x).toBe(widget('4', 'col.mine.name')?.x)
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

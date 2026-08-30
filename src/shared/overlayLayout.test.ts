import { describe, expect, it } from 'vitest'
import {
  applyPreset,
  coversLiveVideo,
  dragIdsFor,
  layoutFromPreset,
  parseOverlayLayout,
  patchWidget,
  presetShowsCrawler,
  translateWidgets,
  OVERLAY_PRESET_IDS,
  OVERLAY_WIDGET_IDS
} from './overlayLayout'

const visible = (presetId: (typeof OVERLAY_PRESET_IDS)[number]) =>
  layoutFromPreset(presetId).widgets.filter((row) => !row.hidden)

describe('layoutFromPreset', () => {
  it('includes every widget id in every preset', () => {
    for (const id of OVERLAY_PRESET_IDS) {
      const layout = layoutFromPreset(id)
      expect(layout.widgets.map((row) => row.id).sort()).toEqual([...OVERLAY_WIDGET_IDS].sort())
      expect(layout.showCrawler).toBe(presetShowsCrawler(id))
    }
  })

  it('RedZone is a left-rail watch template that vacates RedZone chrome', () => {
    const layout = layoutFromPreset('redzone')
    expect(layout.presetId).toBe('redzone')
    expect(layout.showCrawler).toBe(false)
    const vis = visible('redzone')
    expect(vis.filter((row) => row.x >= 80).map((row) => row.id)).toEqual([])
    expect(vis.filter((row) => row.y < 12).map((row) => row.id)).toEqual([])
    expect(vis.filter((row) => row.y + row.h > 82).map((row) => row.id)).toEqual([])
    for (const id of [
      'col.opp.pos',
      'col.opp.name',
      'col.opp.nfl',
      'col.opp.pts',
      'bench.mine',
      'bench.opp',
      'team.opp.name',
      'score.opp',
      'meta.week',
      'meta.league',
      'col.mine.nfl'
    ] as const) {
      expect(layout.widgets.find((row) => row.id === id)?.hidden).toBe(true)
    }
    expect(layout.widgets.find((row) => row.id === 'col.mine.pts')?.hidden).toBe(false)
    expect(layout.widgets.find((row) => row.id === 'col.mine.name')?.density).toBe('compact')
    expect(layout.widgets.find((row) => row.id === 'toast.slot')).toMatchObject({
      x: 15,
      y: 14,
      w: 16,
      h: 6,
      hidden: false
    })
    expect(layout.widgets.find((row) => row.id === 'col.opp.name')).toMatchObject({ x: 1.5, y: 31, hidden: true })
  })

  it('National keeps scores upper-right, skinny rails, and no full-width crawler', () => {
    const layout = layoutFromPreset('national')
    expect(layout.showCrawler).toBe(false)
    const vis = visible('national')
    expect(vis.every((row) => row.y + row.h <= 86)).toBe(true)
    const mineScore = layout.widgets.find((row) => row.id === 'score.mine')
    expect(mineScore?.x).toBeGreaterThanOrEqual(70)
    expect(mineScore?.y).toBeGreaterThanOrEqual(13)
    expect((mineScore?.y ?? 0) + (mineScore?.h ?? 0)).toBeLessThanOrEqual(21)
    const toast = layout.widgets.find((row) => row.id === 'toast.slot')
    expect(toast?.w).toBeLessThan(40)
    expect(toast?.hidden).toBe(false)
    const leftRail = layout.widgets.find((row) => row.id === 'col.opp.name')
    const rightRail = layout.widgets.find((row) => row.id === 'col.mine.name')
    expect(leftRail?.hidden).toBe(false)
    expect(rightRail?.hidden).toBe(false)
    expect(leftRail?.x).toBeLessThan(8)
    expect(rightRail?.x).toBeGreaterThanOrEqual(86)
    expect(leftRail?.y).toBe(22)
    expect(leftRail?.h).toBe(52)
  })

  it('Ticket stays left-only inside the YouTube TV safe pocket', () => {
    const layout = layoutFromPreset('ticket')
    expect(layout.showCrawler).toBe(false)
    const vis = visible('ticket')
    expect(vis.every((row) => row.x + row.w <= 78)).toBe(true)
    expect(vis.every((row) => row.y >= 14)).toBe(true)
    expect(vis.every((row) => row.y + row.h <= 82)).toBe(true)
    expect(layout.widgets.filter((row) => row.id.startsWith('col.opp.')).every((row) => row.hidden)).toBe(true)
  })

  it('Broadcast L is slim, crawls, and stays out of the eyebar and ticker', () => {
    const layout = layoutFromPreset('broadcast-l')
    expect(layout.presetId).toBe('broadcast-l')
    expect(layout.showCrawler).toBe(true)
    expect(layout.widgets.find((row) => row.id === 'col.mine.nfl')?.hidden).toBe(true)
    expect(layout.widgets.find((row) => row.id === 'bench.mine')?.hidden).toBe(true)
    expect(layout.widgets.find((row) => row.id === 'col.mine.pts')?.hidden).toBe(false)
    const toast = layout.widgets.find((row) => row.id === 'toast.slot')
    expect(toast?.w).toBeLessThan(40)
    expect((toast?.y ?? 0) + (toast?.h ?? 0)).toBeLessThanOrEqual(86)
    const vis = visible('broadcast-l')
    expect(vis.every((row) => row.y >= 12)).toBe(true)
    expect(vis.every((row) => row.y + row.h <= 86)).toBe(true)
    expect(layout.widgets.filter(coversLiveVideo).map((row) => row.id)).toEqual([])
  })

  it('hides rails in Minimal and parks scores top-right', () => {
    const layout = layoutFromPreset('minimal')
    expect(layout.showCrawler).toBe(false)
    expect(layout.widgets.find((row) => row.id === 'col.mine.name')?.hidden).toBe(true)
    expect(layout.widgets.find((row) => row.id === 'score.mine')?.hidden).toBe(false)
    const vis = visible('minimal')
    expect(vis.every((row) => row.x >= 78)).toBe(true)
    expect(vis.every((row) => row.y >= 14 && row.y + row.h <= 24)).toBe(true)
  })

  it('no canned preset covers the live video rectangle', () => {
    for (const id of OVERLAY_PRESET_IDS) {
      expect(layoutFromPreset(id).widgets.filter(coversLiveVideo).map((row) => row.id)).toEqual([])
    }
  })
})

describe('parseOverlayLayout', () => {
  it('falls back to RedZone for garbage', () => {
    expect(parseOverlayLayout(null).presetId).toBe('redzone')
    expect(parseOverlayLayout(null).showCrawler).toBe(false)
    expect(parseOverlayLayout('nope').widgets).toHaveLength(OVERLAY_WIDGET_IDS.length)
  })

  it('keeps a named saved presetId', () => {
    expect(parseOverlayLayout({ presetId: 'broadcast-l' }).presetId).toBe('broadcast-l')
    expect(parseOverlayLayout({ presetId: 'broadcast-l' }).showCrawler).toBe(true)
  })

  it('merges saved widget positions onto the named preset', () => {
    const parsed = parseOverlayLayout({
      presetId: 'corners',
      widgets: [{ id: 'score.mine', x: 10, y: 10, w: 20, h: 12 }]
    })
    expect(parsed.presetId).toBe('corners')
    const score = parsed.widgets.find((row) => row.id === 'score.mine')
    expect(score?.x).toBe(10)
    expect(parsed.widgets.find((row) => row.id === 'score.opp')?.x).toBe(88)
  })

  it('clamps out-of-range geometry', () => {
    const parsed = parseOverlayLayout({
      widgets: [{ id: 'score.delta', x: -4, y: 200, w: 0, h: 999, opacity: 2 }]
    })
    const delta = parsed.widgets.find((row) => row.id === 'score.delta')
    expect(delta?.x).toBe(0)
    expect(delta?.y).toBe(100)
    expect(delta?.w).toBe(1)
    expect(delta?.opacity).toBe(0.85)
  })

  it('persists a saved showCrawler flag', () => {
    expect(parseOverlayLayout({ presetId: 'redzone', showCrawler: true }).showCrawler).toBe(true)
  })
})

describe('layout edits', () => {
  it('marks custom preset when a widget is patched', () => {
    const next = patchWidget(layoutFromPreset('broadcast-l'), 'score.mine', { hidden: true })
    expect(next.presetId).toBe('user.1')
    expect(next.widgets.find((row) => row.id === 'score.mine')?.hidden).toBe(true)
  })

  it('moves grouped rail columns together', () => {
    const layout = layoutFromPreset('broadcast-l')
    const ids = dragIdsFor(layout, 'col.mine.name')
    expect(ids).toContain('col.mine.pos')
    expect(ids).toContain('col.mine.pts')
    expect(ids).not.toContain('col.mine.nfl')
    const moved = translateWidgets(layout, ids, 2, 0)
    expect(moved.widgets.find((row) => row.id === 'col.mine.name')?.x).toBe(5.5)
    expect(moved.widgets.find((row) => row.id === 'col.mine.pts')?.x).toBe(11.5)
  })

  it('applyPreset restores a canned map', () => {
    const dirty = patchWidget(layoutFromPreset('broadcast-l'), 'meta.league', { x: 50 })
    expect(applyPreset('broadcast-l').widgets.find((row) => row.id === 'meta.league')?.x).not.toBe(
      dirty.widgets.find((row) => row.id === 'meta.league')?.x
    )
  })
})

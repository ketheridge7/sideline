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

const HIDDEN_EVERYWHERE = [
  'bench.mine',
  'bench.opp',
  'col.mine.nfl',
  'col.opp.nfl',
  'meta.league',
  'meta.week',
  'toast.slot'
] as const

describe('layoutFromPreset', () => {
  it('includes every widget id in every preset', () => {
    for (const id of OVERLAY_PRESET_IDS) {
      const layout = layoutFromPreset(id)
      expect(layout.widgets.map((row) => row.id).sort()).toEqual([...OVERLAY_WIDGET_IDS].sort())
      expect(layout.showCrawler).toBe(presetShowsCrawler(id))
      expect(layout.showCrawler).toBe(false)
      for (const hiddenId of HIDDEN_EVERYWHERE) {
        expect(layout.widgets.find((row) => row.id === hiddenId)?.hidden).toBe(true)
      }
    }
  })

  it('RedZone stacks both lineups on the left and vacates RedZone chrome', () => {
    const layout = layoutFromPreset('redzone')
    expect(layout.presetId).toBe('redzone')
    const vis = visible('redzone')
    expect(vis.filter((row) => row.x >= 80).map((row) => row.id)).toEqual([])
    expect(vis.filter((row) => row.y < 12).map((row) => row.id)).toEqual([])
    expect(vis.filter((row) => row.y + row.h > 82).map((row) => row.id)).toEqual([])
    expect(layout.widgets.find((row) => row.id === 'col.opp.name')?.hidden).toBe(false)
    expect(layout.widgets.find((row) => row.id === 'col.opp.pts')?.hidden).toBe(false)
    expect(layout.widgets.find((row) => row.id === 'score.opp')?.hidden).toBe(false)
    expect(layout.widgets.find((row) => row.id === 'team.opp.name')?.hidden).toBe(false)
    expect(layout.widgets.find((row) => row.id === 'toast.slot')?.hidden).toBe(true)
    expect(layout.widgets.find((row) => row.id === 'col.mine.name')?.y).toBe(23.2)
    expect(layout.widgets.find((row) => row.id === 'col.opp.name')?.y).toBe(57.2)
    expect(layout.widgets.find((row) => row.id === 'col.mine.name')?.density).toBe('compact')
  })

  it('Tape rails keep dual skinny rails with names and scores above each, both teams visible', () => {
    const layout = layoutFromPreset('national')
    const vis = visible('national')
    expect(vis.every((row) => row.y >= 8)).toBe(true)
    expect(vis.every((row) => row.y + row.h <= 86)).toBe(true)
    expect(layout.widgets.find((row) => row.id === 'col.opp.name')?.hidden).toBe(false)
    expect(layout.widgets.find((row) => row.id === 'col.mine.name')?.hidden).toBe(false)
    expect(layout.widgets.find((row) => row.id === 'score.mine')?.hidden).toBe(false)
    expect(layout.widgets.find((row) => row.id === 'score.opp')?.hidden).toBe(false)
    const leftRail = layout.widgets.find((row) => row.id === 'col.opp.name')
    const rightRail = layout.widgets.find((row) => row.id === 'col.mine.name')
    expect(leftRail?.x).toBeLessThan(8)
    expect(rightRail?.x).toBeGreaterThanOrEqual(82)
    expect(layout.widgets.find((row) => row.id === 'toast.slot')?.hidden).toBe(true)
    expect(layout.widgets.find((row) => row.id === 'score.mine')?.opacity).toBe(0)
    expect(layout.widgets.find((row) => row.id === 'team.opp.name')?.opacity).toBe(0)
    expect(layout.widgets.find((row) => row.id === 'col.mine.name')?.opacity).toBe(0.05)
    expect(layout.widgets.find((row) => row.id === 'col.mine.name')?.density).toBe('regular')
    expect(leftRail?.y).toBe(rightRail?.y)
    expect(leftRail?.h).toBe(rightRail?.h)
  })

  it('Ticket stays left-only and stacks both teams inside the YouTube TV pocket', () => {
    const layout = layoutFromPreset('ticket')
    const vis = visible('ticket')
    expect(vis.every((row) => row.x + row.w <= 78)).toBe(true)
    expect(vis.every((row) => row.y >= 14)).toBe(true)
    expect(vis.every((row) => row.y + row.h <= 82)).toBe(true)
    expect(layout.widgets.find((row) => row.id === 'col.opp.name')?.hidden).toBe(false)
    expect(layout.widgets.find((row) => row.id === 'score.opp')?.hidden).toBe(false)
  })

  it('Broadcast L is slim, has no crawler, and keeps both starter rails', () => {
    const layout = layoutFromPreset('broadcast-l')
    expect(layout.presetId).toBe('broadcast-l')
    expect(layout.showCrawler).toBe(false)
    expect(layout.widgets.find((row) => row.id === 'col.mine.pts')?.hidden).toBe(false)
    expect(layout.widgets.find((row) => row.id === 'col.opp.pts')?.hidden).toBe(false)
    const vis = visible('broadcast-l')
    expect(vis.every((row) => row.y >= 8)).toBe(true)
    expect(vis.every((row) => row.y + row.h <= 86)).toBe(true)
    expect(layout.widgets.filter(coversLiveVideo).map((row) => row.id)).toEqual([])
  })

  it('hides rails in Minimal and parks scores top-right', () => {
    const layout = layoutFromPreset('minimal')
    expect(layout.widgets.find((row) => row.id === 'col.mine.name')?.hidden).toBe(true)
    expect(layout.widgets.find((row) => row.id === 'score.mine')?.hidden).toBe(false)
    expect(layout.widgets.find((row) => row.id === 'score.opp')?.hidden).toBe(false)
    const vis = visible('minimal')
    expect(vis.every((row) => row.x >= 78)).toBe(true)
    expect(vis.every((row) => row.y >= 13 && row.y + row.h <= 24)).toBe(true)
  })

  it('no canned preset covers the live video rectangle', () => {
    for (const id of OVERLAY_PRESET_IDS) {
      expect(layoutFromPreset(id).widgets.filter(coversLiveVideo).map((row) => row.id)).toEqual([])
    }
  })
})

describe('parseOverlayLayout', () => {
  it('falls back to Tape rails for garbage', () => {
    expect(parseOverlayLayout(null).presetId).toBe('national')
    expect(parseOverlayLayout(null).showCrawler).toBe(false)
    expect(parseOverlayLayout('nope').widgets).toHaveLength(OVERLAY_WIDGET_IDS.length)
  })

  it('keeps a named saved presetId', () => {
    expect(parseOverlayLayout({ presetId: 'broadcast-l' }).presetId).toBe('broadcast-l')
    expect(parseOverlayLayout({ presetId: 'broadcast-l' }).showCrawler).toBe(false)
  })

  it('merges saved widget positions onto the named preset', () => {
    const parsed = parseOverlayLayout({
      presetId: 'corners',
      widgets: [{ id: 'score.mine', x: 10, y: 10, w: 20, h: 12 }]
    })
    expect(parsed.presetId).toBe('corners')
    const score = parsed.widgets.find((row) => row.id === 'score.mine')
    expect(score?.x).toBe(10)
    expect(parsed.widgets.find((row) => row.id === 'score.opp')?.x).toBe(1.2)
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
    const name = layout.widgets.find((row) => row.id === 'col.mine.name')
    const pts = layout.widgets.find((row) => row.id === 'col.mine.pts')
    const moved = translateWidgets(layout, ids, 1, 0)
    expect(moved.widgets.find((row) => row.id === 'col.mine.name')?.x).toBe((name?.x ?? 0) + 1)
    expect(moved.widgets.find((row) => row.id === 'col.mine.pts')?.x).toBe((pts?.x ?? 0) + 1)
  })

  it('applyPreset restores a canned map', () => {
    const dirty = patchWidget(layoutFromPreset('broadcast-l'), 'meta.league', { x: 50 })
    expect(applyPreset('broadcast-l').widgets.find((row) => row.id === 'meta.league')?.x).not.toBe(
      dirty.widgets.find((row) => row.id === 'meta.league')?.x
    )
  })
})

import { describe, expect, it } from 'vitest'
import {
  applyPreset,
  dragIdsFor,
  layoutFromPreset,
  parseOverlayLayout,
  patchWidget,
  translateWidgets,
  OVERLAY_WIDGET_IDS
} from './overlayLayout'

describe('layoutFromPreset', () => {
  it('includes every widget id in Broadcast L', () => {
    const layout = layoutFromPreset('broadcast-l')
    expect(layout.presetId).toBe('broadcast-l')
    expect(layout.widgets.map((row) => row.id).sort()).toEqual([...OVERLAY_WIDGET_IDS].sort())
    expect(layout.widgets.find((row) => row.id === 'col.mine.nfl')?.hidden).toBe(true)
    expect(layout.widgets.find((row) => row.id === 'bench.mine')?.hidden).toBe(true)
    expect(layout.widgets.find((row) => row.id === 'col.mine.pts')?.hidden).toBe(false)
    expect(layout.widgets.find((row) => row.id === 'toast.slot')?.w).toBe(100)
    expect(layout.widgets.find((row) => row.id === 'toast.slot')?.y).toBe(95)
    const coveringCenter = layout.widgets.filter(
      (row) =>
        !row.hidden && row.x < 78 && row.x + row.w > 22 && row.y < 90 && row.y + row.h > 10
    )
    expect(coveringCenter.map((row) => row.id)).toEqual([])
  })

  it('hides rails in Minimal', () => {
    const layout = layoutFromPreset('minimal')
    expect(layout.widgets.find((row) => row.id === 'col.mine.name')?.hidden).toBe(true)
    expect(layout.widgets.find((row) => row.id === 'score.mine')?.hidden).toBe(false)
  })
})

describe('parseOverlayLayout', () => {
  it('falls back to Broadcast L for garbage', () => {
    expect(parseOverlayLayout(null).presetId).toBe('broadcast-l')
    expect(parseOverlayLayout('nope').widgets).toHaveLength(OVERLAY_WIDGET_IDS.length)
  })

  it('merges saved widget positions onto the named preset', () => {
    const parsed = parseOverlayLayout({
      presetId: 'corners',
      widgets: [{ id: 'score.mine', x: 10, y: 10, w: 20, h: 12 }]
    })
    expect(parsed.presetId).toBe('corners')
    const score = parsed.widgets.find((row) => row.id === 'score.mine')
    expect(score?.x).toBe(10)
    expect(parsed.widgets.find((row) => row.id === 'score.opp')?.x).toBe(84)
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
    expect(moved.widgets.find((row) => row.id === 'col.mine.name')?.x).toBe(6)
    expect(moved.widgets.find((row) => row.id === 'col.mine.pts')?.x).toBe(15.2)
  })

  it('applyPreset restores a canned map', () => {
    const dirty = patchWidget(layoutFromPreset('broadcast-l'), 'meta.league', { x: 50 })
    expect(applyPreset('broadcast-l').widgets.find((row) => row.id === 'meta.league')?.x).not.toBe(
      dirty.widgets.find((row) => row.id === 'meta.league')?.x
    )
  })
})

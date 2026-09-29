import type { HudGroupBox, OverlayLayout, OverlayWidgetId, OverlayWidgetInstance } from './overlayLayout'

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))

export const STUDIO_BLOCK_IDS = ['mine', 'opp', 'ticker'] as const

export type StudioBlockId = (typeof STUDIO_BLOCK_IDS)[number]

export const STUDIO_BLOCK_LABELS: Record<StudioBlockId, string> = {
  mine: 'Your team',
  opp: 'Their team',
  ticker: 'Ticker'
}

export const MINE_FRAME_IDS: OverlayWidgetId[] = [
  'team.mine.name',
  'score.mine',
  'score.delta',
  'meta.live',
  'col.mine.pos',
  'col.mine.name',
  'col.mine.nfl',
  'col.mine.pts',
  'bench.mine'
]

export const OPP_FRAME_IDS: OverlayWidgetId[] = [
  'team.opp.name',
  'score.opp',
  'col.opp.pos',
  'col.opp.name',
  'col.opp.nfl',
  'col.opp.pts',
  'bench.opp'
]

export const idsForStudioBlock = (id: StudioBlockId): OverlayWidgetId[] => {
  switch (id) {
    case 'mine':
      return MINE_FRAME_IDS
    case 'opp':
      return OPP_FRAME_IDS
    case 'ticker':
      return ['ticker.nfl']
    default: {
      const _never: never = id
      return _never
    }
  }
}

const boxForWidgets = (rows: OverlayWidgetInstance[]): HudGroupBox => {
  const vis = rows.filter((row) => !row.hidden)
  const use = vis.length > 0 ? vis : rows
  if (use.length === 0) return { x: 0, y: 0, w: 12, h: 12 }
  const x = Math.min(...use.map((row) => row.x))
  const y = Math.min(...use.map((row) => row.y))
  const right = Math.max(...use.map((row) => row.x + row.w))
  const bottom = Math.max(...use.map((row) => row.y + row.h))
  return { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) }
}

export const studioBlockBox = (layout: OverlayLayout, id: StudioBlockId): HudGroupBox => {
  const ids = new Set(idsForStudioBlock(id))
  return boxForWidgets(layout.widgets.filter((row) => ids.has(row.id)))
}

const minSizeFor = (id: StudioBlockId): { minW: number; minH: number } => {
  switch (id) {
    case 'mine':
    case 'opp':
      return { minW: 8, minH: 12 }
    case 'ticker':
      return { minW: 24, minH: 4 }
    default: {
      const _never: never = id
      return _never
    }
  }
}

export const setStudioBlockBox = (
  layout: OverlayLayout,
  id: StudioBlockId,
  box: HudGroupBox
): OverlayLayout => {
  const ids = new Set(idsForStudioBlock(id))
  const origin = studioBlockBox(layout, id)
  const { minW, minH } = minSizeFor(id)
  const nextX = clamp(box.x, 0, 96)
  const nextY = clamp(box.y, 0, 96)
  const nextW = clamp(box.w, minW, 100 - nextX)
  const nextH = clamp(box.h, minH, 100 - nextY)
  const sx = nextW / origin.w
  const sy = nextH / origin.h
  return {
    ...layout,
    widgets: layout.widgets.map((row) => {
      if (!ids.has(row.id) || row.hidden) return row
      const w = clamp(row.w * sx, 1, 100)
      const h = clamp(row.h * sy, 1, 100)
      const x = clamp(nextX + (row.x - origin.x) * sx, 0, 100 - w)
      const y = clamp(nextY + (row.y - origin.y) * sy, 0, 100 - h)
      return { ...row, x, y, w, h }
    })
  }
}

export const applyStudioSlider = (
  layout: OverlayLayout,
  selected: StudioBlockId | null,
  patch: Partial<HudGroupBox>
): OverlayLayout => {
  if (!selected) return layout
  return setStudioBlockBox(layout, selected, { ...studioBlockBox(layout, selected), ...patch })
}

/** Moves a block without resizing it. Unlike the X/Y sliders, the far edge stops at the canvas border. */
export const translateStudioBlock = (
  layout: OverlayLayout,
  id: StudioBlockId,
  from: HudGroupBox,
  dx: number,
  dy: number
): OverlayLayout =>
  setStudioBlockBox(layout, id, {
    ...from,
    x: clamp(from.x + dx, 0, Math.max(0, 100 - from.w)),
    y: clamp(from.y + dy, 0, Math.max(0, 100 - from.h))
  })

export const nudgeStudioBlock = (layout: OverlayLayout, id: StudioBlockId, dx: number, dy: number): OverlayLayout =>
  translateStudioBlock(layout, id, studioBlockBox(layout, id), dx, dy)

export const otherTeamBlock = (id: StudioBlockId): StudioBlockId | null => {
  switch (id) {
    case 'mine':
      return 'opp'
    case 'opp':
      return 'mine'
    case 'ticker':
      return null
    default: {
      const _never: never = id
      return _never
    }
  }
}

/** Copies one team frame onto the other, flipped across the vertical center line. */
export const mirrorStudioBlock = (layout: OverlayLayout, from: StudioBlockId): OverlayLayout => {
  const to = otherTeamBlock(from)
  if (!to) return layout
  const box = studioBlockBox(layout, from)
  return setStudioBlockBox(layout, to, { ...box, x: clamp(100 - box.x - box.w, 0, 100) })
}

/** Puts one block back where the active preset button would put it. */
export const resetStudioBlock = (
  layout: OverlayLayout,
  id: StudioBlockId,
  baseline: OverlayWidgetInstance[]
): OverlayLayout => {
  const ids = new Set(idsForStudioBlock(id))
  const byId = new Map(baseline.map((row) => [row.id, row]))
  return {
    ...layout,
    widgets: layout.widgets.map((row) => {
      const base = byId.get(row.id)
      return ids.has(row.id) && base ? { ...base } : row
    })
  }
}

const RAIL_WIDGET_IDS = new Set<OverlayWidgetId>(['col.mine.name', 'col.opp.name'])

/** Widgets as they paint, after the Studio's ticker / lead / rails toggles. */
export const displayWidgets = (layout: OverlayLayout): OverlayWidgetInstance[] => {
  const { ticker, lead, rails } = layout.display
  if (ticker && lead && rails) return layout.widgets
  return layout.widgets.map((row) => {
    if (row.hidden) return row
    if (!ticker && row.id === 'ticker.nfl') return { ...row, hidden: true }
    if (!lead && row.id === 'score.delta') return { ...row, hidden: true }
    if (!rails && RAIL_WIDGET_IDS.has(row.id)) return { ...row, hidden: true }
    return row
  })
}

export type HudPlate = { side: 'mine' | 'opp'; box: HudGroupBox }

/** Canvas-percent breathing room between a plate edge and the type it backs. */
export const HUD_PLATE_PAD = { x: 0.7, y: 1.1 } as const

/** One plate per team frame, sized to the visible widgets plus a little padding. */
export const hudPlateBoxes = (layout: OverlayLayout): HudPlate[] => {
  const widgets = displayWidgets(layout)
  const plates: HudPlate[] = []
  for (const side of ['mine', 'opp'] as const) {
    const ids = new Set(idsForStudioBlock(side))
    const rows = widgets.filter((row) => ids.has(row.id) && !row.hidden && row.id !== 'meta.live')
    if (rows.length === 0) continue
    const box = boxForWidgets(rows)
    const x = clamp(box.x - HUD_PLATE_PAD.x, 0, 100)
    const y = clamp(box.y - HUD_PLATE_PAD.y, 0, 100)
    const right = clamp(box.x + box.w + HUD_PLATE_PAD.x, 0, 100)
    const bottom = clamp(box.y + box.h + HUD_PLATE_PAD.y, 0, 100)
    plates.push({ side, box: { x, y, w: right - x, h: bottom - y } })
  }
  return plates
}

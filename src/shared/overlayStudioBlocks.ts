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

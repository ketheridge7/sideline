export const OVERLAY_WIDGET_IDS = [
  'meta.league',
  'meta.week',
  'meta.live',
  'team.mine.name',
  'team.opp.name',
  'score.mine',
  'score.opp',
  'score.delta',
  'col.mine.pos',
  'col.mine.name',
  'col.mine.nfl',
  'col.mine.pts',
  'col.opp.pos',
  'col.opp.name',
  'col.opp.nfl',
  'col.opp.pts',
  'bench.mine',
  'bench.opp',
  'toast.slot',
  'ticker.nfl'
] as const

export type OverlayWidgetId = (typeof OVERLAY_WIDGET_IDS)[number]

export const OVERLAY_PRESET_IDS = ['1', '2', '3', '4', '5'] as const

export type OverlayPresetId = (typeof OVERLAY_PRESET_IDS)[number]

export const DEFAULT_OVERLAY_PRESET: OverlayPresetId = '1'

/**
 * Bump when canned preset geometry or the widget catalog changes incompatibly.
 * v2 = you-left dual frost rails and five placements from HUD PRs #13/#14.
 * v3 = Preset 4 same-side stacked team frames; ticker.nfl in the catalog for Studio blocks.
 * Unversioned / older saves reset live widgets to Preset 1 once; slots 1–5 stay.
 */
export const OVERLAY_LAYOUT_SCHEMA_VERSION = 3

export type OverlayDensity = 'inherit' | 'compact' | 'regular' | 'large'

export type OverlayWidgetInstance = {
  id: OverlayWidgetId
  x: number
  y: number
  w: number
  h: number
  hidden: boolean
  locked: boolean
  opacity: number
  density: OverlayDensity
}

export type OverlayLayout = {
  schemaVersion: number
  presetId: OverlayPresetId
  widgets: OverlayWidgetInstance[]
  slots: Partial<Record<OverlayPresetId, OverlayWidgetInstance[]>>
  groupedRails: { mine: boolean; opp: boolean }
  trackLock: { mine: boolean; opp: boolean }
  showCrawler: boolean
}

export type HudGroupBox = {
  x: number
  y: number
  w: number
  h: number
}

export const MINE_RAIL_IDS: OverlayWidgetId[] = [
  'col.mine.pos',
  'col.mine.name',
  'col.mine.nfl',
  'col.mine.pts'
]

export const OPP_RAIL_IDS: OverlayWidgetId[] = [
  'col.opp.pos',
  'col.opp.name',
  'col.opp.nfl',
  'col.opp.pts'
]

export const WIDGET_LABELS: Record<OverlayWidgetId, string> = {
  'meta.league': 'League',
  'meta.week': 'Week',
  'meta.live': 'Live',
  'team.mine.name': 'Your team',
  'team.opp.name': 'Their team',
  'score.mine': 'Your score',
  'score.opp': 'Their score',
  'score.delta': 'Lead',
  'col.mine.pos': 'Your positions',
  'col.mine.name': 'Your names',
  'col.mine.nfl': 'Your NFL tags',
  'col.mine.pts': 'Your player scores',
  'col.opp.pos': 'Their positions',
  'col.opp.name': 'Their names',
  'col.opp.nfl': 'Their NFL tags',
  'col.opp.pts': 'Their player scores',
  'bench.mine': 'Your bench',
  'bench.opp': 'Their bench',
  'toast.slot': 'Alerts',
  'ticker.nfl': 'Ticker'
}

export const PRESET_LABELS: Record<OverlayPresetId, string> = {
  '1': 'Preset 1',
  '2': 'Preset 2',
  '3': 'Preset 3',
  '4': 'Preset 4',
  '5': 'Preset 5'
}

export const PRESET_PLACEMENTS: Record<OverlayPresetId, string> = {
  '1': 'Far sides',
  '2': 'Upper corners',
  '3': 'Lower corners',
  '4': 'Same-side stack',
  '5': 'Side bands'
}

export const PRESET_HINTS: Record<OverlayPresetId, string> = {
  '1': 'You left, them right.',
  '2': 'You left, them right.',
  '3': 'You left, them right.',
  '4': 'Both teams on the same side, stacked one above the other.',
  '5': 'You left-upper, them right-lower.'
}

const LEGACY_PRESET_IDS: Record<string, OverlayPresetId> = {
  national: '1',
  'user.1': '1',
  'broadcast-l': '1',
  redzone: '5',
  ticket: '5',
  corners: '2',
  pip: '2',
  minimal: '2'
}

export const presetShowsCrawler = (presetId: OverlayPresetId): boolean => {
  switch (presetId) {
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
      return false
    default: {
      const _never: never = presetId
      return _never
    }
  }
}

export const coversLiveVideo = (row: OverlayWidgetInstance): boolean =>
  row.id !== 'toast.slot' &&
  row.id !== 'ticker.nfl' &&
  !row.hidden &&
  row.x < 78 &&
  row.x + row.w > 22 &&
  row.y < 86 &&
  row.y + row.h > 22

/** Overlay widgets float — no pane, no wash. Studio can still raise fill. */
const GHOST = 0
const OPACITY_MIN = 0
const OPACITY_MAX = 0.85

const box = (
  id: OverlayWidgetId,
  x: number,
  y: number,
  w: number,
  h: number,
  extra?: Partial<Pick<OverlayWidgetInstance, 'hidden' | 'opacity' | 'density'>>
): OverlayWidgetInstance => ({
  id,
  x,
  y,
  w,
  h,
  hidden: extra?.hidden ?? false,
  locked: false,
  opacity: extra?.opacity ?? GHOST,
  density: extra?.density ?? 'inherit'
})

const compact = (
  id: OverlayWidgetId,
  x: number,
  y: number,
  w: number,
  h: number,
  extra?: Partial<Pick<OverlayWidgetInstance, 'hidden' | 'opacity'>>
): OverlayWidgetInstance => box(id, x, y, w, h, { ...extra, density: extra?.hidden ? 'inherit' : 'compact' })

const ghost = (
  id: OverlayWidgetId,
  x: number,
  y: number,
  w: number,
  h: number,
  density: OverlayDensity = 'compact'
): OverlayWidgetInstance => box(id, x, y, w, h, { opacity: GHOST, density })

const railCol = (
  id: OverlayWidgetId,
  x: number,
  y: number,
  w: number,
  h: number,
  density: OverlayDensity = 'compact'
): OverlayWidgetInstance => ghost(id, x, y, w, h, density)

const layout = (
  presetId: OverlayPresetId,
  widgets: OverlayWidgetInstance[],
  groupedRails = { mine: true, opp: true }
): OverlayLayout => ({
  schemaVersion: OVERLAY_LAYOUT_SCHEMA_VERSION,
  presetId,
  widgets,
  slots: {},
  groupedRails,
  trackLock: { mine: true, opp: true },
  showCrawler: presetShowsCrawler(presetId)
})

const hide = (
  id: OverlayWidgetId,
  x: number,
  y: number,
  w = 12,
  h = 6
): OverlayWidgetInstance => compact(id, x, y, w, h, { hidden: true })

type RailAnchor = {
  x: number
  nameY: number
  railY: number
  railH: number
}

const NAME_H = 4.8
const SCORE_GAP = 0.2
const DELTA_W = 5.2

const teamChrome = (
  side: 'mine' | 'opp',
  anchor: RailAnchor,
  scoreH: number,
  railW: number,
  density: OverlayDensity
): OverlayWidgetInstance[] => {
  const scoreY = anchor.nameY + NAME_H + SCORE_GAP
  const nameId = side === 'mine' ? 'team.mine.name' : 'team.opp.name'
  const scoreId = side === 'mine' ? 'score.mine' : 'score.opp'
  const colName = side === 'mine' ? 'col.mine.name' : 'col.opp.name'
  const colPos = side === 'mine' ? 'col.mine.pos' : 'col.opp.pos'
  const colPts = side === 'mine' ? 'col.mine.pts' : 'col.opp.pts'
  const colNfl = side === 'mine' ? 'col.mine.nfl' : 'col.opp.nfl'
  const bench = side === 'mine' ? 'bench.mine' : 'bench.opp'
  const rows: OverlayWidgetInstance[] = [
    ghost(nameId, anchor.x, anchor.nameY, railW, NAME_H, density),
    ghost(scoreId, anchor.x, scoreY, railW, scoreH, density),
    railCol(colName, anchor.x, anchor.railY, railW, anchor.railH, density),
    hide(colPos, anchor.x, anchor.railY),
    hide(colPts, anchor.x, anchor.railY),
    hide(colNfl, anchor.x, anchor.railY, 4, anchor.railH),
    hide(bench, anchor.x, anchor.railY)
  ]
  if (side === 'mine') {
    rows.push(
      ghost('score.delta', anchor.x + Math.max(railW - DELTA_W, 0), scoreY + 2, DELTA_W, 5.4, density)
    )
    rows.push(ghost('meta.live', anchor.x + railW - 1.2, anchor.nameY + 0.2, 1.2, 1.2, density))
  }
  return rows
}

const TICKER_Y = 94.4
const TICKER_H = 5.6

const dualColumn = (
  mine: RailAnchor,
  opp: RailAnchor,
  scoreH: number,
  railW: number
): OverlayWidgetInstance[] => [
  ...teamChrome('mine', mine, scoreH, railW, 'regular'),
  ...teamChrome('opp', opp, scoreH, railW, 'regular'),
  hide('meta.league', mine.x, mine.railY),
  hide('meta.week', mine.x, mine.railY, 5, 2),
  hide('toast.slot', mine.x, mine.railY),
  ghost('ticker.nfl', 0, TICKER_Y, 100, TICKER_H, 'compact')
]

export const layoutFromPreset = (presetId: OverlayPresetId): OverlayLayout => {
  switch (presetId) {
    case '1':
      return layout(
        '1',
        dualColumn(
          { x: 1.2, nameY: 9.2, railY: 23.2, railH: 58 },
          { x: 80.8, nameY: 9.2, railY: 23.2, railH: 58 },
          9,
          18
        )
      )
    case '2':
      return layout(
        '2',
        dualColumn(
          { x: 1.2, nameY: 2.4, railY: 16.2, railH: 30 },
          { x: 81.2, nameY: 2.4, railY: 16.2, railH: 30 },
          7.2,
          17.4
        )
      )
    case '3':
      return layout(
        '3',
        dualColumn(
          { x: 1.2, nameY: 48.2, railY: 62.4, railH: 21.6 },
          { x: 80.8, nameY: 48.2, railY: 62.4, railH: 21.6 },
          7.4,
          18
        )
      )
    case '4':
      return layout(
        '4',
        dualColumn(
          { x: 1.2, nameY: 2.8, railY: 16.8, railH: 28 },
          { x: 1.2, nameY: 50.2, railY: 64.2, railH: 26 },
          7.4,
          18
        )
      )
    case '5':
      return layout(
        '5',
        dualColumn(
          { x: 1.2, nameY: 6, railY: 19.8, railH: 34 },
          { x: 80.8, nameY: 38.4, railY: 52.2, railH: 30 },
          7.6,
          18
        )
      )
    default: {
      const _never: never = presetId
      return _never
    }
  }
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

export const parsePresetId = (value: unknown): OverlayPresetId => {
  const raw =
    typeof value === 'number' && Number.isFinite(value) ? String(Math.trunc(value)) : value
  if (typeof raw === 'string' && (OVERLAY_PRESET_IDS as readonly string[]).includes(raw)) {
    return raw as OverlayPresetId
  }
  if (typeof raw === 'string' && raw in LEGACY_PRESET_IDS) return LEGACY_PRESET_IDS[raw]
  return DEFAULT_OVERLAY_PRESET
}

const parseSchemaVersion = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

/** True when disk JSON is missing or behind the current factory map. */
export const overlayLayoutDidMigrate = (raw: unknown): boolean => {
  const rec = asRecord(raw)
  return parseSchemaVersion(rec?.schemaVersion) < OVERLAY_LAYOUT_SCHEMA_VERSION
}

const parseDensity = (value: unknown): OverlayDensity => {
  if (value === 'compact' || value === 'regular' || value === 'large' || value === 'inherit') return value
  return 'inherit'
}

const parseWidget = (raw: unknown, fallback: OverlayWidgetInstance): OverlayWidgetInstance => {
  const rec = asRecord(raw)
  if (!rec) return fallback
  return {
    id: fallback.id,
    x: clamp(typeof rec.x === 'number' ? rec.x : fallback.x, 0, 100),
    y: clamp(typeof rec.y === 'number' ? rec.y : fallback.y, 0, 100),
    w: clamp(typeof rec.w === 'number' ? rec.w : fallback.w, 1, 100),
    h: clamp(typeof rec.h === 'number' ? rec.h : fallback.h, 1, 100),
    hidden: typeof rec.hidden === 'boolean' ? rec.hidden : fallback.hidden,
    locked: typeof rec.locked === 'boolean' ? rec.locked : fallback.locked,
    opacity: clamp(
      typeof rec.opacity === 'number' ? rec.opacity : fallback.opacity,
      OPACITY_MIN,
      OPACITY_MAX
    ),
    density: parseDensity(rec.density)
  }
}

const widgetMap = (rows: unknown): Map<string, unknown> => {
  const byId = new Map<string, unknown>()
  if (!Array.isArray(rows)) return byId
  for (const row of rows) {
    const item = asRecord(row)
    if (item && typeof item.id === 'string') byId.set(item.id, row)
  }
  return byId
}

const mergeWidgets = (
  base: OverlayWidgetInstance[],
  saved: unknown
): OverlayWidgetInstance[] => {
  const byId = widgetMap(saved)
  return base.map((widget) => parseWidget(byId.get(widget.id), widget))
}

export const coalesceRailColumns = (widgets: OverlayWidgetInstance[]): OverlayWidgetInstance[] => {
  const sides: Array<'mine' | 'opp'> = ['mine', 'opp']
  let next = widgets
  for (const side of sides) {
    const posId = `col.${side}.pos` as OverlayWidgetId
    const nameId = `col.${side}.name` as OverlayWidgetId
    const ptsId = `col.${side}.pts` as OverlayWidgetId
    const pos = next.find((row) => row.id === posId)
    const name = next.find((row) => row.id === nameId)
    const pts = next.find((row) => row.id === ptsId)
    if (!name) continue
    const vis = [pos, name, pts].filter((row): row is OverlayWidgetInstance => row != null && !row.hidden)
    if (vis.length === 0) {
      next = next.map((row) => (row.id === posId || row.id === ptsId ? { ...row, hidden: true } : row))
      continue
    }
    const x = Math.min(...vis.map((row) => row.x))
    const y = Math.min(...vis.map((row) => row.y))
    const right = Math.max(...vis.map((row) => row.x + row.w))
    const bottom = Math.max(...vis.map((row) => row.y + row.h))
    next = next.map((row) => {
      if (row.id === nameId) {
        return {
          ...row,
          x,
          y,
          w: clamp(right - x, 1, 100),
          h: clamp(bottom - y, 1, 100),
          hidden: false
        }
      }
      if (row.id === posId || row.id === ptsId) return { ...row, hidden: true }
      return row
    })
  }
  return next
}

const parseSlots = (raw: unknown): OverlayLayout['slots'] => {
  const rec = asRecord(raw)
  if (!rec) return {}
  const slots: OverlayLayout['slots'] = {}
  for (const id of OVERLAY_PRESET_IDS) {
    const rows = rec[id]
    if (!Array.isArray(rows)) continue
    const base = layoutFromPreset(id).widgets
    slots[id] = coalesceRailColumns(mergeWidgets(base, rows))
  }
  return slots
}

export const parseOverlayLayout = (raw: unknown): OverlayLayout => {
  const rec = asRecord(raw)
  if (!rec) return layoutFromPreset(DEFAULT_OVERLAY_PRESET)
  const slots = parseSlots(rec.slots)
  if (overlayLayoutDidMigrate(rec)) {
    return { ...layoutFromPreset(DEFAULT_OVERLAY_PRESET), slots }
  }
  const presetId = parsePresetId(rec.presetId)
  const base = layoutFromPreset(presetId)
  const grouped = asRecord(rec.groupedRails)
  const track = asRecord(rec.trackLock)
  return {
    schemaVersion: OVERLAY_LAYOUT_SCHEMA_VERSION,
    presetId,
    widgets: coalesceRailColumns(mergeWidgets(base.widgets, rec.widgets)),
    slots,
    groupedRails: {
      mine: typeof grouped?.mine === 'boolean' ? grouped.mine : base.groupedRails.mine,
      opp: typeof grouped?.opp === 'boolean' ? grouped.opp : base.groupedRails.opp
    },
    trackLock: {
      mine: typeof track?.mine === 'boolean' ? track.mine : base.trackLock.mine,
      opp: typeof track?.opp === 'boolean' ? track.opp : base.trackLock.opp
    },
    showCrawler: typeof rec.showCrawler === 'boolean' ? rec.showCrawler : base.showCrawler
  }
}

export const widgetById = (
  layout: OverlayLayout,
  id: OverlayWidgetId
): OverlayWidgetInstance | undefined => layout.widgets.find((row) => row.id === id)

export const patchWidget = (
  layout: OverlayLayout,
  id: OverlayWidgetId,
  patch: Partial<Omit<OverlayWidgetInstance, 'id'>>
): OverlayLayout => ({
  ...layout,
  widgets: layout.widgets.map((row) => (row.id === id ? { ...row, ...patch, id: row.id } : row))
})

export const railIdsFor = (id: OverlayWidgetId): OverlayWidgetId[] | null => {
  if (MINE_RAIL_IDS.includes(id)) return MINE_RAIL_IDS
  if (OPP_RAIL_IDS.includes(id)) return OPP_RAIL_IDS
  return null
}

export const dragIdsFor = (layout: OverlayLayout, id: OverlayWidgetId): OverlayWidgetId[] => {
  const rail = railIdsFor(id)
  if (!rail) return [id]
  const mine = MINE_RAIL_IDS.includes(id)
  const grouped = mine ? layout.groupedRails.mine : layout.groupedRails.opp
  if (!grouped) return [id]
  return rail.filter((row) => widgetById(layout, row) && !widgetById(layout, row)?.hidden)
}

export const translateWidgets = (
  layout: OverlayLayout,
  ids: OverlayWidgetId[],
  dx: number,
  dy: number
): OverlayLayout => {
  const set = new Set(ids)
  return {
    ...layout,
    widgets: layout.widgets.map((row) => {
      if (!set.has(row.id) || row.locked) return row
      return {
        ...row,
        x: clamp(row.x + dx, 0, 100 - row.w),
        y: clamp(row.y + dy, 0, 100 - row.h)
      }
    })
  }
}

export const resizeWidget = (
  layout: OverlayLayout,
  id: OverlayWidgetId,
  w: number,
  h: number
): OverlayLayout => {
  const current = widgetById(layout, id)
  if (!current || current.locked) return layout
  const next = {
    ...current,
    w: clamp(w, 1, 100 - current.x),
    h: clamp(h, 1, 100 - current.y)
  }
  let widgets = layout.widgets.map((row) => (row.id === id ? next : row))
  const rail = railIdsFor(id)
  const mine = MINE_RAIL_IDS.includes(id)
  const lock = mine ? layout.trackLock.mine : layout.trackLock.opp
  if (rail && lock) {
    widgets = widgets.map((row) => (rail.includes(row.id) ? { ...row, y: next.y, h: next.h } : row))
  }
  return { ...layout, widgets }
}

export const applyPreset = (presetId: OverlayPresetId, current?: OverlayLayout): OverlayLayout => {
  const slots = current?.slots ?? {}
  const factory = layoutFromPreset(presetId)
  const saved = slots[presetId]
  if (!saved) return { ...factory, slots, schemaVersion: OVERLAY_LAYOUT_SCHEMA_VERSION }
  return {
    ...factory,
    slots,
    schemaVersion: OVERLAY_LAYOUT_SCHEMA_VERSION,
    widgets: coalesceRailColumns(mergeWidgets(factory.widgets, saved))
  }
}

export const overwritePreset = (
  layout: OverlayLayout,
  presetId: OverlayPresetId = layout.presetId
): OverlayLayout => ({
  ...layout,
  schemaVersion: OVERLAY_LAYOUT_SCHEMA_VERSION,
  presetId,
  slots: {
    ...layout.slots,
    [presetId]: layout.widgets.map((row) => ({ ...row }))
  }
})

export const hudGroupBox = (layout: OverlayLayout): HudGroupBox => {
  const vis = layout.widgets.filter((row) => !row.hidden)
  if (vis.length === 0) return { x: 0, y: 0, w: 100, h: 100 }
  const x = Math.min(...vis.map((row) => row.x))
  const y = Math.min(...vis.map((row) => row.y))
  const right = Math.max(...vis.map((row) => row.x + row.w))
  const bottom = Math.max(...vis.map((row) => row.y + row.h))
  return { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) }
}

export const setHudGroupBox = (layout: OverlayLayout, box: HudGroupBox): OverlayLayout => {
  const origin = hudGroupBox(layout)
  const nextX = clamp(box.x, 0, 92)
  const nextY = clamp(box.y, 0, 92)
  const nextW = clamp(box.w, 12, 100 - nextX)
  const nextH = clamp(box.h, 12, 100 - nextY)
  const sx = nextW / origin.w
  const sy = nextH / origin.h
  return {
    ...layout,
    widgets: layout.widgets.map((row) => {
      if (row.hidden) return row
      const w = clamp(row.w * sx, 1, 100)
      const h = clamp(row.h * sy, 1, 100)
      const x = clamp(nextX + (row.x - origin.x) * sx, 0, 100 - w)
      const y = clamp(nextY + (row.y - origin.y) * sy, 0, 100 - h)
      return { ...row, x, y, w, h }
    })
  }
}

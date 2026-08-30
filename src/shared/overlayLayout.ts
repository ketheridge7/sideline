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
  'toast.slot'
] as const

export type OverlayWidgetId = (typeof OVERLAY_WIDGET_IDS)[number]

export const OVERLAY_PRESET_IDS = ['broadcast-l', 'corners', 'pip', 'minimal', 'user.1'] as const

export type OverlayPresetId = (typeof OVERLAY_PRESET_IDS)[number]

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
  presetId: OverlayPresetId
  widgets: OverlayWidgetInstance[]
  groupedRails: { mine: boolean; opp: boolean }
  trackLock: { mine: boolean; opp: boolean }
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
  'meta.live': 'On air',
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
  'toast.slot': 'Alerts'
}

export const PRESET_LABELS: Record<OverlayPresetId, string> = {
  'broadcast-l': 'Broadcast L',
  corners: 'Corners',
  pip: 'PiP',
  minimal: 'Minimal',
  'user.1': 'Custom'
}

const SMOKE = 0.28

const box = (
  id: OverlayWidgetId,
  x: number,
  y: number,
  w: number,
  h: number,
  extra?: Partial<Pick<OverlayWidgetInstance, 'hidden' | 'opacity'>>
): OverlayWidgetInstance => ({
  id,
  x,
  y,
  w,
  h,
  hidden: extra?.hidden ?? false,
  locked: false,
  opacity: extra?.opacity ?? SMOKE,
  density: 'inherit'
})

const layout = (
  presetId: OverlayPresetId,
  widgets: OverlayWidgetInstance[],
  groupedRails = { mine: true, opp: true }
): OverlayLayout => ({
  presetId,
  widgets,
  groupedRails,
  trackLock: { mine: true, opp: true }
})

export const layoutFromPreset = (presetId: OverlayPresetId): OverlayLayout => {
  switch (presetId) {
    case 'broadcast-l':
    case 'user.1':
      return layout(presetId === 'user.1' ? 'user.1' : 'broadcast-l', [
        box('meta.league', 1.5, 1.5, 14, 3),
        box('meta.week', 16, 1.5, 5, 3),
        box('meta.live', 21.5, 1.5, 6, 3),
        box('team.mine.name', 1.5, 5.5, 16, 4),
        box('score.mine', 1.5, 9.5, 16, 11),
        box('col.mine.pos', 1.5, 22, 2.5, 62),
        box('col.mine.name', 4, 22, 9, 62),
        box('col.mine.nfl', 13.2, 22, 3.5, 62, { hidden: true }),
        box('col.mine.pts', 13.2, 22, 4.5, 62),
        box('score.delta', 1.5, 85, 16, 8),
        box('col.opp.pts', 82.3, 22, 4.5, 62),
        box('col.opp.name', 87, 22, 9, 62),
        box('col.opp.nfl', 78.8, 22, 3.5, 62, { hidden: true }),
        box('col.opp.pos', 96.2, 22, 2.5, 62),
        box('team.opp.name', 82.5, 5.5, 16, 4),
        box('score.opp', 82.5, 9.5, 16, 11),
        box('toast.slot', 0, 95, 100, 5),
        box('bench.mine', 1.5, 68, 16, 12, { hidden: true }),
        box('bench.opp', 82.5, 68, 16, 12, { hidden: true })
      ])
    case 'corners':
      return layout('corners', [
        box('score.mine', 2, 2, 14, 11),
        box('team.mine.name', 2, 13, 14, 4),
        box('score.opp', 84, 2, 14, 11),
        box('team.opp.name', 84, 13, 14, 4),
        box('score.delta', 45, 3, 10, 5),
        box('meta.live', 45, 8, 6, 3),
        box('meta.week', 52, 8, 8, 3),
        box('col.mine.pos', 1.5, 22, 2.5, 70),
        box('col.mine.name', 4, 22, 9, 70),
        box('col.mine.nfl', 13, 22, 3.5, 70, { hidden: true }),
        box('col.mine.pts', 13.2, 22, 4.5, 70),
        box('col.opp.pts', 82.3, 22, 4.5, 70),
        box('col.opp.name', 87, 22, 9, 70),
        box('col.opp.nfl', 78.8, 22, 3.5, 70, { hidden: true }),
        box('col.opp.pos', 96.2, 22, 2.5, 70),
        box('meta.league', 2, 94, 20, 3),
        box('toast.slot', 36, 90, 28, 7),
        box('bench.mine', 1.5, 78, 16, 10, { hidden: true }),
        box('bench.opp', 82.5, 78, 16, 10, { hidden: true })
      ])
    case 'pip':
      return layout('pip', [
        box('meta.league', 72, 3, 14, 4),
        box('meta.live', 86, 3, 6, 4),
        box('meta.week', 92, 3, 6, 4),
        box('team.mine.name', 72, 8, 12, 4),
        box('score.mine', 72, 12, 12, 6),
        box('score.delta', 84.5, 10, 5, 6),
        box('team.opp.name', 90, 8, 8, 4),
        box('score.opp', 90, 12, 8, 6),
        box('col.mine.pos', 72, 20, 2.2, 52),
        box('col.mine.name', 74.2, 20, 7, 52),
        box('col.mine.nfl', 81, 20, 3, 52, { hidden: true }),
        box('col.mine.pts', 81.4, 20, 3.6, 52),
        box('col.opp.pts', 85.5, 20, 3.5, 52),
        box('col.opp.name', 89.2, 20, 6.5, 52),
        box('col.opp.nfl', 95, 20, 2.5, 52, { hidden: true }),
        box('col.opp.pos', 95.8, 20, 2.2, 52),
        box('toast.slot', 72, 74, 26, 8),
        box('bench.mine', 72, 64, 13, 8, { hidden: true }),
        box('bench.opp', 85.5, 64, 12.5, 8, { hidden: true })
      ])
    case 'minimal':
      return layout(
        'minimal',
        [
          box('score.mine', 2, 88, 12, 10),
          box('team.mine.name', 2, 84, 12, 3.5),
          box('score.delta', 15, 90, 8, 6),
          box('score.opp', 24, 88, 12, 10),
          box('team.opp.name', 24, 84, 12, 3.5),
          box('meta.live', 38, 91, 6, 3),
          box('meta.week', 38, 84, 8, 3, { hidden: true }),
          box('meta.league', 2, 78, 18, 3, { hidden: true }),
          box('toast.slot', 46, 88, 24, 8),
          box('col.mine.pos', 2, 8, 2.5, 70, { hidden: true }),
          box('col.mine.name', 4.5, 8, 9, 70, { hidden: true }),
          box('col.mine.nfl', 14, 8, 3.5, 70, { hidden: true }),
          box('col.mine.pts', 14, 8, 4.5, 70, { hidden: true }),
          box('col.opp.pos', 96, 8, 2.5, 70, { hidden: true }),
          box('col.opp.name', 87, 8, 9, 70, { hidden: true }),
          box('col.opp.nfl', 83, 8, 3.5, 70, { hidden: true }),
          box('col.opp.pts', 82.3, 8, 4.5, 70, { hidden: true }),
          box('bench.mine', 2, 60, 16, 12, { hidden: true }),
          box('bench.opp', 82, 60, 16, 12, { hidden: true })
        ],
        { mine: true, opp: true }
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

const parsePresetId = (value: unknown): OverlayPresetId =>
  typeof value === 'string' && (OVERLAY_PRESET_IDS as readonly string[]).includes(value)
    ? (value as OverlayPresetId)
    : 'broadcast-l'

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
    opacity: clamp(typeof rec.opacity === 'number' ? rec.opacity : fallback.opacity, 0.15, 0.85),
    density: parseDensity(rec.density)
  }
}

export const parseOverlayLayout = (raw: unknown): OverlayLayout => {
  const rec = asRecord(raw)
  const presetId = parsePresetId(rec?.presetId)
  const base = layoutFromPreset(presetId)
  if (!rec) return base
  const saved = Array.isArray(rec.widgets) ? rec.widgets : []
  const byId = new Map<string, unknown>()
  for (const row of saved) {
    const item = asRecord(row)
    if (item && typeof item.id === 'string') byId.set(item.id, row)
  }
  const grouped = asRecord(rec.groupedRails)
  const track = asRecord(rec.trackLock)
  return {
    presetId,
    widgets: base.widgets.map((widget) => parseWidget(byId.get(widget.id), widget)),
    groupedRails: {
      mine: typeof grouped?.mine === 'boolean' ? grouped.mine : base.groupedRails.mine,
      opp: typeof grouped?.opp === 'boolean' ? grouped.opp : base.groupedRails.opp
    },
    trackLock: {
      mine: typeof track?.mine === 'boolean' ? track.mine : base.trackLock.mine,
      opp: typeof track?.opp === 'boolean' ? track.opp : base.trackLock.opp
    }
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
  presetId: 'user.1',
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
    presetId: 'user.1',
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
  return { ...layout, presetId: 'user.1', widgets }
}

export const applyPreset = (presetId: OverlayPresetId): OverlayLayout => layoutFromPreset(presetId)

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

export const OVERLAY_PRESET_IDS = [
  'redzone',
  'national',
  'ticket',
  'minimal',
  'broadcast-l',
  'corners',
  'pip',
  'user.1'
] as const

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
  showCrawler: boolean
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
  redzone: 'RedZone',
  national: 'National',
  ticket: 'Ticket',
  minimal: 'Minimal',
  'broadcast-l': 'Broadcast L',
  corners: 'Corners',
  pip: 'PiP',
  'user.1': 'Custom'
}

export const presetShowsCrawler = (presetId: OverlayPresetId): boolean => {
  switch (presetId) {
    case 'broadcast-l':
    case 'corners':
      return true
    case 'redzone':
    case 'national':
    case 'ticket':
    case 'minimal':
    case 'pip':
    case 'user.1':
      return false
    default: {
      const _never: never = presetId
      return _never
    }
  }
}

export const coversLiveVideo = (row: OverlayWidgetInstance): boolean =>
  row.id !== 'toast.slot' &&
  !row.hidden &&
  row.x < 78 &&
  row.x + row.w > 22 &&
  row.y < 86 &&
  row.y + row.h > 22

const SMOKE = 0.28

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
  opacity: extra?.opacity ?? SMOKE,
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

const layout = (
  presetId: OverlayPresetId,
  widgets: OverlayWidgetInstance[],
  groupedRails = { mine: true, opp: true }
): OverlayLayout => ({
  presetId,
  widgets,
  groupedRails,
  trackLock: { mine: true, opp: true },
  showCrawler: presetShowsCrawler(presetId)
})

const redzoneWidgets = (): OverlayWidgetInstance[] => [
  compact('meta.live', 1.5, 14, 4.5, 2.2),
  compact('team.mine.name', 1.5, 16.5, 12, 3),
  compact('score.mine', 1.5, 19.5, 12, 6.5),
  compact('score.delta', 1.5, 26.2, 12, 3),
  compact('meta.week', 1.5, 14, 5, 2.2, { hidden: true }),
  compact('meta.league', 1.5, 14, 12, 2.2, { hidden: true }),
  compact('team.opp.name', 1.5, 16.5, 12, 3, { hidden: true }),
  compact('score.opp', 1.5, 19.5, 12, 6.5, { hidden: true }),
  compact('col.mine.pos', 1.5, 31, 2, 48),
  compact('col.mine.name', 3.5, 31, 6.2, 48),
  compact('col.mine.nfl', 9.7, 31, 3.8, 48, { hidden: true }),
  compact('col.mine.pts', 9.7, 31, 3.8, 48),
  compact('col.opp.pos', 1.5, 31, 2, 48, { hidden: true }),
  compact('col.opp.name', 1.5, 31, 6.2, 48, { hidden: true }),
  compact('col.opp.nfl', 1.5, 31, 3.8, 48, { hidden: true }),
  compact('col.opp.pts', 1.5, 31, 3.8, 48, { hidden: true }),
  compact('bench.mine', 1.5, 31, 12, 8, { hidden: true }),
  compact('bench.opp', 1.5, 31, 12, 8, { hidden: true }),
  compact('toast.slot', 15, 14, 16, 6)
]

export const layoutFromPreset = (presetId: OverlayPresetId): OverlayLayout => {
  switch (presetId) {
    case 'redzone':
      return layout('redzone', redzoneWidgets())
    case 'user.1':
      return layout('user.1', redzoneWidgets())
    case 'national':
      return layout('national', [
        compact('team.mine.name', 74, 13, 8, 2.4),
        compact('score.mine', 74, 15.5, 8, 5.5),
        compact('score.delta', 82.5, 15.5, 5, 5.5),
        compact('team.opp.name', 88, 13, 10, 2.4),
        compact('score.opp', 88, 15.5, 10, 5.5),
        compact('meta.live', 82.5, 13, 5, 2.2),
        compact('meta.week', 74, 13, 5, 2.2, { hidden: true }),
        compact('meta.league', 74, 13, 12, 2.2, { hidden: true }),
        compact('col.opp.pos', 1.5, 22, 2, 52),
        compact('col.opp.name', 3.5, 22, 6, 52),
        compact('col.opp.nfl', 1.5, 22, 3, 52, { hidden: true }),
        compact('col.opp.pts', 9.5, 22, 3, 52),
        compact('col.mine.pos', 87.5, 22, 2, 52),
        compact('col.mine.name', 89.5, 22, 6, 52),
        compact('col.mine.nfl', 87.5, 22, 3, 52, { hidden: true }),
        compact('col.mine.pts', 95.5, 22, 3, 52),
        compact('toast.slot', 74, 76, 24, 6),
        compact('bench.mine', 87.5, 22, 12, 8, { hidden: true }),
        compact('bench.opp', 1.5, 22, 12, 8, { hidden: true })
      ])
    case 'ticket':
      return layout('ticket', [
        compact('team.mine.name', 2, 14, 8, 2.4),
        compact('score.mine', 2, 16.5, 8, 5.5),
        compact('score.delta', 10.5, 16.5, 5, 5.5),
        compact('team.opp.name', 16, 14, 8, 2.4),
        compact('score.opp', 16, 16.5, 8, 5.5),
        compact('meta.live', 24.5, 16.5, 5, 2.2),
        compact('meta.week', 2, 14, 5, 2.2, { hidden: true }),
        compact('meta.league', 2, 14, 12, 2.2, { hidden: true }),
        compact('col.mine.pos', 2, 26, 2, 48),
        compact('col.mine.name', 4, 26, 6, 48),
        compact('col.mine.nfl', 2, 26, 3, 48, { hidden: true }),
        compact('col.mine.pts', 10, 26, 3.8, 48),
        compact('col.opp.pos', 2, 26, 2, 48, { hidden: true }),
        compact('col.opp.name', 2, 26, 6, 48, { hidden: true }),
        compact('col.opp.nfl', 2, 26, 3, 48, { hidden: true }),
        compact('col.opp.pts', 2, 26, 3.8, 48, { hidden: true }),
        compact('bench.mine', 2, 26, 12, 8, { hidden: true }),
        compact('bench.opp', 2, 26, 12, 8, { hidden: true }),
        compact('toast.slot', 2, 76, 18, 6)
      ])
    case 'broadcast-l':
      return layout('broadcast-l', [
        box('meta.live', 1.5, 14, 4.5, 2.2),
        box('meta.week', 6.2, 14, 5, 2.2),
        box('meta.league', 1.5, 14, 12, 2.2, { hidden: true }),
        box('team.mine.name', 1.5, 16.5, 11, 2.4),
        box('score.mine', 1.5, 19, 11, 6),
        box('score.delta', 1.5, 74, 11, 4),
        box('col.mine.pos', 1.5, 27, 2, 46),
        box('col.mine.name', 3.5, 27, 6, 46),
        box('col.mine.nfl', 9.5, 27, 3, 46, { hidden: true }),
        box('col.mine.pts', 9.5, 27, 3, 46),
        box('team.opp.name', 87.5, 16.5, 11, 2.4),
        box('score.opp', 87.5, 19, 11, 6),
        box('col.opp.pts', 87.5, 27, 3, 46),
        box('col.opp.name', 90.5, 27, 6, 46),
        box('col.opp.nfl', 96.5, 27, 2, 46, { hidden: true }),
        box('col.opp.pos', 96.5, 27, 2, 46),
        box('toast.slot', 1.5, 79, 20, 5),
        box('bench.mine', 1.5, 68, 11, 8, { hidden: true }),
        box('bench.opp', 87.5, 68, 11, 8, { hidden: true })
      ])
    case 'corners':
      return layout('corners', [
        box('score.mine', 2, 14, 10, 7),
        box('team.mine.name', 2, 21.2, 10, 2.4),
        box('score.delta', 2, 23.8, 10, 3.5),
        box('score.opp', 88, 14, 10, 7),
        box('team.opp.name', 88, 21.2, 10, 2.4),
        box('meta.live', 88, 23.8, 5, 2.2),
        box('meta.week', 93.2, 23.8, 4.8, 2.2),
        box('col.mine.pos', 1.5, 28, 2, 44),
        box('col.mine.name', 3.5, 28, 6, 44),
        box('col.mine.nfl', 9.5, 28, 3.5, 44, { hidden: true }),
        box('col.mine.pts', 9.5, 28, 3.5, 44),
        box('col.opp.pts', 87, 28, 3.5, 44),
        box('col.opp.name', 90.5, 28, 6, 44),
        box('col.opp.nfl', 96.5, 28, 2, 44, { hidden: true }),
        box('col.opp.pos', 96.5, 28, 2, 44),
        box('meta.league', 2, 73, 16, 2.2, { hidden: true }),
        box('toast.slot', 2, 76, 16, 6),
        box('bench.mine', 1.5, 64, 12, 8, { hidden: true }),
        box('bench.opp', 86, 64, 12, 8, { hidden: true })
      ])
    case 'pip':
      return layout('pip', [
        box('meta.league', 78, 14, 12, 2.2),
        box('meta.live', 90.5, 14, 7.5, 2.2),
        box('meta.week', 78, 14, 6, 2.2, { hidden: true }),
        box('team.mine.name', 78, 16.5, 10, 2.2),
        box('score.mine', 78, 18.8, 10, 5),
        box('score.delta', 88.5, 18.8, 4.5, 5),
        box('team.opp.name', 93.2, 16.5, 4.8, 2.2),
        box('score.opp', 93.2, 18.8, 4.8, 5),
        box('col.mine.pos', 78, 25, 2, 46),
        box('col.mine.name', 80, 25, 5.5, 46),
        box('col.mine.nfl', 85.5, 25, 3, 46, { hidden: true }),
        box('col.mine.pts', 85.5, 25, 3.2, 46),
        box('col.opp.pts', 88.8, 25, 2.8, 46),
        box('col.opp.name', 91.6, 25, 5, 46),
        box('col.opp.nfl', 96.6, 25, 1.9, 46, { hidden: true }),
        box('col.opp.pos', 96.6, 25, 1.9, 46),
        box('toast.slot', 78, 74, 20, 8),
        box('bench.mine', 78, 64, 10, 8, { hidden: true }),
        box('bench.opp', 88.8, 64, 9.2, 8, { hidden: true })
      ])
    case 'minimal':
      return layout('minimal', [
        box('score.mine', 78, 14, 8, 7),
        box('team.mine.name', 78, 21.2, 8, 2.4),
        box('score.delta', 86.5, 14, 5, 7),
        box('score.opp', 92, 14, 6, 7),
        box('team.opp.name', 92, 21.2, 6, 2.4),
        box('meta.live', 86.5, 21.2, 5, 2.4),
        box('meta.week', 78, 14, 8, 3, { hidden: true }),
        box('meta.league', 78, 14, 18, 3, { hidden: true }),
        box('toast.slot', 78, 14, 20, 8, { hidden: true }),
        box('col.mine.pos', 78, 25, 2.5, 46, { hidden: true }),
        box('col.mine.name', 80.5, 25, 6, 46, { hidden: true }),
        box('col.mine.nfl', 86.5, 25, 3.5, 46, { hidden: true }),
        box('col.mine.pts', 86.5, 25, 3.5, 46, { hidden: true }),
        box('col.opp.pos', 96, 25, 2.5, 46, { hidden: true }),
        box('col.opp.name', 87, 25, 6, 46, { hidden: true }),
        box('col.opp.nfl', 83, 25, 3.5, 46, { hidden: true }),
        box('col.opp.pts', 82.3, 25, 4.5, 46, { hidden: true }),
        box('bench.mine', 78, 60, 10, 8, { hidden: true }),
        box('bench.opp', 88, 60, 10, 8, { hidden: true })
      ])
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
    : 'redzone'

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

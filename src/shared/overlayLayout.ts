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
    case 'redzone':
    case 'national':
    case 'ticket':
    case 'minimal':
    case 'broadcast-l':
    case 'corners':
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

const SMOKE = 0.16

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

const hide = (
  id: OverlayWidgetId,
  x: number,
  y: number,
  w = 12,
  h = 6
): OverlayWidgetInstance => compact(id, x, y, w, h, { hidden: true })

const stackedLeft = (): OverlayWidgetInstance[] => [
  compact('meta.live', 14.8, 14.2, 1.2, 1.2),
  compact('team.mine.name', 1.5, 14, 13, 2.2),
  compact('score.mine', 1.5, 16.4, 8.4, 5.4),
  compact('score.delta', 10.2, 17.4, 4.2, 3.6),
  compact('col.mine.pos', 1.5, 22, 3.5, 26),
  compact('col.mine.name', 5, 22, 7, 26),
  compact('col.mine.pts', 12, 22, 4.2, 26),
  compact('team.opp.name', 1.5, 50, 14.7, 2.2),
  compact('score.opp', 1.5, 52.4, 14.7, 3.4),
  compact('col.opp.pos', 1.5, 56, 3.5, 24),
  compact('col.opp.name', 5, 56, 7, 24),
  compact('col.opp.pts', 12, 56, 4.2, 24),
  hide('meta.league', 1.5, 22),
  hide('meta.week', 1.5, 22, 5, 2),
  hide('col.mine.nfl', 12, 22, 4.2, 26),
  hide('col.opp.nfl', 12, 56, 4.2, 24),
  hide('bench.mine', 1.5, 22),
  hide('bench.opp', 1.5, 56),
  hide('toast.slot', 1.5, 22)
]

const dualRails = (mineX: number, oppX: number, scoreH: number): OverlayWidgetInstance[] => {
  const railH = 52
  const railY = 22
  const nameY = 13
  const scoreY = 15.4
  return [
    compact('meta.live', mineX + 12.2, nameY + 0.2, 1.2, 1.2),
    compact('team.opp.name', oppX, nameY, 14.5, 2.2),
    compact('score.opp', oppX, scoreY, 14.5, scoreH),
    compact('col.opp.pos', oppX, railY, 3.5, railH),
    compact('col.opp.name', oppX + 3.5, railY, 7, railH),
    compact('col.opp.pts', oppX + 10.5, railY, 4, railH),
    compact('team.mine.name', mineX, nameY, 13.5, 2.2),
    compact('score.mine', mineX, scoreY, 9, scoreH),
    compact('score.delta', mineX + 9.2, scoreY + 1, 4.2, 3.6),
    compact('col.mine.pos', mineX, railY, 3.5, railH),
    compact('col.mine.name', mineX + 3.5, railY, 7, railH),
    compact('col.mine.pts', mineX + 10.5, railY, 4, railH),
    hide('meta.league', mineX, railY),
    hide('meta.week', mineX, railY, 5, 2),
    hide('col.mine.nfl', mineX + 10.5, railY, 4, railH),
    hide('col.opp.nfl', oppX + 10.5, railY, 4, railH),
    hide('bench.mine', mineX, railY),
    hide('bench.opp', oppX, railY),
    hide('toast.slot', mineX, railY)
  ]
}

const redzoneWidgets = (): OverlayWidgetInstance[] => stackedLeft()

export const layoutFromPreset = (presetId: OverlayPresetId): OverlayLayout => {
  switch (presetId) {
    case 'redzone':
      return layout('redzone', redzoneWidgets())
    case 'user.1':
      return layout('user.1', redzoneWidgets())
    case 'ticket':
      return layout('ticket', stackedLeft())
    case 'national':
      return layout('national', dualRails(84.5, 1.5, 5.6))
    case 'broadcast-l':
      return layout('broadcast-l', dualRails(84.5, 1.5, 5.6))
    case 'corners':
      return layout('corners', dualRails(84.5, 1.5, 5.6))
    case 'pip':
      return layout('pip', [
        compact('meta.live', 96.8, 14.2, 1.2, 1.2),
        compact('team.mine.name', 78, 14, 18, 2),
        compact('score.mine', 78, 16.2, 12, 4),
        compact('score.delta', 90.5, 16.6, 6.5, 3.2),
        compact('col.mine.pos', 78, 21, 3.5, 26),
        compact('col.mine.name', 81.5, 21, 7, 26),
        compact('col.mine.pts', 88.5, 21, 9.5, 26),
        compact('team.opp.name', 78, 50, 20, 2),
        compact('score.opp', 78, 52.2, 20, 3.6),
        compact('col.opp.pos', 78, 56.2, 3.5, 24),
        compact('col.opp.name', 81.5, 56.2, 7, 24),
        compact('col.opp.pts', 88.5, 56.2, 9.5, 24),
        hide('meta.league', 78, 21),
        hide('meta.week', 78, 21, 5, 2),
        hide('col.mine.nfl', 88.5, 21, 9.5, 26),
        hide('col.opp.nfl', 88.5, 56.2, 9.5, 24),
        hide('bench.mine', 78, 21),
        hide('bench.opp', 78, 56.2),
        hide('toast.slot', 78, 21)
      ])
    case 'minimal':
      return layout('minimal', [
        compact('meta.live', 86.5, 13.2, 1.2, 1.2),
        compact('team.mine.name', 78, 13, 10, 2.2),
        compact('score.mine', 78, 15.4, 8, 5.6),
        compact('score.delta', 86.4, 16.4, 4.4, 3.6),
        compact('team.opp.name', 91.2, 13, 6.8, 2.2),
        compact('score.opp', 91.2, 15.4, 6.8, 5.6),
        hide('meta.week', 78, 13, 8, 3),
        hide('meta.league', 78, 13, 18, 3),
        hide('toast.slot', 78, 13, 20, 8),
        hide('col.mine.pos', 78, 25, 2.5, 46),
        hide('col.mine.name', 80.5, 25, 6, 46),
        hide('col.mine.nfl', 86.5, 25, 3.5, 46),
        hide('col.mine.pts', 86.5, 25, 3.5, 46),
        hide('col.opp.pos', 96, 25, 2.5, 46),
        hide('col.opp.name', 87, 25, 6, 46),
        hide('col.opp.nfl', 83, 25, 3.5, 46),
        hide('col.opp.pts', 82.3, 25, 4.5, 46),
        hide('bench.mine', 78, 60, 10, 8),
        hide('bench.opp', 88, 60, 10, 8)
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

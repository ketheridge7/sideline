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
  'national',
  'redzone',
  'ticket',
  'minimal',
  'broadcast-l',
  'corners',
  'pip',
  'user.1'
] as const

export type OverlayPresetId = (typeof OVERLAY_PRESET_IDS)[number]

export const DEFAULT_OVERLAY_PRESET: OverlayPresetId = 'national'

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
  national: 'Tape rails',
  redzone: 'RedZone',
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

/** Names/scores float on the broadcast — text shadow, no pane. */
const GHOST = 0
/** Rail columns get a whisper of wash so rows stay readable without a card. */
const SMOKE = 0.05
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
): OverlayWidgetInstance => box(id, x, y, w, h, { opacity: SMOKE, density })

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
  ghost('meta.live', 14.8, 14.2, 1.2, 1.2),
  ghost('team.mine.name', 1.5, 14, 13, 2.6),
  ghost('score.mine', 1.5, 16.8, 8.4, 6.2),
  ghost('score.delta', 10.2, 18, 4.2, 4),
  railCol('col.mine.pos', 1.5, 23.2, 3.5, 25),
  railCol('col.mine.name', 5, 23.2, 7.2, 25),
  railCol('col.mine.pts', 12.2, 23.2, 4, 25),
  ghost('team.opp.name', 1.5, 50, 14.7, 2.6),
  ghost('score.opp', 1.5, 52.8, 14.7, 4.2),
  railCol('col.opp.pos', 1.5, 57.2, 3.5, 22.8),
  railCol('col.opp.name', 5, 57.2, 7.2, 22.8),
  railCol('col.opp.pts', 12.2, 57.2, 4, 22.8),
  hide('meta.league', 1.5, 22),
  hide('meta.week', 1.5, 22, 5, 2),
  hide('col.mine.nfl', 12, 22, 4.2, 26),
  hide('col.opp.nfl', 12, 56, 4.2, 24),
  hide('bench.mine', 1.5, 22),
  hide('bench.opp', 1.5, 56),
  hide('toast.slot', 1.5, 22)
]

const dualRails = (mineX: number, oppX: number, scoreH: number): OverlayWidgetInstance[] => {
  const density: OverlayDensity = 'regular'
  const posW = 3.2
  const nameW = 9.2
  const ptsW = 4.4
  const railW = posW + nameW + ptsW
  const railH = 58
  const railY = 23.2
  const nameY = 10
  const nameH = 3.4
  const scoreY = 13.6
  return [
    ghost('meta.live', mineX + railW - 1.2, nameY + 0.2, 1.2, 1.2, density),
    ghost('team.opp.name', oppX, nameY, railW, nameH, density),
    ghost('score.opp', oppX, scoreY, railW, scoreH, density),
    railCol('col.opp.pos', oppX, railY, posW, railH, density),
    railCol('col.opp.name', oppX + posW, railY, nameW, railH, density),
    railCol('col.opp.pts', oppX + posW + nameW, railY, ptsW, railH, density),
    ghost('team.mine.name', mineX, nameY, railW - 1.4, nameH, density),
    ghost('score.mine', mineX, scoreY, 11.2, scoreH, density),
    ghost('score.delta', mineX + 11.4, scoreY + 2, 5.2, 5.4, density),
    railCol('col.mine.pos', mineX, railY, posW, railH, density),
    railCol('col.mine.name', mineX + posW, railY, nameW, railH, density),
    railCol('col.mine.pts', mineX + posW + nameW, railY, ptsW, railH, density),
    hide('meta.league', mineX, railY),
    hide('meta.week', mineX, railY, 5, 2),
    hide('col.mine.nfl', mineX + posW + nameW, railY, ptsW, railH),
    hide('col.opp.nfl', oppX + posW + nameW, railY, ptsW, railH),
    hide('bench.mine', mineX, railY),
    hide('bench.opp', oppX, railY),
    hide('toast.slot', mineX, railY)
  ]
}

const tapeRails = (): OverlayWidgetInstance[] => dualRails(82, 1.2, 9)

const redzoneWidgets = (): OverlayWidgetInstance[] => stackedLeft()

export const layoutFromPreset = (presetId: OverlayPresetId): OverlayLayout => {
  switch (presetId) {
    case 'redzone':
      return layout('redzone', redzoneWidgets())
    case 'user.1':
      return layout('user.1', tapeRails())
    case 'ticket':
      return layout('ticket', stackedLeft())
    case 'national':
      return layout('national', tapeRails())
    case 'broadcast-l':
      return layout('broadcast-l', tapeRails())
    case 'corners':
      return layout('corners', tapeRails())
    case 'pip':
      return layout('pip', [
        ghost('meta.live', 96.8, 14.2, 1.2, 1.2),
        ghost('team.mine.name', 78, 14, 18, 2.4),
        ghost('score.mine', 78, 16.6, 12, 5),
        ghost('score.delta', 90.5, 17.2, 6.5, 3.6),
        railCol('col.mine.pos', 78, 22.2, 3.5, 26),
        railCol('col.mine.name', 81.5, 22.2, 7.4, 26),
        railCol('col.mine.pts', 88.9, 22.2, 9.1, 26),
        ghost('team.opp.name', 78, 50, 20, 2.4),
        ghost('score.opp', 78, 52.6, 20, 4.4),
        railCol('col.opp.pos', 78, 57.2, 3.5, 22.8),
        railCol('col.opp.name', 81.5, 57.2, 7.4, 22.8),
        railCol('col.opp.pts', 88.9, 57.2, 9.1, 22.8),
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
        ghost('meta.live', 86.5, 13.2, 1.2, 1.2),
        ghost('team.mine.name', 78, 13, 10, 2.6),
        ghost('score.mine', 78, 15.8, 8, 6.4),
        ghost('score.delta', 86.4, 16.8, 4.4, 4.2),
        ghost('team.opp.name', 91.2, 13, 6.8, 2.6),
        ghost('score.opp', 91.2, 15.8, 6.8, 6.4),
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
    : DEFAULT_OVERLAY_PRESET

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

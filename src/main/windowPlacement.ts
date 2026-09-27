/**
 * Window positions are stored relative to a display, in DIPs.
 *
 * Electron's `BrowserWindow` bounds and `screen` display rectangles are DIPs,
 * not physical pixels. `scaleFactor` is recorded so a DPI change can be told
 * apart from a resolution change, but it is not a size multiplier: a 1440×900
 * DIP window is 1440×900 on both a 100% display and a 150% display.
 *
 * On Windows, `setBounds` while the window still belongs to a display with a
 * different scaleFactor is interpreted in the old DIP space and then scaled
 * again by the OS, so the window jumps or grows. `crossDpiApplyPlan` moves
 * the window onto the destination display first and only then sets the size.
 */

export type DipRect = {
  x: number
  y: number
  width: number
  height: number
}

export type DisplaySnapshot = {
  id: number
  bounds: DipRect
  workArea: DipRect
  /** 1 = 100%, 1.25 = 125%, 1.5 = 150%. */
  scaleFactor: number
  primary: boolean
}

export type AnchorSpace = 'workArea' | 'bounds'

export type WindowAnchor =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right'

/** v1 placement. `legacyRect` is only present while an absolute-bounds save is migrated. */
export type SavedWindowPlacement = {
  v: 1
  displayId: number
  displayBounds: DipRect
  displayWorkArea: DipRect
  scaleFactor: number
  /** 0 = flush start, 1 = flush end, within the free space of the anchor rect. */
  anchorX: number
  anchorY: number
  width: number
  height: number
  anchorSpace: AnchorSpace
  /** HUD overlay: cover the display bounds instead of remembering a floating size. */
  fill?: boolean
  legacyRect?: DipRect
}

export type WindowPlacements = {
  companion: SavedWindowPlacement | null
  overlay: SavedWindowPlacement | null
}

export type PlacementConstraints = {
  minWidth: number
  minHeight: number
  defaultWidth: number
  defaultHeight: number
  anchorSpace: AnchorSpace
  fill?: boolean
}

export type PlacementState = {
  placements: WindowPlacements
  overlayDisplayId: number | null
}

export type ApplyStep =
  | { op: 'bounds'; bounds: DipRect }
  | { op: 'position'; x: number; y: number }
  | { op: 'size'; width: number; height: number }

export type DisplayChangeReason = 'added' | 'removed' | 'metrics'

export type PlacementHost = {
  getBounds: () => DipRect
  setBounds: (bounds: DipRect) => void
  setPosition: (x: number, y: number) => void
  setSize: (width: number, height: number) => void
  isDestroyed: () => boolean
  on: (event: 'moved' | 'resized' | 'close', listener: () => void) => void
}

export type PlacementStore = {
  load: () => PlacementState
  save: (patch: { placements: WindowPlacements; overlayDisplayId?: number | null }) => void
}

export type Timer = {
  set: (fn: () => void, ms: number) => unknown
  clear: (handle: unknown) => void
}

export type PlacementBinding = {
  applySaved: () => void
  reconcile: (reason: DisplayChangeReason) => void
  flush: () => void
  dispose: () => void
}

export type ElectronDisplayLike = {
  id: number
  bounds: DipRect
  workArea: DipRect
  scaleFactor: number
}

export const WINDOW_PLACEMENT_DEBOUNCE_MS = 300
export const DPI_SETTLE_MS = 50

/** A display resize past this ratio is large enough to scale the saved DIP size. */
const SIZE_CHANGE_RATIO = 1.5

export const COMPANION_CONSTRAINTS: PlacementConstraints = {
  minWidth: 1100,
  minHeight: 700,
  defaultWidth: 1440,
  defaultHeight: 900,
  anchorSpace: 'workArea'
}

export const OVERLAY_CONSTRAINTS: PlacementConstraints = {
  minWidth: 1,
  minHeight: 1,
  defaultWidth: 1,
  defaultHeight: 1,
  anchorSpace: 'bounds',
  fill: true
}

export const ESPN_LOGIN_SIZE = { width: 980, height: 760 }

const ZERO_RECT: DipRect = { x: 0, y: 0, width: 0, height: 0 }

const systemTimer = (): Timer => ({
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => {
    clearTimeout(handle as ReturnType<typeof setTimeout>)
  }
})

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

export const emptyWindowPlacements = (): WindowPlacements => ({ companion: null, overlay: null })

const copyRect = (rect: DipRect): DipRect => ({
  x: rect.x,
  y: rect.y,
  width: rect.width,
  height: rect.height
})

export const roundRect = (rect: DipRect): DipRect => ({
  x: Math.round(rect.x),
  y: Math.round(rect.y),
  width: Math.max(1, Math.round(rect.width)),
  height: Math.max(1, Math.round(rect.height))
})

const rectsNear = (left: DipRect, right: DipRect, tolerance: number): boolean =>
  Math.abs(left.x - right.x) <= tolerance &&
  Math.abs(left.y - right.y) <= tolerance &&
  Math.abs(left.width - right.width) <= tolerance &&
  Math.abs(left.height - right.height) <= tolerance

const parseRect = (raw: unknown): DipRect | null => {
  const rec = asRecord(raw)
  if (!rec || !finite(rec.x) || !finite(rec.y) || !finite(rec.width) || !finite(rec.height)) return null
  if (rec.width < 0 || rec.height < 0) return null
  return { x: rec.x, y: rec.y, width: rec.width, height: rec.height }
}

const parseAnchorSpace = (value: unknown): AnchorSpace | null => {
  if (value === 'workArea' || value === 'bounds') return value
  return null
}

const legacyAbsolute = (raw: Record<string, unknown>, anchorSpace: AnchorSpace): SavedWindowPlacement | null => {
  const rect = parseRect(raw)
  if (!rect || rect.width < 1 || rect.height < 1) return null
  return {
    v: 1,
    displayId: -1,
    displayBounds: copyRect(ZERO_RECT),
    displayWorkArea: copyRect(ZERO_RECT),
    scaleFactor: 1,
    anchorX: 0,
    anchorY: 0,
    width: rect.width,
    height: rect.height,
    anchorSpace,
    legacyRect: rect
  }
}

const parseOne = (raw: unknown): SavedWindowPlacement | null => {
  const rec = asRecord(raw)
  if (!rec) return null
  const displayId = finite(rec.displayId) ? rec.displayId : null
  const anchorSpace = parseAnchorSpace(rec.anchorSpace)
  if (displayId == null || anchorSpace == null) return legacyAbsolute(rec, anchorSpace ?? 'workArea')
  const displayBounds = parseRect(rec.displayBounds)
  const displayWorkArea = parseRect(rec.displayWorkArea)
  if (!displayBounds || !displayWorkArea) return legacyAbsolute(rec, anchorSpace)
  if (!finite(rec.scaleFactor) || rec.scaleFactor <= 0) return null
  if (!finite(rec.anchorX) || !finite(rec.anchorY) || !finite(rec.width) || !finite(rec.height)) return null
  if (rec.width < 0 || rec.height < 0) return null
  const legacyRect = parseRect(rec.legacyRect)
  const placement: SavedWindowPlacement = {
    v: 1,
    displayId,
    displayBounds,
    displayWorkArea,
    scaleFactor: rec.scaleFactor,
    anchorX: rec.anchorX,
    anchorY: rec.anchorY,
    width: rec.width,
    height: rec.height,
    anchorSpace
  }
  if (rec.fill === true) placement.fill = true
  if (legacyRect) placement.legacyRect = legacyRect
  return placement
}

export const parseWindowPlacements = (raw: unknown): WindowPlacements => {
  const rec = asRecord(raw)
  if (!rec) return emptyWindowPlacements()
  return {
    companion: parseOne(rec.companion),
    overlay: parseOne(rec.overlay)
  }
}

/** Older builds stored only `overlayDisplayId`. Treat that as "fill this display". */
export const migrateOverlayDisplayId = (id: number | null): SavedWindowPlacement | null => {
  if (id == null || !Number.isFinite(id)) return null
  return {
    v: 1,
    displayId: id,
    displayBounds: copyRect(ZERO_RECT),
    displayWorkArea: copyRect(ZERO_RECT),
    scaleFactor: 1,
    anchorX: 0,
    anchorY: 0,
    width: 0,
    height: 0,
    anchorSpace: 'bounds',
    fill: true
  }
}

export const displaysFromElectron = (
  all: readonly ElectronDisplayLike[],
  primaryId: number
): DisplaySnapshot[] =>
  all.map((display) => ({
    id: display.id,
    bounds: copyRect(display.bounds),
    workArea: copyRect(display.workArea),
    scaleFactor: finite(display.scaleFactor) && display.scaleFactor > 0 ? display.scaleFactor : 1,
    primary: display.id === primaryId
  }))

const intersectionArea = (left: DipRect, right: DipRect): number => {
  const x = Math.max(left.x, right.x)
  const y = Math.max(left.y, right.y)
  const rightEdge = Math.min(left.x + left.width, right.x + right.width)
  const bottom = Math.min(left.y + left.height, right.y + right.height)
  if (rightEdge <= x || bottom <= y) return 0
  return (rightEdge - x) * (bottom - y)
}

const centerOf = (rect: DipRect): { x: number; y: number } => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2
})

const distance2 = (left: { x: number; y: number }, right: { x: number; y: number }): number => {
  const dx = left.x - right.x
  const dy = left.y - right.y
  return dx * dx + dy * dy
}

export const primaryDisplay = (displays: readonly DisplaySnapshot[]): DisplaySnapshot | null => {
  if (displays.length === 0) return null
  return (
    displays.find((display) => display.primary) ??
    displays.find((display) => display.bounds.x === 0 && display.bounds.y === 0) ??
    displays[0]
  )
}

/** Display with the largest overlap, matching Electron's `getDisplayMatching`. */
export const displayContaining = (
  rect: DipRect,
  displays: readonly DisplaySnapshot[]
): DisplaySnapshot | null => {
  let best: DisplaySnapshot | null = null
  let bestArea = 0
  for (const display of displays) {
    const area = intersectionArea(rect, display.bounds)
    if (area > bestArea) {
      best = display
      bestArea = area
    }
  }
  if (best) return best
  if (displays.length === 0) return null
  const point = centerOf(rect)
  let nearest = displays[0]
  let nearestDist = distance2(point, centerOf(nearest.bounds))
  for (const display of displays.slice(1)) {
    const dist = distance2(point, centerOf(display.bounds))
    if (dist < nearestDist) {
      nearest = display
      nearestDist = dist
    }
  }
  return nearest
}

const spaceOf = (display: DisplaySnapshot, space: AnchorSpace): DipRect => {
  switch (space) {
    case 'workArea':
      return display.workArea
    case 'bounds':
      return display.bounds
    default: {
      const _never: never = space
      return _never
    }
  }
}

const savedSpace = (saved: SavedWindowPlacement): DipRect => spaceOf(
  {
    id: saved.displayId,
    bounds: saved.displayBounds,
    workArea: saved.displayWorkArea,
    scaleFactor: saved.scaleFactor,
    primary: false
  },
  saved.anchorSpace
)

const anchorFraction = (anchor: WindowAnchor): { x: number; y: number } => {
  switch (anchor) {
    case 'top-left':
      return { x: 0, y: 0 }
    case 'top':
      return { x: 0.5, y: 0 }
    case 'top-right':
      return { x: 1, y: 0 }
    case 'left':
      return { x: 0, y: 0.5 }
    case 'center':
      return { x: 0.5, y: 0.5 }
    case 'right':
      return { x: 1, y: 0.5 }
    case 'bottom-left':
      return { x: 0, y: 1 }
    case 'bottom':
      return { x: 0.5, y: 1 }
    case 'bottom-right':
      return { x: 1, y: 1 }
    default: {
      const _never: never = anchor
      return _never
    }
  }
}

const changedALot = (from: DipRect, to: DipRect): boolean => {
  if (from.width <= 0 || from.height <= 0 || to.width <= 0 || to.height <= 0) return false
  const widthRatio = to.width / from.width
  const heightRatio = to.height / from.height
  return (
    widthRatio >= SIZE_CHANGE_RATIO ||
    widthRatio <= 1 / SIZE_CHANGE_RATIO ||
    heightRatio >= SIZE_CHANGE_RATIO ||
    heightRatio <= 1 / SIZE_CHANGE_RATIO
  )
}

const fitSize = (
  width: number,
  height: number,
  space: DipRect,
  constraints: PlacementConstraints
): { width: number; height: number } => {
  const maxW = Math.max(1, Math.floor(space.width))
  const maxH = Math.max(1, Math.floor(space.height))
  let nextW = finite(width) && width > 0 ? width : constraints.defaultWidth
  let nextH = finite(height) && height > 0 ? height : constraints.defaultHeight
  if (maxW >= constraints.minWidth) nextW = Math.max(nextW, constraints.minWidth)
  if (maxH >= constraints.minHeight) nextH = Math.max(nextH, constraints.minHeight)
  return {
    width: Math.max(1, Math.min(Math.round(nextW), maxW)),
    height: Math.max(1, Math.min(Math.round(nextH), maxH))
  }
}

export const clampFullyOnScreen = (rect: DipRect, space: DipRect): DipRect => {
  const width = Math.min(Math.max(1, Math.round(rect.width)), Math.max(1, Math.floor(space.width)))
  const height = Math.min(Math.max(1, Math.round(rect.height)), Math.max(1, Math.floor(space.height)))
  const minX = Math.round(space.x)
  const minY = Math.round(space.y)
  const maxX = Math.round(space.x + Math.max(0, space.width - width))
  const maxY = Math.round(space.y + Math.max(0, space.height - height))
  return {
    x: clamp(Math.round(rect.x), Math.min(minX, maxX), Math.max(minX, maxX)),
    y: clamp(Math.round(rect.y), Math.min(minY, maxY), Math.max(minY, maxY)),
    width,
    height
  }
}

const coverage = (rect: DipRect, areas: readonly DipRect[]): number => {
  const area = rect.width * rect.height
  if (area <= 0) return 0
  let covered = 0
  for (const space of areas) covered += intersectionArea(rect, space)
  return Math.min(1, covered / area)
}

const hits = (rect: DipRect, areas: readonly DipRect[]): number =>
  areas.reduce((count, space) => count + (intersectionArea(rect, space) > 0 ? 1 : 0), 0)

export const capturePlacement = (
  bounds: DipRect,
  displays: readonly DisplaySnapshot[],
  options: { anchorSpace: AnchorSpace; fill?: boolean }
): SavedWindowPlacement | null => {
  const display = displayContaining(bounds, displays)
  if (!display) return null
  if (options.fill) {
    return {
      v: 1,
      displayId: display.id,
      displayBounds: copyRect(display.bounds),
      displayWorkArea: copyRect(display.workArea),
      scaleFactor: display.scaleFactor,
      anchorX: 0,
      anchorY: 0,
      width: Math.round(display.bounds.width),
      height: Math.round(display.bounds.height),
      anchorSpace: 'bounds',
      fill: true
    }
  }
  const space = spaceOf(display, options.anchorSpace)
  const width = Math.max(1, Math.round(bounds.width))
  const height = Math.max(1, Math.round(bounds.height))
  const freeX = space.width - width
  const freeY = space.height - height
  const anchorX = freeX > 1 ? clamp((bounds.x - space.x) / freeX, 0, 1) : 0
  const anchorY = freeY > 1 ? clamp((bounds.y - space.y) / freeY, 0, 1) : 0
  return {
    v: 1,
    displayId: display.id,
    displayBounds: copyRect(display.bounds),
    displayWorkArea: copyRect(display.workArea),
    scaleFactor: display.scaleFactor,
    anchorX,
    anchorY,
    width,
    height,
    anchorSpace: options.anchorSpace
  }
}

const nearestDisplay = (displays: readonly DisplaySnapshot[], rect: DipRect): DisplaySnapshot => {
  const point = centerOf(rect)
  let nearest = displays[0]
  let nearestDist = distance2(point, centerOf(nearest.bounds))
  for (const display of displays.slice(1)) {
    const dist = distance2(point, centerOf(display.bounds))
    if (dist < nearestDist) {
      nearest = display
      nearestDist = dist
    }
  }
  return nearest
}

/** id, then a unique bounds+scale signature, then the nearest display, then primary. */
export const resolveDisplay = (
  saved: Pick<SavedWindowPlacement, 'displayId' | 'displayBounds' | 'scaleFactor'> | null,
  displays: readonly DisplaySnapshot[]
): DisplaySnapshot | null => {
  if (displays.length === 0) return null
  if (!saved) return primaryDisplay(displays)
  if (saved.displayId >= 0) {
    const byId = displays.find((display) => display.id === saved.displayId)
    if (byId) return byId
  }
  const signature =
    saved.displayBounds.width > 0 && saved.displayBounds.height > 0
      ? displays.filter(
          (display) =>
            rectsNear(display.bounds, saved.displayBounds, 4) &&
            Math.abs(display.scaleFactor - saved.scaleFactor) <= 0.02
        )
      : []
  if (signature.length === 1) return signature[0]
  if (saved.displayBounds.width > 0 && saved.displayBounds.height > 0) return nearestDisplay(displays, saved.displayBounds)
  return primaryDisplay(displays)
}

const normalizeSaved = (
  saved: SavedWindowPlacement | null,
  displays: readonly DisplaySnapshot[],
  options: { anchorSpace: AnchorSpace; fill?: boolean }
): SavedWindowPlacement | null => {
  if (!saved?.legacyRect) return saved
  if (saved.displayId >= 0 && saved.displayBounds.width > 0) return saved
  return capturePlacement(saved.legacyRect, displays, { anchorSpace: saved.anchorSpace, fill: options.fill || saved.fill }) ?? saved
}

export const restoreBounds = (
  saved: SavedWindowPlacement | null,
  displays: readonly DisplaySnapshot[],
  constraints: PlacementConstraints
): DipRect => {
  const normalized = normalizeSaved(saved, displays, constraints)
  const display = resolveDisplay(normalized, displays)
  if (!display) {
    return {
      x: 0,
      y: 0,
      width: Math.max(1, Math.round(constraints.defaultWidth)),
      height: Math.max(1, Math.round(constraints.defaultHeight))
    }
  }
  if (constraints.fill || normalized?.fill) return roundRect(display.bounds)
  const anchorSpace = normalized?.anchorSpace ?? constraints.anchorSpace
  const space = spaceOf(display, anchorSpace)
  let width = normalized && normalized.width > 0 ? normalized.width : constraints.defaultWidth
  let height = normalized && normalized.height > 0 ? normalized.height : constraints.defaultHeight
  if (normalized) {
    const from = savedSpace(normalized)
    if (changedALot(from, space)) {
      width = Math.round(width * (space.width / from.width))
      height = Math.round(height * (space.height / from.height))
    }
  }
  const fitted = fitSize(width, height, space, constraints)
  const anchorX = normalized ? normalized.anchorX : 0.5
  const anchorY = normalized ? normalized.anchorY : 0.5
  const freeX = Math.max(0, space.width - fitted.width)
  const freeY = Math.max(0, space.height - fitted.height)
  return clampFullyOnScreen(
    {
      x: space.x + clamp(anchorX, 0, 1) * freeX,
      y: space.y + clamp(anchorY, 0, 1) * freeY,
      width: fitted.width,
      height: fitted.height
    },
    space
  )
}

const inset = (rect: DipRect, margin: number): DipRect => {
  const next = margin * 2
  if (rect.width <= next || rect.height <= next) return rect
  return {
    x: rect.x + margin,
    y: rect.y + margin,
    width: rect.width - next,
    height: rect.height - next
  }
}

export const boundsForAnchor = (
  anchor: WindowAnchor,
  display: DisplaySnapshot,
  size: { width: number; height: number },
  options?: { anchorSpace?: AnchorSpace; margin?: number }
): DipRect => {
  const anchorSpace = options?.anchorSpace ?? 'workArea'
  const space = inset(spaceOf(display, anchorSpace), options?.margin ?? 0)
  const fitted = fitSize(size.width, size.height, space, {
    minWidth: 1,
    minHeight: 1,
    defaultWidth: size.width,
    defaultHeight: size.height,
    anchorSpace
  })
  const fraction = anchorFraction(anchor)
  return clampFullyOnScreen(
    {
      x: space.x + fraction.x * Math.max(0, space.width - fitted.width),
      y: space.y + fraction.y * Math.max(0, space.height - fitted.height),
      width: fitted.width,
      height: fitted.height
    },
    space
  )
}

export const placementFromAnchor = (
  anchor: WindowAnchor,
  display: DisplaySnapshot,
  size: { width: number; height: number },
  options?: { anchorSpace?: AnchorSpace; margin?: number; displays?: readonly DisplaySnapshot[] }
): SavedWindowPlacement => {
  const anchorSpace = options?.anchorSpace ?? 'workArea'
  const bounds = boundsForAnchor(anchor, display, size, options)
  const captured = capturePlacement(bounds, options?.displays ?? [display], { anchorSpace })
  if (captured) return captured
  const fraction = anchorFraction(anchor)
  return {
    v: 1,
    displayId: display.id,
    displayBounds: copyRect(display.bounds),
    displayWorkArea: copyRect(display.workArea),
    scaleFactor: display.scaleFactor,
    anchorX: fraction.x,
    anchorY: fraction.y,
    width: bounds.width,
    height: bounds.height,
    anchorSpace
  }
}

/** Keep the anchor fraction and DIP size, but retarget the display the window is on now. */
export const movePlacementToDisplay = (
  saved: SavedWindowPlacement,
  display: DisplaySnapshot
): SavedWindowPlacement => ({
  ...saved,
  displayId: display.id,
  displayBounds: copyRect(display.bounds),
  displayWorkArea: copyRect(display.workArea),
  scaleFactor: display.scaleFactor,
  legacyRect: undefined
})

export const effectivePlacement = (
  role: 'companion' | 'overlay',
  state: PlacementState
): SavedWindowPlacement | null => {
  switch (role) {
    case 'companion':
      return state.placements.companion
    case 'overlay':
      return state.placements.overlay ?? migrateOverlayDisplayId(state.overlayDisplayId)
    default: {
      const _never: never = role
      return _never
    }
  }
}

export const initialWindowBounds = (
  role: 'companion' | 'overlay',
  state: PlacementState,
  displays: readonly DisplaySnapshot[],
  constraints: PlacementConstraints
): DipRect => restoreBounds(effectivePlacement(role, state), displays, constraints)

export const crossDpiApplyPlan = (
  current: DipRect,
  target: DipRect,
  displays: readonly DisplaySnapshot[],
  savedScale?: number
): ApplyStep[] => {
  const rounded = roundRect(target)
  if (rectsNear(current, rounded, 0.5)) return []
  const from = displayContaining(current, displays)
  const to = displayContaining(rounded, displays)
  const toScale = to?.scaleFactor
  const scaleGap =
    (from != null && toScale != null && Math.abs(from.scaleFactor - toScale) > 0.001) ||
    (savedScale != null && toScale != null && Math.abs(savedScale - toScale) > 0.001)
  if (!scaleGap) return [{ op: 'bounds', bounds: rounded }]
  return [
    { op: 'position', x: rounded.x, y: rounded.y },
    { op: 'size', width: rounded.width, height: rounded.height },
    { op: 'position', x: rounded.x, y: rounded.y }
  ]
}

const axisMatchesRatio = (reported: number, intended: number, ratio: number): boolean => {
  const tolerance = Math.max(2, Math.abs(intended) * 0.08)
  return Math.abs(reported - intended * ratio) <= tolerance || Math.abs(reported - intended / ratio) <= tolerance
}

/** True when a just-applied size came back scaled by the DPI ratio and should be set again. */
export const shouldReapplyDipSize = (
  reported: DipRect,
  intended: DipRect,
  fromScale: number,
  toScale: number
): boolean => {
  if (!(fromScale > 0) || !(toScale > 0) || Math.abs(fromScale - toScale) < 0.001) return false
  const ratio = toScale / fromScale
  return axisMatchesRatio(reported.width, intended.width, ratio) && axisMatchesRatio(reported.height, intended.height, ratio)
}

export type ReconcileResult = {
  bounds: DipRect
  placement: SavedWindowPlacement | null
  apply: boolean
}

const contained = (rect: DipRect, space: DipRect, slack: number): boolean =>
  rect.x >= space.x - slack &&
  rect.y >= space.y - slack &&
  rect.x + rect.width <= space.x + space.width + slack &&
  rect.y + rect.height <= space.y + space.height + slack

export const reconcilePlacement = (args: {
  current: DipRect
  saved: SavedWindowPlacement | null
  displays: readonly DisplaySnapshot[]
  constraints: PlacementConstraints
  reason: DisplayChangeReason
}): ReconcileResult => {
  if (args.displays.length === 0) {
    return { bounds: roundRect(args.current), placement: args.saved, apply: false }
  }
  const fill = Boolean(args.constraints.fill || args.saved?.fill)
  if (fill) {
    const bounds = restoreBounds(args.saved, args.displays, { ...args.constraints, fill: true, anchorSpace: 'bounds' })
    const placement =
      capturePlacement(bounds, args.displays, { anchorSpace: 'bounds', fill: true }) ?? args.saved
    return { bounds, placement, apply: !rectsNear(args.current, bounds, 1) }
  }

  const areas = args.displays.map((display) => spaceOf(display, args.constraints.anchorSpace))
  const covered = coverage(args.current, areas)

  if (args.reason === 'metrics' && args.saved) {
    const bounds = restoreBounds(args.saved, args.displays, args.constraints)
    const placement =
      capturePlacement(bounds, args.displays, { anchorSpace: args.constraints.anchorSpace }) ?? args.saved
    return { bounds, placement, apply: !rectsNear(args.current, bounds, 1) }
  }

  if (covered >= 0.98) {
    const home = displayContaining(args.current, args.displays)
    const space = home ? spaceOf(home, args.constraints.anchorSpace) : null
    const spanning = hits(args.current, areas) >= 2
    if (space && !spanning && !contained(args.current, space, 1)) {
      const bounds = clampFullyOnScreen(args.current, space)
      const placement = capturePlacement(bounds, args.displays, { anchorSpace: args.constraints.anchorSpace })
      return { bounds, placement, apply: !rectsNear(args.current, bounds, 1) }
    }
    const placement =
      capturePlacement(args.current, args.displays, { anchorSpace: args.constraints.anchorSpace }) ?? args.saved
    return { bounds: roundRect(args.current), placement, apply: false }
  }

  const bounds = restoreBounds(args.saved, args.displays, args.constraints)
  const placement =
    capturePlacement(bounds, args.displays, { anchorSpace: args.constraints.anchorSpace }) ?? args.saved
  return { bounds, placement, apply: true }
}

const samePlacement = (left: SavedWindowPlacement | null, right: SavedWindowPlacement | null): boolean =>
  JSON.stringify(left) === JSON.stringify(right)

export const attachWindowPlacement = (
  host: PlacementHost,
  opts: {
    role: 'companion' | 'overlay'
    displays: () => readonly DisplaySnapshot[]
    store: PlacementStore
    constraints: PlacementConstraints
    clock?: Timer
    waitMs?: number
    dpiSettleMs?: number
  }
): PlacementBinding => {
  const clock = opts.clock ?? systemTimer()
  const waitMs = opts.waitMs ?? WINDOW_PLACEMENT_DEBOUNCE_MS
  const dpiSettleMs = opts.dpiSettleMs ?? DPI_SETTLE_MS
  let disposed = false
  let applying = false
  let generation = 0
  let timer: unknown = null
  let pendingTarget: DipRect | null = null
  let fillCorrections = 0
  let lastApplied: DipRect | null = null
  let lastFromScale: number | null = null
  let lastToScale: number | null = null
  let dpiCorrections = 0

  const captureOptions = (): { anchorSpace: AnchorSpace; fill?: boolean } => ({
    anchorSpace: opts.constraints.fill ? 'bounds' : opts.constraints.anchorSpace,
    ...(opts.constraints.fill ? { fill: true } : {})
  })

  const readSaved = (): SavedWindowPlacement | null => effectivePlacement(opts.role, opts.store.load())

  const write = (placement: SavedWindowPlacement): void => {
    const state = opts.store.load()
    const prev = opts.role === 'companion' ? state.placements.companion : state.placements.overlay
    const displayId = placement.displayId >= 0 ? placement.displayId : state.overlayDisplayId
    if (samePlacement(prev, placement) && (opts.role !== 'overlay' || state.overlayDisplayId === displayId)) return
    const placements: WindowPlacements = {
      companion: state.placements.companion,
      overlay: state.placements.overlay
    }
    placements[opts.role] = placement
    if (opts.role === 'overlay') {
      opts.store.save({ placements, overlayDisplayId: displayId })
      return
    }
    opts.store.save({ placements })
  }

  const persistRect = (rect: DipRect): void => {
    if (rect.width < 2 || rect.height < 2) return
    const placement = capturePlacement(rect, opts.displays(), captureOptions())
    if (placement) write(placement)
  }

  const clearTimer = (): void => {
    if (timer == null) return
    clock.clear(timer)
    timer = null
  }

  const applyTarget = (target: DipRect, savedScale?: number): void => {
    if (disposed || host.isDestroyed()) return
    clearTimer()
    const displays = opts.displays()
    const current = host.getBounds()
    const plan = crossDpiApplyPlan(current, target, displays, savedScale)
    if (plan.length === 0) return
    const from = displayContaining(current, displays)
    const to = displayContaining(roundRect(target), displays)
    const fromScale = from?.scaleFactor ?? null
    const toScale = to?.scaleFactor ?? null
    const intended = roundRect(target)
    lastApplied = intended
    lastFromScale = fromScale
    lastToScale = toScale
    const token = ++generation
    applying = true
    pendingTarget = intended
    const finish = (): void => {
      if (token !== generation) return
      applying = false
      pendingTarget = null
    }
    const run = (index: number): void => {
      if (disposed || token !== generation || host.isDestroyed()) {
        finish()
        return
      }
      const step = plan[index]
      if (!step) {
        finish()
        return
      }
      switch (step.op) {
        case 'bounds':
          host.setBounds(step.bounds)
          break
        case 'position':
          host.setPosition(step.x, step.y)
          break
        case 'size':
          host.setSize(step.width, step.height)
          if (fromScale != null && toScale != null && shouldReapplyDipSize(host.getBounds(), intended, fromScale, toScale)) {
            host.setSize(intended.width, intended.height)
          }
          break
        default: {
          const _never: never = step
          void _never
        }
      }
      if (index + 1 < plan.length) {
        timer = clock.set(() => {
          timer = null
          run(index + 1)
        }, index === 0 ? dpiSettleMs : 0)
        return
      }
      finish()
    }
    run(0)
  }

  const applySaved = (): void => {
    const saved = readSaved()
    applyTarget(restoreBounds(saved, opts.displays(), opts.constraints), saved?.scaleFactor)
  }

  const schedule = (): void => {
    clearTimer()
    timer = clock.set(() => {
      timer = null
      if (disposed || applying || host.isDestroyed()) return
      persistRect(host.getBounds())
    }, waitMs)
  }

  const onUserGeometry = (): void => {
    if (disposed || applying || host.isDestroyed()) return
    if (
      lastApplied &&
      lastFromScale != null &&
      lastToScale != null &&
      shouldReapplyDipSize(host.getBounds(), lastApplied, lastFromScale, lastToScale)
    ) {
      if (dpiCorrections >= 2) return
      dpiCorrections += 1
      applyTarget(lastApplied, lastFromScale)
      return
    }
    dpiCorrections = 0
    if (opts.constraints.fill) {
      const saved = readSaved()
      const expected = restoreBounds(saved, opts.displays(), opts.constraints)
      if (!rectsNear(host.getBounds(), expected, 2)) {
        // A DPI transition can emit resize with the wrong size. Correct it, but
        // don't chase a window that refuses to take the display bounds.
        if (fillCorrections >= 2) return
        fillCorrections += 1
        applyTarget(expected, saved?.scaleFactor)
        return
      }
      fillCorrections = 0
    }
    schedule()
  }

  host.on('moved', onUserGeometry)
  host.on('resized', onUserGeometry)

  const binding: PlacementBinding = {
    applySaved,
    reconcile: (reason) => {
      if (disposed || host.isDestroyed()) return
      clearTimer()
      const displays = opts.displays()
      const saved = readSaved()
      const result = reconcilePlacement({
        current: host.getBounds(),
        saved,
        displays,
        constraints: opts.constraints,
        reason
      })
      if (result.placement) write(result.placement)
      if (!result.apply) return
      const fresh = readSaved()
      applyTarget(result.bounds, fresh?.scaleFactor ?? saved?.scaleFactor)
    },
    flush: () => {
      clearTimer()
      if (disposed || host.isDestroyed()) return
      if (applying && pendingTarget) {
        persistRect(pendingTarget)
        return
      }
      persistRect(host.getBounds())
    },
    dispose: () => {
      disposed = true
      clearTimer()
    }
  }

  host.on('close', () => {
    binding.flush()
  })
  applySaved()
  return binding
}

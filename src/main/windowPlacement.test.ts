import { describe, expect, it } from 'vitest'
import {
  attachWindowPlacement,
  boundsForAnchor,
  capturePlacement,
  clampFullyOnScreen,
  COMPANION_CONSTRAINTS,
  crossDpiApplyPlan,
  displaysFromElectron,
  emptyWindowPlacements,
  initialWindowBounds,
  migrateOverlayDisplayId,
  movePlacementToDisplay,
  OVERLAY_CONSTRAINTS,
  parseWindowPlacements,
  placementFromAnchor,
  reconcilePlacement,
  restoreBounds,
  shouldReapplyDipSize,
  type DipRect,
  type DisplaySnapshot,
  type PlacementConstraints,
  type PlacementHost,
  type PlacementState,
  type PlacementStore,
  type SavedWindowPlacement,
  type Timer,
  type WindowAnchor
} from './windowPlacement'

/** 1920×1080 at 100%. Taskbar takes 40 DIP off the bottom. */
const primary: DisplaySnapshot = {
  id: 1,
  primary: true,
  scaleFactor: 1,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workArea: { x: 0, y: 0, width: 1920, height: 1040 }
}

/** 2560×1440 physical at 125% → 2048×1152 DIP, to the right of the 1080p panel. */
const qhd125: DisplaySnapshot = {
  id: 2,
  primary: false,
  scaleFactor: 1.25,
  bounds: { x: 1920, y: 0, width: 2048, height: 1152 },
  workArea: { x: 1920, y: 0, width: 2048, height: 1112 }
}

/** 3840×2160 physical at 150% → 2560×1440 DIP, to the left of the primary. */
const uhd150: DisplaySnapshot = {
  id: 3,
  primary: false,
  scaleFactor: 1.5,
  bounds: { x: -2560, y: 0, width: 2560, height: 1440 },
  workArea: { x: -2560, y: 0, width: 2560, height: 1400 }
}

const above: DisplaySnapshot = {
  id: 4,
  primary: false,
  scaleFactor: 1,
  bounds: { x: 0, y: -1080, width: 1920, height: 1080 },
  workArea: { x: 0, y: -1080, width: 1920, height: 1040 }
}

const desk = [primary, qhd125, uhd150]

const loose: PlacementConstraints = {
  minWidth: 100,
  minHeight: 80,
  defaultWidth: 800,
  defaultHeight: 600,
  anchorSpace: 'workArea'
}

const ANCHORS: readonly WindowAnchor[] = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right'
]

const fullyInside = (rect: DipRect, space: DipRect): boolean =>
  rect.x >= space.x - 1 &&
  rect.y >= space.y - 1 &&
  rect.x + rect.width <= space.x + space.width + 1 &&
  rect.y + rect.height <= space.y + space.height + 1

const onQhd = { x: 2100, y: 80, width: 1440, height: 900 }

const manualClock = (): Timer & { flush: () => void; pending: () => number } => {
  let queue: Array<{ fn: () => void; handle: object }> = []
  return {
    set: (fn) => {
      const handle = {}
      queue.push({ fn, handle })
      return handle
    },
    clear: (handle) => {
      queue = queue.filter((item) => item.handle !== handle)
    },
    flush: () => {
      let guard = 0
      while (queue.length > 0 && guard < 20) {
        const due = queue
        queue = []
        for (const item of due) item.fn()
        guard += 1
      }
    },
    pending: () => queue.length
  }
}

const memoryStore = (initial?: Partial<PlacementState>): {
  store: PlacementStore
  state: PlacementState
  saves: () => number
} => {
  const state: PlacementState = {
    placements: initial?.placements ?? emptyWindowPlacements(),
    overlayDisplayId: initial?.overlayDisplayId ?? null
  }
  let saves = 0
  return {
    state,
    saves: () => saves,
    store: {
      load: () => state,
      save: (patch) => {
        saves += 1
        state.placements = patch.placements
        if (patch.overlayDisplayId !== undefined) state.overlayDisplayId = patch.overlayDisplayId
      }
    }
  }
}

const fakeHost = (
  initial: DipRect,
  hooks?: { onSize?: (width: number, height: number, bounds: DipRect) => DipRect }
): {
  host: PlacementHost
  calls: Array<'bounds' | 'position' | 'size'>
  read: () => DipRect
  moveTo: (next: DipRect) => void
  distort: (next: DipRect) => void
  close: () => void
} => {
  let bounds = { ...initial }
  let destroyed = false
  const calls: Array<'bounds' | 'position' | 'size'> = []
  const handlers: Record<'moved' | 'resized' | 'close', Array<() => void>> = {
    moved: [],
    resized: [],
    close: []
  }
  const emit = (event: 'moved' | 'resized'): void => {
    for (const handler of [...handlers[event]]) handler()
  }
  const host: PlacementHost = {
    getBounds: () => ({ ...bounds }),
    setBounds: (next) => {
      calls.push('bounds')
      bounds = { ...next }
      emit('moved')
      emit('resized')
    },
    setPosition: (x, y) => {
      calls.push('position')
      bounds = { ...bounds, x, y }
      emit('moved')
    },
    setSize: (width, height) => {
      calls.push('size')
      bounds = hooks?.onSize ? hooks.onSize(width, height, bounds) : { ...bounds, width, height }
      emit('resized')
    },
    isDestroyed: () => destroyed,
    on: (event, listener) => {
      handlers[event].push(listener)
    }
  }
  return {
    host,
    calls,
    read: () => ({ ...bounds }),
    moveTo: (next) => {
      bounds = { ...next }
      emit('moved')
    },
    distort: (next) => {
      bounds = { ...next }
      emit('resized')
    },
    close: () => {
      for (const handler of [...handlers.close]) handler()
      destroyed = true
    }
  }
}

describe('HUD display restore', () => {
  it('returns the HUD to monitor 2 after a restart instead of the primary', () => {
    const saved = capturePlacement(qhd125.bounds, desk, { anchorSpace: 'bounds', fill: true })
    const bounds = restoreBounds(saved, desk, OVERLAY_CONSTRAINTS)
    expect(bounds).toEqual(qhd125.bounds)
    expect(bounds.x).toBeGreaterThanOrEqual(qhd125.bounds.x)
  })

  it('migrates a legacy overlayDisplayId onto that display', () => {
    const bounds = initialWindowBounds(
      'overlay',
      { placements: emptyWindowPlacements(), overlayDisplayId: qhd125.id },
      desk,
      OVERLAY_CONSTRAINTS
    )
    expect(bounds).toEqual(qhd125.bounds)
    expect(migrateOverlayDisplayId(null)).toBeNull()
  })

  it('follows a renumbered display when the bounds signature still matches', () => {
    const saved = capturePlacement(qhd125.bounds, desk, { anchorSpace: 'bounds', fill: true })
    const renamed = { ...qhd125, id: 77 }
    const bounds = restoreBounds(saved, [primary, renamed], OVERLAY_CONSTRAINTS)
    expect(bounds).toEqual(renamed.bounds)
    expect(saved?.displayId).toBe(2)
  })

  it('covers the full display bounds, including the taskbar strip', () => {
    const bounds = restoreBounds(
      capturePlacement(primary.bounds, [primary], { anchorSpace: 'bounds', fill: true }),
      [primary],
      OVERLAY_CONSTRAINTS
    )
    expect(bounds.height).toBe(primary.bounds.height)
    expect(bounds.height).not.toBe(primary.workArea.height)
  })

  it('fills the display the HUD moved to, which is the viewport Studio corners resolve against', () => {
    const saved = capturePlacement(qhd125.bounds, desk, { anchorSpace: 'bounds', fill: true })
    const viewport = restoreBounds(saved, desk, OVERLAY_CONSTRAINTS)
    const cornerX = viewport.x + viewport.width * 0.012
    expect(cornerX).toBeGreaterThan(primary.bounds.width)
    const moved = movePlacementToDisplay(saved as SavedWindowPlacement, uhd150)
    expect(restoreBounds(moved, desk, OVERLAY_CONSTRAINTS)).toEqual(uhd150.bounds)
  })
})

describe('mixed resolution and DPI', () => {
  it('keeps a DIP size captured on a 125% display when that display is still there', () => {
    const saved = capturePlacement(onQhd, desk, { anchorSpace: 'workArea' })
    expect(saved?.displayId).toBe(qhd125.id)
    expect(saved?.scaleFactor).toBe(1.25)
    expect(saved?.width).toBe(1440)
    const restored = restoreBounds(saved, desk, COMPANION_CONSTRAINTS)
    expect(restored).toEqual(onQhd)
    expect(fullyInside(restored, qhd125.workArea)).toBe(true)
  })

  it('does not multiply DIP size by scaleFactor when the display is at 150%', () => {
    const saved = capturePlacement({ x: 240, y: 70, width: 1440, height: 900 }, [primary], {
      anchorSpace: 'workArea'
    })
    const sameDipsHigherScale = { ...primary, scaleFactor: 1.5 }
    const restored = restoreBounds(saved, [sameDipsHigherScale], COMPANION_CONSTRAINTS)
    expect(restored.width).toBe(1440)
    expect(restored.height).toBe(900)
  })

  it('scales the window when the display DIP size changes by a lot, then keeps it fully on screen', () => {
    const saved = capturePlacement({ x: -2560, y: 40, width: 2000, height: 1100 }, [uhd150], {
      anchorSpace: 'workArea'
    })
    const laptop: DisplaySnapshot = {
      id: 5,
      primary: true,
      scaleFactor: 1,
      bounds: { x: 0, y: 0, width: 1280, height: 720 },
      workArea: { x: 0, y: 0, width: 1280, height: 680 }
    }
    const restored = restoreBounds(saved, [laptop], COMPANION_CONSTRAINTS)
    expect(restored.width).toBeLessThan(2000)
    expect(restored.height).toBeLessThan(1100)
    expect(fullyInside(restored, laptop.workArea)).toBe(true)
  })

  it('places a cross-DPI move as position then size, and a same-DPI move as one setBounds', () => {
    const current = { x: 240, y: 70, width: 1440, height: 900 }
    const target = onQhd
    expect(crossDpiApplyPlan(current, target, desk).map((step) => step.op)).toEqual(['position', 'size', 'position'])
    const sameScale = { ...qhd125, id: 8, scaleFactor: 1 }
    expect(crossDpiApplyPlan(current, { x: 2000, y: 40, width: 1440, height: 900 }, [primary, sameScale])).toEqual([
      { op: 'bounds', bounds: { x: 2000, y: 40, width: 1440, height: 900 } }
    ])
  })

  it('splits the apply when a display scaleFactor changes underneath a saved size', () => {
    const shrunk = {
      ...primary,
      scaleFactor: 1.5,
      bounds: { x: 0, y: 0, width: 1280, height: 720 },
      workArea: { x: 0, y: 0, width: 1280, height: 680 }
    }
    const plan = crossDpiApplyPlan({ x: 0, y: 0, width: 1920, height: 1080 }, shrunk.bounds, [shrunk], 1)
    expect(plan[0]).toEqual({ op: 'position', x: 0, y: 0 })
    expect(plan[1]).toEqual({ op: 'size', width: 1280, height: 720 })
  })

  it('detects a size that came back multiplied by the DPI ratio', () => {
    expect(shouldReapplyDipSize({ x: 1920, y: 0, width: 1800, height: 1125 }, onQhd, 1, 1.25)).toBe(true)
    expect(shouldReapplyDipSize(onQhd, onQhd, 1, 1.25)).toBe(false)
    expect(shouldReapplyDipSize({ x: 0, y: 0, width: 1440, height: 900 }, onQhd, 1.25, 1.25)).toBe(false)
  })

  it('does not persist the grown size from a DPI transition', () => {
    const saved = capturePlacement(onQhd, desk, { anchorSpace: 'workArea' })
    const mem = memoryStore({ placements: { companion: saved, overlay: null } })
    let scaled = 0
    const window = fakeHost(
      { x: 240, y: 70, width: 1440, height: 900 },
      {
        onSize: (width, height, bounds) => {
          scaled += 1
          if (scaled === 1) return { ...bounds, width: Math.round(width * 1.25), height: Math.round(height * 1.25) }
          return { ...bounds, width, height }
        }
      }
    )
    const clock = manualClock()
    attachWindowPlacement(window.host, {
      role: 'companion',
      displays: () => desk,
      store: mem.store,
      constraints: COMPANION_CONSTRAINTS,
      clock,
      waitMs: 300,
      dpiSettleMs: 50
    })
    expect(window.calls[0]).toBe('position')
    expect(window.calls).not.toContain('bounds')
    expect(mem.saves()).toBe(0)
    clock.flush()
    expect(window.read()).toEqual(onQhd)
    expect(mem.saves()).toBe(0)
    expect(mem.state.placements.companion?.width).toBe(1440)
    window.distort({ ...onQhd, width: 1800, height: 1125 })
    clock.flush()
    expect(window.read()).toEqual(onQhd)
    expect(mem.state.placements.companion?.width).toBe(1440)
  })
})

describe('disconnects, rearrangement, and off-screen recovery', () => {
  it('clamps a half-off window fully inside the work area', () => {
    const clamped = clampFullyOnScreen({ x: 1800, y: 100, width: 400, height: 300 }, primary.workArea)
    expect(fullyInside(clamped, primary.workArea)).toBe(true)
    expect(clamped.x + clamped.width).toBeLessThanOrEqual(primary.workArea.width)
  })

  it('pulls a window back from a disconnected monitor instead of leaving it off-screen', () => {
    const saved = capturePlacement(onQhd, desk, { anchorSpace: 'workArea' })
    const stranded = { x: 2400, y: 80, width: 1440, height: 900 }
    const result = reconcilePlacement({
      current: stranded,
      saved,
      displays: [primary],
      constraints: COMPANION_CONSTRAINTS,
      reason: 'removed'
    })
    expect(result.apply).toBe(true)
    expect(fullyInside(result.bounds, primary.workArea)).toBe(true)
    expect(result.bounds.x).toBeLessThan(primary.workArea.width)
  })

  it('falls back to the nearest remaining display, then to the primary when nothing is close', () => {
    const saved = capturePlacement({ x: 5000, y: 10, width: 800, height: 600 }, [
      {
        id: 9,
        primary: false,
        scaleFactor: 1,
        bounds: { x: 4200, y: 0, width: 1600, height: 900 },
        workArea: { x: 4200, y: 0, width: 1600, height: 860 }
      }
    ], { anchorSpace: 'workArea' })
    const restored = restoreBounds(saved, [primary, qhd125], loose)
    expect(restored.x).toBeGreaterThanOrEqual(qhd125.workArea.x)
    expect(fullyInside(restored, qhd125.workArea)).toBe(true)

    const stale = migrateOverlayDisplayId(99)
    expect(restoreBounds(stale, [primary, qhd125], OVERLAY_CONSTRAINTS)).toEqual(primary.bounds)
  })

  it('follows the same display id when the monitors are swapped', () => {
    const saved = capturePlacement(onQhd, [primary, qhd125], { anchorSpace: 'workArea' })
    const swappedQhd: DisplaySnapshot = {
      ...qhd125,
      bounds: { x: 0, y: 0, width: 2048, height: 1152 },
      workArea: { x: 0, y: 0, width: 2048, height: 1112 }
    }
    const swappedPrimary: DisplaySnapshot = {
      ...primary,
      bounds: { x: 2048, y: 0, width: 1920, height: 1080 },
      workArea: { x: 2048, y: 0, width: 1920, height: 1040 }
    }
    const restored = restoreBounds(saved, [swappedPrimary, swappedQhd], COMPANION_CONSTRAINTS)
    expect(restored.x).toBeLessThan(2048)
    expect(fullyInside(restored, swappedQhd.workArea)).toBe(true)
  })

  it('keeps a window on its display when another display becomes primary', () => {
    const saved = capturePlacement({ x: 240, y: 70, width: 1440, height: 900 }, [primary], { anchorSpace: 'workArea' })
    const restored = restoreBounds(saved, [{ ...primary, primary: false }, { ...qhd125, primary: true }], COMPANION_CONSTRAINTS)
    expect(restored.x).toBe(240)
    expect(restored.x).toBeLessThan(qhd125.bounds.x)
  })

  it('re-anchors to the updated work area when resolution changes, and refills the HUD', () => {
    const saved = placementFromAnchor('bottom-right', primary, { width: 1440, height: 900 })
    const taller: DisplaySnapshot = {
      ...primary,
      bounds: { x: 0, y: 0, width: 1920, height: 1440 },
      workArea: { x: 0, y: 0, width: 1920, height: 1400 }
    }
    const moved = reconcilePlacement({
      current: restoreBounds(saved, [primary], COMPANION_CONSTRAINTS),
      saved,
      displays: [taller],
      constraints: COMPANION_CONSTRAINTS,
      reason: 'metrics'
    })
    expect(moved.bounds.y + moved.bounds.height).toBe(taller.workArea.height)
    expect(moved.bounds.width).toBe(1440)
    expect(fullyInside(moved.bounds, taller.workArea)).toBe(true)

    const hud = capturePlacement(primary.bounds, [primary], { anchorSpace: 'bounds', fill: true })
    const refilled = reconcilePlacement({
      current: primary.bounds,
      saved: hud,
      displays: [taller],
      constraints: OVERLAY_CONSTRAINTS,
      reason: 'metrics'
    })
    expect(refilled.bounds).toEqual(taller.bounds)
    expect(refilled.apply).toBe(true)
  })

  it('leaves a fully visible window where it is when a display is added', () => {
    const current = { x: 240, y: 70, width: 1440, height: 900 }
    const result = reconcilePlacement({
      current,
      saved: capturePlacement(current, [primary], { anchorSpace: 'workArea' }),
      displays: [primary, qhd125],
      constraints: COMPANION_CONSTRAINTS,
      reason: 'added'
    })
    expect(result.apply).toBe(false)
    expect(result.bounds).toEqual(current)
  })

  it('does not move anything when the screen API reports no displays', () => {
    const current = { x: 10, y: 10, width: 800, height: 600 }
    const result = reconcilePlacement({
      current,
      saved: null,
      displays: [],
      constraints: loose,
      reason: 'removed'
    })
    expect(result.apply).toBe(false)
    expect(restoreBounds(null, [], loose)).toEqual({ x: 0, y: 0, width: 800, height: 600 })
  })

  it('shrinks below the preferred minimum so a tiny display still contains the window', () => {
    const tiny: DisplaySnapshot = {
      id: 9,
      primary: true,
      scaleFactor: 1,
      bounds: { x: 0, y: 0, width: 800, height: 600 },
      workArea: { x: 0, y: 0, width: 800, height: 560 }
    }
    const bounds = restoreBounds(null, [tiny], COMPANION_CONSTRAINTS)
    expect(bounds).toEqual({ x: 0, y: 0, width: 800, height: 560 })
    expect(fullyInside(bounds, tiny.workArea)).toBe(true)
  })
})

describe('anchors and legacy bounds', () => {
  it('anchors corners and edges to the display the window is on', () => {
    for (const anchor of ANCHORS) {
      const saved = placementFromAnchor(anchor, qhd125, { width: 480, height: 320 }, { displays: desk })
      const bounds = restoreBounds(saved, desk, loose)
      expect(saved.displayId).toBe(qhd125.id)
      expect(fullyInside(bounds, qhd125.workArea)).toBe(true)
      expect(bounds.x).toBeGreaterThanOrEqual(qhd125.workArea.x)
    }
    const bottomRight = boundsForAnchor('bottom-right', qhd125, { width: 480, height: 320 })
    expect(bottomRight.x + bottomRight.width).toBe(qhd125.workArea.x + qhd125.workArea.width)
    expect(bottomRight.y + bottomRight.height).toBe(qhd125.workArea.y + qhd125.workArea.height)
    const moved = movePlacementToDisplay(
      placementFromAnchor('bottom-right', qhd125, { width: 480, height: 320 }),
      primary
    )
    const onPrimary = restoreBounds(moved, desk, loose)
    expect(onPrimary.x + onPrimary.width).toBe(primary.workArea.width)
    expect(onPrimary.x).toBeLessThan(qhd125.bounds.x)
  })

  it('keeps the companion above the taskbar', () => {
    const bounds = placementFromAnchor('bottom-right', primary, { width: 1440, height: 900 })
    const restored = restoreBounds(bounds, [primary], COMPANION_CONSTRAINTS)
    expect(restored.y + restored.height).toBe(primary.workArea.y + primary.workArea.height)
    expect(restored.y + restored.height).toBeLessThan(primary.bounds.height)
  })

  it('centers the first companion launch in the primary work area', () => {
    expect(restoreBounds(null, [primary], COMPANION_CONSTRAINTS)).toEqual({ x: 240, y: 70, width: 1440, height: 900 })
  })

  it('migrates absolute x/y/width/height onto the display that contains them', () => {
    const parsed = parseWindowPlacements({
      companion: { x: 2200, y: 120, width: 1200, height: 800 },
      overlay: { nope: true }
    })
    const restored = restoreBounds(parsed.companion, desk, loose)
    expect(restored.x).toBeGreaterThanOrEqual(qhd125.bounds.x)
    expect(fullyInside(restored, qhd125.workArea)).toBe(true)
    expect(parsed.overlay).toBeNull()
    expect(parseWindowPlacements(null)).toEqual(emptyWindowPlacements())
  })

  it('restores a window on a display above or to the left of the primary', () => {
    const left = capturePlacement({ x: -2000, y: 40, width: 1200, height: 800 }, [primary, uhd150], {
      anchorSpace: 'workArea'
    })
    expect(restoreBounds(left, [primary, uhd150], loose).x).toBeLessThan(0)
    const upper = capturePlacement({ x: 40, y: -900, width: 1200, height: 700 }, [primary, above], {
      anchorSpace: 'workArea'
    })
    const restored = restoreBounds(upper, [primary, above], loose)
    expect(restored.y).toBeLessThan(0)
    expect(fullyInside(restored, above.workArea)).toBe(true)
  })

  it('reads placement from bounds alone, the way a click-through frameless window reports them', () => {
    const saved = capturePlacement(qhd125.bounds, desk, { anchorSpace: 'bounds', fill: true })
    expect(saved?.fill).toBe(true)
    expect(saved?.displayId).toBe(qhd125.id)
    expect(displaysFromElectron([{ ...qhd125, scaleFactor: 0 }, primary], primary.id)[0]?.scaleFactor).toBe(1)
  })
})

describe('save and restore through a window', () => {
  it('restores the companion on monitor 2 after move, debounce, and a new session', () => {
    const clock = manualClock()
    const mem = memoryStore()
    const first = fakeHost(restoreBounds(null, desk, COMPANION_CONSTRAINTS))
    const binding = attachWindowPlacement(first.host, {
      role: 'companion',
      displays: () => desk,
      store: mem.store,
      constraints: COMPANION_CONSTRAINTS,
      clock,
      waitMs: 300
    })
    expect(mem.saves()).toBe(0)
    first.moveTo(onQhd)
    first.moveTo(onQhd)
    first.moveTo({ ...onQhd, x: 2110 })
    expect(mem.saves()).toBe(0)
    expect(clock.pending()).toBe(1)
    clock.flush()
    expect(mem.saves()).toBe(1)
    expect(mem.state.placements.companion?.displayId).toBe(qhd125.id)
    binding.dispose()

    const next = fakeHost({ x: 0, y: 0, width: 800, height: 600 })
    const nextClock = manualClock()
    attachWindowPlacement(next.host, {
      role: 'companion',
      displays: () => desk,
      store: mem.store,
      constraints: COMPANION_CONSTRAINTS,
      clock: nextClock,
      dpiSettleMs: 10
    })
    nextClock.flush()
    expect(next.read().x).toBeGreaterThanOrEqual(qhd125.bounds.x)
    expect(next.read().width).toBe(1440)
    expect(fullyInside(next.read(), qhd125.workArea)).toBe(true)
  })

  it('flushes a pending move on close', () => {
    const clock = manualClock()
    const mem = memoryStore()
    const window = fakeHost(restoreBounds(null, [primary], COMPANION_CONSTRAINTS))
    attachWindowPlacement(window.host, {
      role: 'companion',
      displays: () => [primary, qhd125],
      store: mem.store,
      constraints: COMPANION_CONSTRAINTS,
      clock,
      waitMs: 300
    })
    window.moveTo(onQhd)
    expect(mem.saves()).toBe(0)
    window.close()
    expect(mem.saves()).toBe(1)
    expect(clock.pending()).toBe(0)
    expect(mem.state.placements.companion?.displayId).toBe(qhd125.id)
  })

  it('puts the HUD back on monitor 2 when the window is created on the primary', () => {
    const saved = capturePlacement(qhd125.bounds, desk, { anchorSpace: 'bounds', fill: true })
    const mem = memoryStore({
      placements: { companion: null, overlay: saved },
      overlayDisplayId: qhd125.id
    })
    const clock = manualClock()
    const window = fakeHost(primary.bounds)
    attachWindowPlacement(window.host, {
      role: 'overlay',
      displays: () => desk,
      store: mem.store,
      constraints: OVERLAY_CONSTRAINTS,
      clock,
      dpiSettleMs: 10
    })
    expect(window.calls[0]).toBe('position')
    clock.flush()
    expect(window.read()).toEqual(qhd125.bounds)
    expect(mem.state.overlayDisplayId).toBe(qhd125.id)
  })
})

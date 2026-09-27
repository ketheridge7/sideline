import { afterEach, describe, expect, it, vi } from 'vitest'

type Rect = { x: number; y: number; width: number; height: number }

const primary = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workArea: { x: 0, y: 0, width: 1920, height: 1040 },
  scaleFactor: 1
}

const secondary = {
  id: 2,
  bounds: { x: 1920, y: 0, width: 2048, height: 1152 },
  workArea: { x: 1920, y: 0, width: 2048, height: 1112 },
  scaleFactor: 1.25
}

const harness = vi.hoisted(() => ({
  settings: {
    windowPlacements: {
      companion: null as null,
      overlay: null as null
    },
    overlayDisplayId: 2 as number | null
  },
  calls: [] as string[],
  window: null as {
    opts: Rect
    setPosition: ReturnType<typeof vi.fn>
    setBounds: ReturnType<typeof vi.fn>
  } | null
}))

vi.mock('electron', () => {
  class BrowserWindow {
    opts: Rect
    destroyed = false
    bounds: Rect
    setPosition = vi.fn((x: number, y: number) => {
      harness.calls.push('position')
      this.bounds = { ...this.bounds, x, y }
    })
    setSize = vi.fn((width: number, height: number) => {
      harness.calls.push('size')
      this.bounds = { ...this.bounds, width, height }
    })
    setBounds = vi.fn((next: Rect) => {
      harness.calls.push('bounds')
      this.bounds = { ...next }
    })
    setAlwaysOnTop = vi.fn()
    setVisibleOnAllWorkspaces = vi.fn()
    setFullScreenable = vi.fn()
    setIgnoreMouseEvents = vi.fn()
    showInactive = vi.fn()
    isVisible = vi.fn(() => false)
    hide = vi.fn()
    webContents = { on: vi.fn(), reload: vi.fn() }
    handlers = new Map<string, Array<() => void>>()

    constructor(opts: Rect) {
      this.opts = opts
      this.bounds = { x: opts.x, y: opts.y, width: opts.width, height: opts.height }
    }

    getBounds(): Rect {
      return { ...this.bounds }
    }

    isDestroyed(): boolean {
      return this.destroyed
    }

    on(event: string, handler: () => void): void {
      const list = this.handlers.get(event) ?? []
      list.push(handler)
      this.handlers.set(event, list)
    }

    once(event: string, handler: () => void): void {
      this.on(event, handler)
    }
  }

  return {
    BrowserWindow,
    screen: {
      getAllDisplays: () => [primary, secondary],
      getPrimaryDisplay: () => primary,
      on: vi.fn(),
      removeListener: vi.fn()
    }
  }
})

vi.mock('../poller', () => ({ setOverlayEditMode: vi.fn() }))
vi.mock('../log', () => ({ appendLog: vi.fn() }))
vi.mock('../runtime', () => ({
  runtime: {
    overlay: () => harness.window,
    setOverlay: (win: typeof harness.window) => {
      harness.window = win
    },
    isQuitting: () => false
  }
}))
vi.mock('../store', () => ({
  loadSettings: () => harness.settings,
  saveSettings: (patch: { windowPlacements?: typeof harness.settings.windowPlacements; overlayDisplayId?: number | null }) => {
    if (patch.windowPlacements) harness.settings.windowPlacements = patch.windowPlacements
    if (patch.overlayDisplayId !== undefined) harness.settings.overlayDisplayId = patch.overlayDisplayId
  }
}))
vi.mock('./load', () => ({ loadRenderer: vi.fn() }))

import { createOverlayWindow, setOverlayDisplayId } from './overlay'
import { resetPlacementHostForTests } from './placementHost'

afterEach(() => {
  vi.useRealTimers()
  harness.calls = []
  harness.settings.windowPlacements = { companion: null, overlay: null }
  harness.settings.overlayDisplayId = 2
  harness.window = null
  resetPlacementHostForTests()
})

describe('overlay window placement', () => {
  it('opens the HUD on the saved monitor after a restart', () => {
    const win = createOverlayWindow() as unknown as { opts: Rect }
    expect(win.opts).toMatchObject({ x: 1920, y: 0, width: 2048, height: 1152 })
  })

  it('moves onto a different scale factor with setPosition before setSize', () => {
    vi.useFakeTimers()
    const win = createOverlayWindow() as unknown as {
      setPosition: ReturnType<typeof vi.fn>
      setBounds: ReturnType<typeof vi.fn>
    }
    vi.runAllTimers()
    harness.calls = []
    win.setPosition.mockClear()
    win.setBounds.mockClear()
    setOverlayDisplayId(primary.id)
    expect(win.setPosition).toHaveBeenCalledWith(0, 0, false)
    expect(win.setBounds).not.toHaveBeenCalled()
    expect(harness.calls[0]).toBe('position')
    vi.runAllTimers()
    expect(harness.calls).toContain('size')
    expect(harness.calls).not.toContain('bounds')
  })
})

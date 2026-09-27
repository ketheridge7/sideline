import { afterEach, describe, expect, it, vi } from 'vitest'
import { COMPANION_TITLEBAR_OVERLAY, NATIVE_WINDOW_TITLE, packagingWindowIconPath } from '../packagingIcon'
import type { SavedWindowPlacement } from '../windowPlacement'

type FakeWindow = {
  opts: Record<string, unknown>
  destroyed: boolean
  setTitle: ReturnType<typeof vi.fn>
  show: ReturnType<typeof vi.fn>
  focus: ReturnType<typeof vi.fn>
  hide: ReturnType<typeof vi.fn>
  isDestroyed: () => boolean
  on: (event: string, handler: (...args: unknown[]) => void) => void
  handlers: Map<string, Array<(...args: unknown[]) => void>>
}

const emptyPlacements = (): {
  companion: SavedWindowPlacement | null
  overlay: SavedWindowPlacement | null
} => ({ companion: null, overlay: null })

const legacyPlacement = (rect: { x: number; y: number; width: number; height: number }): SavedWindowPlacement => ({
  v: 1,
  displayId: -1,
  displayBounds: { x: 0, y: 0, width: 0, height: 0 },
  displayWorkArea: { x: 0, y: 0, width: 0, height: 0 },
  scaleFactor: 1,
  anchorX: 0,
  anchorY: 0,
  width: rect.width,
  height: rect.height,
  anchorSpace: 'workArea',
  legacyRect: rect
})

const harness = vi.hoisted(() => ({
  window: null as FakeWindow | null,
  companion: null as FakeWindow | null,
  quitting: false,
  quittingForUpdate: false,
  settings: {
    windowPlacements: {
      companion: null as SavedWindowPlacement | null,
      overlay: null as SavedWindowPlacement | null
    },
    overlayDisplayId: null as number | null,
    overlayOpen: false
  }
}))

const primaryDisplay = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workArea: { x: 0, y: 0, width: 1920, height: 1040 },
  scaleFactor: 1
}

vi.mock('electron', () => {
  class BrowserWindow {
    opts: Record<string, unknown>
    destroyed = false
    handlers = new Map<string, Array<(...args: unknown[]) => void>>()
    setTitle = vi.fn()
    show = vi.fn()
    focus = vi.fn()
    hide = vi.fn()
    setBounds = vi.fn()
    setPosition = vi.fn()
    setSize = vi.fn()

    constructor(opts: Record<string, unknown>) {
      this.opts = opts
      harness.window = this as unknown as FakeWindow
    }

    isDestroyed(): boolean {
      return this.destroyed
    }

    getBounds(): { x: number; y: number; width: number; height: number } {
      return {
        x: Number(this.opts.x ?? 0),
        y: Number(this.opts.y ?? 0),
        width: Number(this.opts.width ?? 0),
        height: Number(this.opts.height ?? 0)
      }
    }

    webContents = { on: vi.fn(), reload: vi.fn() }

    on(event: string, handler: (...args: unknown[]) => void): void {
      const list = this.handlers.get(event) ?? []
      list.push(handler)
      this.handlers.set(event, list)
    }

    once(event: string, handler: (...args: unknown[]) => void): void {
      this.on(event, handler)
    }
  }

  return {
    BrowserWindow,
    screen: {
      getAllDisplays: () => [primaryDisplay],
      getPrimaryDisplay: () => primaryDisplay,
      on: vi.fn(),
      removeListener: vi.fn()
    }
  }
})

vi.mock('../store', () => ({
  loadSettings: () => harness.settings,
  saveSettings: vi.fn()
}))

vi.mock('../runtime', () => ({
  runtime: {
    companion: () => harness.companion,
    setCompanion: (win: FakeWindow | null) => {
      harness.companion = win
    },
    isQuitting: () => harness.quitting,
    isQuittingForUpdate: () => harness.quittingForUpdate,
    noteCompanionReady: vi.fn()
  }
}))

vi.mock('./load', () => ({ loadRenderer: vi.fn() }))

import { loadRenderer } from './load'
import { createCompanionWindow } from './companion'
import { resetPlacementHostForTests } from './placementHost'

afterEach(() => {
  harness.window = null
  harness.companion = null
  harness.quitting = false
  harness.quittingForUpdate = false
  harness.settings = { windowPlacements: emptyPlacements(), overlayDisplayId: null, overlayOpen: false }
  resetPlacementHostForTests()
  vi.mocked(loadRenderer).mockClear()
})

describe('createCompanionWindow', () => {
  it('uses the broadcast mark, hidden native title, and overlay caption', () => {
    const win = createCompanionWindow() as unknown as FakeWindow
    expect(win.opts.title).toBe(NATIVE_WINDOW_TITLE)
    expect(win.opts.icon).toBe(packagingWindowIconPath())
    expect(String(win.opts.icon)).toMatch(/broadcast-s\.png$/)
    expect(win.opts.titleBarStyle).toBe('hidden')
    expect(win.opts.x).toBe(240)
    expect(win.opts.y).toBe(70)
    expect(win.opts.width).toBe(1440)
    expect(win.opts.height).toBe(900)
    expect(win.opts.minWidth).toBe(1100)
    expect(win.opts.minHeight).toBe(700)
    expect(win.opts.titleBarOverlay).toEqual({ ...COMPANION_TITLEBAR_OVERLAY })
    expect(String(win.opts.title)).not.toMatch(/sideline/i)
    expect(win.setTitle).toHaveBeenCalledWith(NATIVE_WINDOW_TITLE)
    expect(loadRenderer).toHaveBeenCalledWith(win, 'companion')
  })

  it('does not let the document title rewrite the native caption', () => {
    const win = createCompanionWindow() as unknown as FakeWindow
    const preventDefault = vi.fn()
    const handlers = win.handlers.get('page-title-updated')
    expect(handlers?.length).toBe(1)
    handlers?.[0]({ preventDefault })
    expect(preventDefault).toHaveBeenCalledTimes(1)
  })

  it('hides on close and lets an update quit replace the window', () => {
    const win = createCompanionWindow() as unknown as FakeWindow
    const preventDefault = vi.fn()
    win.handlers.get('close')?.[0]?.({ preventDefault })
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(win.hide).toHaveBeenCalledTimes(1)

    harness.quittingForUpdate = true
    preventDefault.mockClear()
    win.hide.mockClear()
    win.handlers.get('close')?.[0]?.({ preventDefault })
    expect(preventDefault).not.toHaveBeenCalled()
    expect(win.hide).not.toHaveBeenCalled()
  })

  it('restores a saved companion placement and clamps one parked off every display', () => {
    harness.settings.windowPlacements = {
      companion: legacyPlacement({ x: 10, y: 20, width: 1200, height: 800 }),
      overlay: null
    }
    const restored = createCompanionWindow() as unknown as FakeWindow
    expect(restored.opts).toMatchObject({ x: 10, y: 20, width: 1200, height: 800 })

    harness.companion = null
    harness.settings.windowPlacements = {
      companion: legacyPlacement({ x: 9000, y: 9000, width: 1200, height: 800 }),
      overlay: null
    }
    const fallback = createCompanionWindow() as unknown as FakeWindow
    expect(fallback.opts).toMatchObject({ x: 720, y: 240, width: 1200, height: 800 })
  })

  it('reuses an existing companion instead of opening a second window', () => {
    const first = createCompanionWindow() as unknown as FakeWindow
    const second = createCompanionWindow() as unknown as FakeWindow
    expect(second).toBe(first)
    expect(first.show).toHaveBeenCalledTimes(1)
    expect(first.focus).toHaveBeenCalledTimes(1)
    expect(loadRenderer).toHaveBeenCalledTimes(1)
  })
})

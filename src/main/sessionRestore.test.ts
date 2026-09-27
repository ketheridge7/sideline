import { afterEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({
  settings: { overlayOpen: false },
  saved: null as { overlayOpen?: boolean; companionBounds?: unknown; windowPlacements?: unknown } | null,
  overlay: null as {
    isDestroyed: () => boolean
    isVisible: () => boolean
    showInactive: ReturnType<typeof vi.fn>
  } | null,
  flushedPlacements: 0,
  flushedHud: 0,
  visible: null as boolean | null,
  created: 0,
  chrome: 0,
  bounds: 0,
  input: 0
}))

vi.mock('./poller', () => ({
  flushHudForRelaunch: () => {
    harness.flushedHud += 1
  },
  setOverlayVisible: (visible: boolean) => {
    harness.visible = visible
  }
}))

vi.mock('./runtime', () => ({
  runtime: {
    overlay: () => harness.overlay
  }
}))

vi.mock('./store', () => ({
  loadSettings: () => harness.settings,
  saveSettings: (patch: { overlayOpen?: boolean; companionBounds?: unknown; windowPlacements?: unknown }) => {
    harness.saved = patch
    harness.settings = { ...harness.settings, ...patch }
    return harness.settings
  }
}))

vi.mock('./windows/overlay', () => ({
  createOverlayWindow: () => {
    harness.created += 1
    return harness.overlay
  },
  applyOverlayChrome: () => {
    harness.chrome += 1
  },
  applyOverlayBounds: () => {
    harness.bounds += 1
  },
  applyOverlayInput: () => {
    harness.input += 1
  }
}))

vi.mock('./windows/placementHost', () => ({
  flushTrackedPlacements: () => {
    harness.flushedPlacements += 1
  }
}))

import { persistSessionForRelaunch, restoreOverlayFromSettings } from './sessionRestore'

afterEach(() => {
  harness.settings = { overlayOpen: false }
  harness.saved = null
  harness.overlay = null
  harness.flushedPlacements = 0
  harness.flushedHud = 0
  harness.visible = null
  harness.created = 0
  harness.chrome = 0
  harness.bounds = 0
  harness.input = 0
})

describe('persistSessionForRelaunch', () => {
  it('flushes display-relative placement and remembers that the HUD was open', () => {
    harness.overlay = {
      isDestroyed: () => false,
      isVisible: () => true,
      showInactive: vi.fn()
    }
    persistSessionForRelaunch()
    expect(harness.flushedPlacements).toBe(1)
    expect(harness.flushedHud).toBe(1)
    expect(harness.saved).toEqual({ overlayOpen: true })
  })

  it('records a closed HUD without writing absolute bounds', () => {
    persistSessionForRelaunch()
    expect(harness.saved).toEqual({ overlayOpen: false })
    expect(harness.saved && 'companionBounds' in harness.saved).toBe(false)
  })
})

describe('restoreOverlayFromSettings', () => {
  it('leaves the HUD closed when the saved session had it hidden', () => {
    restoreOverlayFromSettings()
    expect(harness.created).toBe(0)
    expect(harness.visible).toBeNull()
  })

  it('reopens the HUD on its saved placement after an update relaunch', () => {
    harness.settings = { overlayOpen: true }
    const showInactive = vi.fn()
    harness.overlay = {
      isDestroyed: () => false,
      isVisible: () => false,
      showInactive
    }
    restoreOverlayFromSettings()
    expect(harness.created).toBe(1)
    expect(harness.chrome).toBe(1)
    expect(harness.bounds).toBe(1)
    expect(showInactive).toHaveBeenCalledTimes(1)
    expect(harness.input).toBe(1)
    expect(harness.visible).toBe(true)
  })
})

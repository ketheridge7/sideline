import { screen, type BrowserWindow } from 'electron'
import {
  attachWindowPlacement,
  COMPANION_CONSTRAINTS,
  displaysFromElectron,
  OVERLAY_CONSTRAINTS,
  type DisplayChangeReason,
  type DisplaySnapshot,
  type PlacementBinding
} from '../windowPlacement'
import { loadSettings, saveSettings } from '../store'

type ScreenEvent = 'display-added' | 'display-removed' | 'display-metrics-changed'

type ScreenBus = {
  on: (event: ScreenEvent, listener: () => void) => void
  removeListener: (event: ScreenEvent, listener: () => void) => void
}

const roles = new Map<'companion' | 'overlay', PlacementBinding>()
const stops: Array<() => void> = []
let listening = false

const reasonFor = (event: ScreenEvent): DisplayChangeReason => {
  switch (event) {
    case 'display-added':
      return 'added'
    case 'display-removed':
      return 'removed'
    case 'display-metrics-changed':
      return 'metrics'
    default: {
      const _never: never = event
      return _never
    }
  }
}

export const snapshotDisplays = (): DisplaySnapshot[] => {
  const primary = screen.getPrimaryDisplay()
  return displaysFromElectron(screen.getAllDisplays(), primary.id)
}

const hostFrom = (win: BrowserWindow) => ({
  getBounds: () => {
    const bounds = win.getBounds()
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
  },
  setBounds: (bounds: { x: number; y: number; width: number; height: number }) => {
    if (!win.isDestroyed()) win.setBounds(bounds, false)
  },
  setPosition: (x: number, y: number) => {
    if (!win.isDestroyed()) win.setPosition(x, y, false)
  },
  setSize: (width: number, height: number) => {
    if (!win.isDestroyed()) win.setSize(width, height, false)
  },
  isDestroyed: () => win.isDestroyed(),
  on: (event: 'moved' | 'resized' | 'close', listener: () => void) => {
    switch (event) {
      case 'moved':
        win.on('moved', listener)
        return
      case 'resized':
        win.on('resized', listener)
        return
      case 'close':
        win.on('close', listener)
        return
      default: {
        const _never: never = event
        void _never
      }
    }
  }
})

export const attachBrowserWindowPlacement = (
  win: BrowserWindow,
  role: 'companion' | 'overlay'
): PlacementBinding => {
  const binding = attachWindowPlacement(hostFrom(win), {
    role,
    displays: snapshotDisplays,
    constraints: role === 'overlay' ? OVERLAY_CONSTRAINTS : COMPANION_CONSTRAINTS,
    store: {
      load: () => {
        const settings = loadSettings()
        return { placements: settings.windowPlacements, overlayDisplayId: settings.overlayDisplayId }
      },
      save: (patch) => {
        saveSettings({
          windowPlacements: patch.placements,
          ...(patch.overlayDisplayId !== undefined ? { overlayDisplayId: patch.overlayDisplayId } : {})
        })
      }
    }
  })
  roles.set(role, binding)
  win.once('closed', () => {
    if (roles.get(role) === binding) roles.delete(role)
    binding.dispose()
  })
  return binding
}

export const reapplyPlacement = (role: 'companion' | 'overlay'): boolean => {
  const binding = roles.get(role)
  if (!binding) return false
  binding.applySaved()
  return true
}

export const trackPlacementBinding = (role: 'companion' | 'overlay', binding: PlacementBinding): void => {
  roles.set(role, binding)
}

export const reconcileTracked = (reason: DisplayChangeReason): void => {
  for (const binding of roles.values()) {
    try {
      binding.reconcile(reason)
    } catch {
      // One window failing to re-anchor must not skip the others.
    }
  }
}

export const flushTrackedPlacements = (): void => {
  for (const binding of roles.values()) {
    try {
      binding.flush()
    } catch {
      // Quitting still proceeds when a window is already gone.
    }
  }
}

export const listenForDisplayChanges = (api: ScreenBus = screen as unknown as ScreenBus): void => {
  if (listening) return
  listening = true
  const events: ScreenEvent[] = ['display-added', 'display-removed', 'display-metrics-changed']
  for (const event of events) {
    const listener = (): void => {
      reconcileTracked(reasonFor(event))
    }
    api.on(event, listener)
    stops.push(() => api.removeListener(event, listener))
  }
}

export const resetPlacementHostForTests = (): void => {
  for (const stop of stops) stop()
  stops.length = 0
  listening = false
  roles.clear()
}

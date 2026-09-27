import { globalShortcut } from 'electron'
import {
  applyShortcutChange,
  DEFAULT_SHORTCUTS,
  isGlobalAccelerator,
  isShortcutAction,
  nextLeagueKey,
  SHORTCUT_ACTIONS,
  shortcutMapFromSettings,
  shortcutRegistrationError,
  shortcutSettingsPatch,
  type ShortcutAction
} from '@shared/shortcuts'
import { applyHotkeys, currentState, refresh, setOverlayVisible } from './poller'
import { runtime } from './runtime'
import { loadSettings, saveSettings } from './store'
import { cycleOverlayDisplay, overlayEditMode, setOverlayEditMode, toggleOverlay } from './windows/overlay'

const runToggleOverlay = (): void => {
  const visible = toggleOverlay()
  setOverlayVisible(visible)
}

const runToggleOverlayEdit = (): void => {
  const win = runtime.overlay()
  if (!win || win.isDestroyed() || !win.isVisible()) return
  setOverlayEditMode(!overlayEditMode())
}

const runCycleOverlayDisplay = (): void => {
  const result = cycleOverlayDisplay()
  if (result.cycled) return
  runtime.sendToast({
    id: 'sideline:display',
    title: 'HUD display',
    body: 'Only one monitor detected'
  })
}

export const cycleLeague = async (delta: number): Promise<void> => {
  const state = currentState()
  const next = nextLeagueKey({
    leagues: state.leagues,
    pinnedLeagueKeys: state.pinnedLeagueKeys,
    selectedLeagueKey: state.selectedLeagueKey,
    delta
  })
  if (!next || next === state.selectedLeagueKey) return
  saveSettings({ selectedLeagueKey: next })
  await refresh()
}

const handlerFor = (action: ShortcutAction): (() => void) => {
  switch (action) {
    case 'overlay':
      return runToggleOverlay
    case 'overlayDisplay':
      return runCycleOverlayDisplay
    case 'nextLeague':
      return () => {
        void cycleLeague(1)
      }
    case 'prevLeague':
      return () => {
        void cycleLeague(-1)
      }
    case 'overlayEdit':
      return runToggleOverlayEdit
    default: {
      const _never: never = action
      return _never
    }
  }
}

export type ShortcutRegistration = {
  failed: Array<{ action: ShortcutAction; accelerator: string }>
}

const registerOne = (accelerator: string, handler: () => void): boolean => {
  try {
    return globalShortcut.register(accelerator, handler)
  } catch {
    return false
  }
}

let captureActive = false
let minimizedLocals: string[] = []

const companionMinimized = (): boolean => {
  const win = runtime.companion()
  return Boolean(win && !win.isDestroyed() && win.isMinimized())
}

const unregisterMinimizedLocals = (): void => {
  for (const accelerator of minimizedLocals) {
    try {
      globalShortcut.unregister(accelerator)
    } catch {
      // Already dropped by unregisterAll.
    }
  }
  minimizedLocals = []
}

/**
 * Single keys such as [ and ] stay off the global table while the companion
 * can take focus, so they do not swallow typing in other apps. While that
 * window is minimized they are registered in the main process and the
 * handlers do not restore or focus it.
 */
export const syncMinimizedLocalShortcuts = (minimized: boolean): void => {
  unregisterMinimizedLocals()
  if (!minimized || captureActive) return
  const shortcuts = shortcutMapFromSettings(loadSettings())
  for (const action of SHORTCUT_ACTIONS) {
    const accelerator = shortcuts[action]
    if (isGlobalAccelerator(accelerator) || minimizedLocals.includes(accelerator)) continue
    if (!registerOne(accelerator, handlerFor(action))) continue
    minimizedLocals.push(accelerator)
  }
}

export const registerAppShortcuts = (): ShortcutRegistration => {
  const minimized = companionMinimized()
  globalShortcut.unregisterAll()
  minimizedLocals = []
  const shortcuts = shortcutMapFromSettings(loadSettings())
  const failed: ShortcutRegistration['failed'] = []
  for (const action of SHORTCUT_ACTIONS) {
    const accelerator = shortcuts[action]
    if (!isGlobalAccelerator(accelerator)) continue
    if (!registerOne(accelerator, handlerFor(action))) failed.push({ action, accelerator })
  }
  if (minimized) syncMinimizedLocalShortcuts(true)
  return { failed }
}

export const setShortcutCapture = (active: boolean): void => {
  captureActive = active
  if (active) {
    globalShortcut.unregisterAll()
    minimizedLocals = []
    return
  }
  registerAppShortcuts()
}

export const applyShortcut = (
  action: unknown,
  accelerator: unknown
): { ok: true } | { ok: false; error: string } => {
  if (!isShortcutAction(action) || typeof accelerator !== 'string') {
    return { ok: false, error: 'Invalid shortcut' }
  }
  const current = shortcutMapFromSettings(loadSettings())
  const result = applyShortcutChange(current, action, accelerator)
  if (!result.ok) return { ok: false, error: result.error }
  saveSettings(shortcutSettingsPatch(result.shortcuts))
  const registered = registerAppShortcuts()
  const failed = registered.failed.find((row) => row.action === action)
  if (failed) {
    saveSettings(shortcutSettingsPatch(current))
    registerAppShortcuts()
    applyHotkeys()
    return { ok: false, error: shortcutRegistrationError(failed.accelerator) }
  }
  applyHotkeys()
  return { ok: true }
}

export const resetShortcut = (action: unknown): { ok: true } | { ok: false; error: string } => {
  if (!isShortcutAction(action)) return { ok: false, error: 'Invalid shortcut' }
  return applyShortcut(action, DEFAULT_SHORTCUTS[action])
}

export const cycleHudDisplay = (): void => {
  runCycleOverlayDisplay()
}

import { globalShortcut } from 'electron'
import {
  applyShortcutChange,
  DEFAULT_SHORTCUTS,
  isGlobalAccelerator,
  isShortcutAction,
  nextLeagueKey,
  SHORTCUT_ACTIONS,
  shortcutMapFromSettings,
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

export const registerAppShortcuts = (): void => {
  globalShortcut.unregisterAll()
  const shortcuts = shortcutMapFromSettings(loadSettings())
  for (const action of SHORTCUT_ACTIONS) {
    const accelerator = shortcuts[action]
    if (!isGlobalAccelerator(accelerator)) continue
    try {
      globalShortcut.register(accelerator, handlerFor(action))
    } catch {
      // Invalid accelerators stay persisted so Settings can show and reset them.
    }
  }
}

export const setShortcutCapture = (active: boolean): void => {
  if (active) {
    globalShortcut.unregisterAll()
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
  applyHotkeys()
  registerAppShortcuts()
  return { ok: true }
}

export const resetShortcut = (action: unknown): { ok: true } | { ok: false; error: string } => {
  if (!isShortcutAction(action)) return { ok: false, error: 'Invalid shortcut' }
  return applyShortcut(action, DEFAULT_SHORTCUTS[action])
}

export const cycleHudDisplay = (): void => {
  runCycleOverlayDisplay()
}

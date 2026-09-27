import { sessionPatchForRelaunch } from '@shared/settings'
import { flushHudForRelaunch, setOverlayVisible } from './poller'
import { runtime } from './runtime'
import { loadSettings, saveSettings } from './store'
import { applyOverlayBounds, applyOverlayChrome, applyOverlayInput, createOverlayWindow } from './windows/overlay'

export const persistSessionForRelaunch = (): void => {
  const companion = runtime.companion()
  const overlay = runtime.overlay()
  const bounds = companion && !companion.isDestroyed() ? companion.getBounds() : null
  const overlayOpen = Boolean(overlay && !overlay.isDestroyed() && overlay.isVisible())
  saveSettings(sessionPatchForRelaunch(bounds, overlayOpen))
  flushHudForRelaunch()
}

export const restoreOverlayFromSettings = (): void => {
  if (!loadSettings().overlayOpen) return
  const win = createOverlayWindow()
  applyOverlayChrome(win)
  applyOverlayBounds(win)
  if (!win.isVisible()) win.showInactive()
  applyOverlayInput(win)
  setOverlayVisible(true)
}

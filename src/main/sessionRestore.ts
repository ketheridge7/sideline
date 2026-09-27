import { flushHudForRelaunch, setOverlayVisible } from './poller'
import { runtime } from './runtime'
import { loadSettings, saveSettings } from './store'
import { applyOverlayBounds, applyOverlayChrome, applyOverlayInput, createOverlayWindow } from './windows/overlay'
import { flushTrackedPlacements } from './windows/placementHost'

/** Save HUD visibility and the current display-relative placement before quit or an update relaunch. */
export const persistSessionForRelaunch = (): void => {
  flushTrackedPlacements()
  const overlay = runtime.overlay()
  const overlayOpen = Boolean(overlay && !overlay.isDestroyed() && overlay.isVisible())
  saveSettings({ overlayOpen })
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

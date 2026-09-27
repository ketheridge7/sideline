import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { nextOverlayDisplayId } from '@shared/shortcuts'
import { appendLog } from '../log'
import { setOverlayEditMode as setPollerEditMode } from '../poller'
import { runtime } from '../runtime'
import { loadSettings, saveSettings } from '../store'
import { capturePlacement, initialWindowBounds, migrateOverlayDisplayId, OVERLAY_CONSTRAINTS } from '../windowPlacement'
import { loadRenderer } from './load'
import { attachBrowserWindowPlacement, reapplyPlacement, snapshotDisplays } from './placementHost'
import { createRendererRecovery } from './rendererCrash'

let editMode = false

export const applyOverlayChrome = (win: BrowserWindow): void => {
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.setFullScreenable(false)
}

export const applyOverlayBounds = (win: BrowserWindow): void => {
  if (reapplyPlacement('overlay')) return
  if (win.isDestroyed()) return
  attachBrowserWindowPlacement(win, 'overlay')
}

export const applyOverlayInput = (win: BrowserWindow): void => {
  if (editMode) {
    win.setIgnoreMouseEvents(false)
    return
  }
  win.setIgnoreMouseEvents(true, { forward: true })
}

const forceOverlayClickThrough = (win: BrowserWindow): void => {
  editMode = false
  setPollerEditMode(false)
  if (!win.isDestroyed()) win.setIgnoreMouseEvents(true, { forward: true })
}

export const overlayEditMode = (): boolean => editMode

export const setOverlayEditMode = (next: boolean): boolean => {
  editMode = next
  const win = runtime.overlay()
  if (win && !win.isDestroyed() && win.isVisible()) applyOverlayInput(win)
  setPollerEditMode(editMode)
  return editMode
}

export const createOverlayWindow = (): BrowserWindow => {
  const existing = runtime.overlay()
  if (existing && !existing.isDestroyed()) return existing

  const isMac = process.platform === 'darwin'
  const settings = loadSettings()
  const bounds = initialWindowBounds(
    'overlay',
    { placements: settings.windowPlacements, overlayDisplayId: settings.overlayDisplayId },
    snapshotDisplays(),
    OVERLAY_CONSTRAINTS
  )

  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    show: false,
    ...(isMac ? { type: 'panel' as const } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  applyOverlayChrome(win)
  attachBrowserWindowPlacement(win, 'overlay')
  const recovery = createRendererRecovery({
    role: 'overlay',
    quitting: () => runtime.isQuitting(),
    isDestroyed: () => win.isDestroyed(),
    reload: () => {
      if (!win.isDestroyed()) win.webContents.reload()
    },
    forceClickThrough: () => forceOverlayClickThrough(win),
    log: (level, message, extra) => appendLog(level, message, extra)
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    recovery.noteGone({ reason: details.reason, exitCode: details.exitCode })
  })
  win.webContents.on('unresponsive', () => {
    recovery.noteUnresponsive()
  })
  win.on('closed', () => {
    editMode = false
    runtime.setOverlay(null)
  })

  loadRenderer(win, 'overlay')
  runtime.setOverlay(win)
  return win
}

export const toggleOverlay = (): boolean => {
  const win = createOverlayWindow()
  applyOverlayChrome(win)
  applyOverlayBounds(win)
  if (win.isVisible()) {
    setOverlayEditMode(false)
    win.hide()
    return false
  }
  win.showInactive()
  applyOverlayInput(win)
  return true
}

export const setOverlayDisplayId = (id: number | null): void => {
  const displays = snapshotDisplays()
  const settings = loadSettings()
  const display = id == null ? null : (displays.find((row) => row.id === id) ?? null)
  const placement = display
    ? capturePlacement(display.bounds, displays, { anchorSpace: 'bounds', fill: true })
    : migrateOverlayDisplayId(id)
  saveSettings({
    overlayDisplayId: placement?.displayId ?? null,
    windowPlacements: {
      companion: settings.windowPlacements.companion,
      overlay: placement
    }
  })
  const win = runtime.overlay()
  if (win && !win.isDestroyed()) applyOverlayBounds(win)
}

export const cycleOverlayDisplay = (): { cycled: boolean; count: number } => {
  const displays = screen.getAllDisplays()
  const result = nextOverlayDisplayId(
    loadSettings().overlayDisplayId,
    displays.map((row) => row.id),
    screen.getPrimaryDisplay().id
  )
  if (!result.cycled) return { cycled: false, count: displays.length }
  setOverlayDisplayId(result.id)
  return { cycled: true, count: displays.length }
}

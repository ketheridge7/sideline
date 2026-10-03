import { BrowserWindow } from 'electron'
import { join } from 'path'
import { appendLog } from '../log'
import {
  bindEmptyNativeTitle,
  COMPANION_TITLEBAR_OVERLAY,
  NATIVE_WINDOW_TITLE,
  packagingWindowIconPath
} from '../packagingIcon'
import { leagueBrowseWindowVisible, setLeagueBrowseVisible } from '../leagueBrowse'
import { runtime } from '../runtime'
import { loadSettings } from '../store'
import { windowClosePlan } from '../updateQuit'
import { COMPANION_CONSTRAINTS, initialWindowBounds } from '../windowPlacement'
import { loadRenderer } from './load'
import { attachBrowserWindowPlacement, snapshotDisplays } from './placementHost'
import { createRendererRecovery } from './rendererCrash'

export const createCompanionWindow = (): BrowserWindow => {
  const existing = runtime.companion()
  if (existing && !existing.isDestroyed()) {
    existing.show()
    existing.focus()
    return existing
  }

  const settings = loadSettings()
  const bounds = initialWindowBounds(
    'companion',
    { placements: settings.windowPlacements, overlayDisplayId: settings.overlayDisplayId },
    snapshotDisplays(),
    COMPANION_CONSTRAINTS
  )

  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: Math.min(COMPANION_CONSTRAINTS.minWidth, bounds.width),
    minHeight: Math.min(COMPANION_CONSTRAINTS.minHeight, bounds.height),
    title: NATIVE_WINDOW_TITLE,
    icon: packagingWindowIconPath(),
    backgroundColor: '#07080A',
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    titleBarOverlay: { ...COMPANION_TITLEBAR_OVERLAY },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  bindEmptyNativeTitle(win)

  const recovery = createRendererRecovery({
    role: 'companion',
    quitting: () => runtime.isQuitting() || runtime.isQuittingForUpdate(),
    isDestroyed: () => win.isDestroyed(),
    reload: () => {
      if (!win.isDestroyed()) win.webContents.reload()
    },
    log: (level, message, extra) => appendLog(level, message, extra)
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    recovery.noteGone({ reason: details.reason, exitCode: details.exitCode })
  })
  win.webContents.on('unresponsive', () => {
    recovery.noteUnresponsive()
  })

  win.on('close', (event) => {
    if (windowClosePlan(runtime.isQuitting(), runtime.isQuittingForUpdate()) === 'close') return
    event.preventDefault()
    win.hide()
  })

  const syncLeagueBrowseWindow = (): void => {
    setLeagueBrowseVisible(leagueBrowseWindowVisible(win))
  }
  win.on('show', syncLeagueBrowseWindow)
  win.on('hide', syncLeagueBrowseWindow)
  win.on('minimize', syncLeagueBrowseWindow)
  win.on('restore', syncLeagueBrowseWindow)
  win.on('closed', () => {
    setLeagueBrowseVisible(false)
  })

  attachBrowserWindowPlacement(win, 'companion')

  win.once('ready-to-show', () => {
    runtime.noteCompanionReady()
  })

  loadRenderer(win, 'companion')
  runtime.setCompanion(win)
  return win
}

import { BrowserWindow } from 'electron'
import { join } from 'path'
import { appendLog } from '../log'
import { initialCompanionBounds } from '../companionBounds'
import {
  bindEmptyNativeTitle,
  COMPANION_TITLEBAR_OVERLAY,
  NATIVE_WINDOW_TITLE,
  packagingWindowIconPath
} from '../packagingIcon'
import { runtime } from '../runtime'
import { windowClosePlan } from '../updateQuit'
import { loadRenderer } from './load'
import { createRendererRecovery } from './rendererCrash'

export const createCompanionWindow = (): BrowserWindow => {
  const existing = runtime.companion()
  if (existing && !existing.isDestroyed()) {
    existing.show()
    existing.focus()
    return existing
  }

  const restored = initialCompanionBounds()
  const win = new BrowserWindow({
    width: restored?.width ?? 1440,
    height: restored?.height ?? 900,
    ...(restored ? { x: restored.x, y: restored.y } : {}),
    minWidth: 1100,
    minHeight: 700,
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

  win.once('ready-to-show', () => {
    runtime.noteCompanionReady()
  })

  loadRenderer(win, 'companion')
  runtime.setCompanion(win)
  return win
}

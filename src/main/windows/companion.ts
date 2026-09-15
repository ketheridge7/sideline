import { BrowserWindow } from 'electron'
import { join } from 'path'
import { bindEmptyNativeTitle, NATIVE_WINDOW_TITLE, packagingWindowIconPath } from '../packagingIcon'
import { runtime } from '../runtime'
import { loadRenderer } from './load'

export const createCompanionWindow = (): BrowserWindow => {
  const existing = runtime.companion()
  if (existing && !existing.isDestroyed()) {
    existing.show()
    existing.focus()
    return existing
  }

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: NATIVE_WINDOW_TITLE,
    icon: packagingWindowIconPath(),
    backgroundColor: '#07080A',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  bindEmptyNativeTitle(win)

  win.on('close', (event) => {
    if (runtime.isQuitting()) return
    event.preventDefault()
    win.hide()
  })

  loadRenderer(win, 'companion')
  runtime.setCompanion(win)
  return win
}

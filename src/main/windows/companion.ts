import { BrowserWindow } from 'electron'
import { join } from 'path'
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
    width: 1120,
    height: 760,
    minWidth: 800,
    minHeight: 560,
    title: 'Sideline',
    backgroundColor: '#050505',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.on('close', (event) => {
    if (runtime.isQuitting()) return
    event.preventDefault()
    win.hide()
  })

  loadRenderer(win, 'companion')
  runtime.setCompanion(win)
  return win
}

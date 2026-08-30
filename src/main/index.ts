import { app, globalShortcut } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { registerIpc } from './ipc'
import { startPoller, setOverlayVisible } from './poller'
import { runtime } from './runtime'
import { startOverlayServer, publishOverlay } from './server'
import { loadSettings } from './store'
import { createTray } from './tray'
import { createCompanionWindow } from './windows/companion'
import { overlayEditMode, setOverlayEditMode, toggleOverlay } from './windows/overlay'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

runtime.setPublishHud(publishOverlay)

app.on('second-instance', () => {
  createCompanionWindow().show()
})

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.sideline.app')

  if (process.platform === 'darwin') {
    app.dock?.hide()
    app.setActivationPolicy('accessory')
  }

  app.on('browser-window-created', (_event, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpc()
  const port = await startOverlayServer(7333, loadSettings().lanOverlayEnabled)
  runtime.setOverlayPort(port)

  createTray()
  createCompanionWindow()

  const settings = loadSettings()
  globalShortcut.register(settings.overlayHotkey, () => {
    const visible = toggleOverlay()
    setOverlayVisible(visible)
  })
  globalShortcut.register(settings.overlayEditHotkey, () => {
    const win = runtime.overlay()
    if (!win || win.isDestroyed() || !win.isVisible()) return
    setOverlayEditMode(!overlayEditMode())
  })

  startPoller()
})

app.on('activate', () => {
  createCompanionWindow().show()
})

app.on('before-quit', () => {
  runtime.setQuitting(true)
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && runtime.isQuitting()) {
    app.quit()
  }
})

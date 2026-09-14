import { app, globalShortcut, net } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { bindAppFetch, bindEspnFetch } from './http'
import { espnSession } from './windows/espnLogin'
import { registerIpc } from './ipc'
import { startPoller, warmupPollerCaches, publishWarmupState } from './poller'
import { runtime } from './runtime'
import { startOverlayServer, publishOverlay } from './server'
import { loadSettings } from './store'
import { registerAppShortcuts } from './shortcuts'
import { createTray } from './tray'
import { createCompanionWindow } from './windows/companion'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

runtime.setPublishHud(publishOverlay)

app.on('second-instance', () => {
  createCompanionWindow().show()
})

app.whenReady().then(async () => {
  bindAppFetch((url, init) => net.fetch(url, init))
  bindEspnFetch((url, init) => espnSession().fetch(url, init))
  electronApp.setAppUserModelId('com.sideline.app')

  if (process.platform === 'darwin') {
    app.dock?.hide()
    app.setActivationPolicy('accessory')
  }

  app.on('browser-window-created', (_event, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpc()
  warmupPollerCaches()
  const port = await startOverlayServer(7333, loadSettings().lanOverlayEnabled)
  runtime.setOverlayPort(port)
  publishWarmupState()

  createTray()
  createCompanionWindow()
  registerAppShortcuts()

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

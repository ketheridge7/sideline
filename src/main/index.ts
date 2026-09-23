import { app, globalShortcut, net } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { bindAppFetch, bindEspnFetch } from './http'
import { espnSession } from './windows/espnLogin'
import { registerIpc } from './ipc'
import { reportStartupError } from './notices'
import { applyLanOverlay, startPoller, warmupPollerCaches, publishWarmupState } from './poller'
import { runtime } from './runtime'
import { startOverlayServer, publishOverlay } from './server'
import { loadSettings } from './store'
import { registerAppShortcuts } from './shortcuts'
import { runStartup, startupErrorMessage } from './startup'
import { createTray } from './tray'
import { startAutoUpdater } from './updater'
import { createCompanionWindow } from './windows/companion'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

runtime.setPublishHud(publishOverlay)

app.on('second-instance', () => {
  createCompanionWindow().show()
})

app.whenReady().then(() => {
  if (!gotLock) return
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

  runStartup({
    registerIpc,
    warmupPollerCaches,
    publishWarmupState,
    startOverlayServer: () => startOverlayServer(7333, loadSettings().lanOverlayEnabled),
    onOverlayPort: (port) => {
      runtime.setOverlayPort(port)
      applyLanOverlay()
    },
    createTray,
    createCompanionWindow: () => {
      createCompanionWindow()
    },
    registerAppShortcuts,
    startAutoUpdater,
    startPoller,
    onStepFailed: (step, error) => {
      console.error(`[sideline] startup step ${step} failed`, error)
      reportStartupError(step, startupErrorMessage(step, error))
      if (step === 'overlay-server') applyLanOverlay()
    },
    onNoUi: () => {
      console.error('[sideline] no tray or companion window; quitting so a relaunch can retry')
      app.quit()
    }
  })
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

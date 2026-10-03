import { app, BrowserWindow, globalShortcut, net } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { bindAppFetch, bindEspnFetch } from './http'
import { resetLeagueBrowse } from './leagueBrowse'
import { espnSignInPreviewEnabled, previewEspnFetch, seedEspnSignInPreview } from './espnSignInPreview'
import { espnSession } from './windows/espnLogin'
import { registerIpc } from './ipc'
import { appendLog, bindLogDir, installProcessLogging, userDataLogDir } from './log'
import { reportStartupError } from './notices'
import { applyLanOverlay, startPoller, warmupPollerCaches, publishWarmupState } from './poller'
import { releaseLanPowerSave } from './powerSave'
import { runtime } from './runtime'
import { isLanOverlayToken } from '@shared/settings'
import { shortcutRegistrationError } from '@shared/shortcuts'
import { bindLanTokenPersistence, shutdownOverlayServerForQuit, startOverlayServer, publishOverlay } from './server'
import { loadSettings, saveSettings } from './store'
import { registerAppShortcuts } from './shortcuts'
import { runStartup, startupErrorMessage } from './startup'
import { persistSessionForRelaunch, restoreOverlayFromSettings } from './sessionRestore'
import { createTray, destroyTray } from './tray'
import { handleBeforeQuit } from './updateQuit'
import { armUpdatePreviewShot } from './updatePreviewShot'
import { noteCompanionReady, startAutoUpdater } from './updater'
import { createCompanionWindow } from './windows/companion'
import { listenForDisplayChanges } from './windows/placementHost'

installProcessLogging()

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

runtime.setPublishHud(publishOverlay)

app.on('second-instance', () => {
  createCompanionWindow().show()
})

const bindPersistedLanToken = (): void => {
  bindLanTokenPersistence({
    load: () => {
      const token = loadSettings().lanOverlayToken
      return isLanOverlayToken(token) ? token : null
    },
    save: (token) => {
      saveSettings({ lanOverlayToken: token })
    }
  })
}

const beginUpdateQuit = (): void => {
  runtime.setQuittingForUpdate(true)
  persistSessionForRelaunch()
  destroyTray()
  shutdownOverlayServerForQuit()
  app.releaseSingleInstanceLock()
}

app.whenReady().then(async () => {
  if (!gotLock) return
  listenForDisplayChanges()
  bindLogDir(userDataLogDir())
  runtime.setOnCompanionReady(noteCompanionReady)
  runtime.setBeginUpdateQuit(beginUpdateQuit)
  bindPersistedLanToken()
  bindAppFetch((url, init) => net.fetch(url, init))
  if (espnSignInPreviewEnabled()) {
    try {
      await seedEspnSignInPreview()
    } catch (error) {
      console.error('[sideline] ESPN sign-in preview seed failed', error)
    }
    bindEspnFetch((url, init) =>
      previewEspnFetch(url, init, (nextUrl, nextInit) => espnSession().fetch(nextUrl, nextInit))
    )
  } else {
    bindEspnFetch((url, init) => espnSession().fetch(url, init))
  }
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
    registerAppShortcuts: () => {
      const { failed } = registerAppShortcuts()
      const first = failed[0]
      if (!first) return
      runtime.sendToast({
        id: 'sideline:shortcut',
        title: 'Shortcut',
        body: shortcutRegistrationError(first.accelerator)
      })
    },
    startAutoUpdater,
    startPoller,
    onStepFailed: (step, error) => {
      const message = startupErrorMessage(step, error)
      console.error(`[sideline] startup step ${step} failed`, error)
      appendLog('error', 'startup step failed', { step, code: message.slice(0, 180) })
      reportStartupError(step, message)
      if (step === 'overlay-server') applyLanOverlay()
    },
    onNoUi: () => {
      console.error('[sideline] no tray or companion window; quitting so a relaunch can retry')
      app.quit()
    }
  })
  restoreOverlayFromSettings()
  armUpdatePreviewShot(() => runtime.companion())
})

app.on('activate', () => {
  createCompanionWindow().show()
})

app.on('before-quit', () => {
  resetLeagueBrowse()
  handleBeforeQuit({
    quittingForUpdate: runtime.isQuittingForUpdate(),
    setQuitting: () => runtime.setQuitting(true),
    persistSession: persistSessionForRelaunch,
    destroyTray,
    shutdownOverlayServer: shutdownOverlayServerForQuit,
    releaseSingleInstanceLock: () => {
      app.releaseSingleInstanceLock()
    },
    releasePowerSave: releaseLanPowerSave,
    unregisterShortcuts: () => {
      globalShortcut.unregisterAll()
    },
    windows: BrowserWindow.getAllWindows()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && (runtime.isQuitting() || runtime.isQuittingForUpdate())) {
    app.quit()
  }
})

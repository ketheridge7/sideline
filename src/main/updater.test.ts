import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '1.0.0'
  }
}))

vi.mock('electron-updater', () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    quitAndInstall: vi.fn()
  }
}))

vi.mock('./runtime', () => ({
  runtime: {
    sendUpdate: vi.fn(),
    sendToast: vi.fn(),
    setQuitting: vi.fn()
  }
}))

import type { UpdateSnapshot } from '@shared/updater'
import {
  bindSidelineUpdater,
  checkForUpdates,
  getUpdateStatus,
  installUpdate,
  resetUpdaterForTests,
  startAutoUpdater,
  type SidelineAutoUpdater,
  type SidelineUpdaterHost
} from './updater'

type FakeUpdater = SidelineAutoUpdater & {
  emit: (event: string, ...args: unknown[]) => void
  checkForUpdates: ReturnType<typeof vi.fn>
  quitAndInstall: ReturnType<typeof vi.fn>
}

const createFakeUpdater = (): FakeUpdater => {
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>()
  const updater: FakeUpdater = {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    on: (event, listener) => {
      const list = listeners.get(event) ?? []
      list.push(listener)
      listeners.set(event, list)
    },
    emit: (event, ...args) => {
      for (const listener of listeners.get(event) ?? []) listener(...args)
    },
    checkForUpdates: vi.fn(async () => {
      updater.emit('checking-for-update')
      updater.emit('update-not-available', { version: '1.0.0' })
      return {}
    }),
    quitAndInstall: vi.fn()
  }
  return updater
}

const createHost = (
  packaged: boolean,
  updater: FakeUpdater
): SidelineUpdaterHost & { toasts: UpdateSnapshot['state'][]; statuses: string[] } => {
  const toasts: UpdateSnapshot['state'][] = []
  const statuses: string[] = []
  return {
    isPackaged: () => packaged,
    currentVersion: () => '1.0.0',
    updater,
    sendStatus: (snapshot) => {
      statuses.push(snapshot.state)
    },
    sendToast: (toast) => {
      toasts.push(toast.id.replace('sideline:update-', '') as UpdateSnapshot['state'])
    },
    setQuitting: vi.fn(),
    toasts,
    statuses
  }
}

afterEach(() => {
  resetUpdaterForTests()
})

describe('startAutoUpdater', () => {
  it('does not talk to electron-updater in unpackaged / electron-vite builds', async () => {
    const updater = createFakeUpdater()
    const host = createHost(false, updater)
    bindSidelineUpdater(host)
    const snapshot = startAutoUpdater()
    expect(snapshot.state).toBe('disabled')
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
    expect(host.toasts).toEqual([])
    await checkForUpdates(true)
    expect(getUpdateStatus().state).toBe('disabled')
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
    expect(host.toasts).toEqual(['disabled'])
  })

  it('checks once on packaged startup and stays quiet when already current', async () => {
    const updater = createFakeUpdater()
    const host = createHost(true, updater)
    bindSidelineUpdater(host)
    startAutoUpdater()
    await vi.waitFor(() => expect(updater.checkForUpdates).toHaveBeenCalledTimes(1))
    expect(getUpdateStatus()).toMatchObject({ state: 'not-available', version: '1.0.0', currentVersion: '1.0.0' })
    expect(host.toasts).toEqual([])
    expect(updater.autoDownload).toBe(true)
    expect(updater.autoInstallOnAppQuit).toBe(true)
  })
})

describe('checkForUpdates', () => {
  it('toasts when an update is available or downloaded', async () => {
    const updater = createFakeUpdater()
    updater.checkForUpdates = vi.fn(async () => {
      updater.emit('update-available', { version: '1.0.1' })
      updater.emit('download-progress', { percent: 42 })
      updater.emit('update-downloaded', { version: '1.0.1' })
      return {}
    })
    const host = createHost(true, updater)
    bindSidelineUpdater(host)
    const snapshot = await checkForUpdates(false)
    expect(snapshot.state).toBe('downloaded')
    expect(snapshot).toMatchObject({ version: '1.0.1', currentVersion: '1.0.0' })
    expect(host.toasts).toEqual(['available', 'downloaded'])
  })

  it('toasts up-to-date when the user clicked Check for updates', async () => {
    const updater = createFakeUpdater()
    const host = createHost(true, updater)
    bindSidelineUpdater(host)
    await checkForUpdates(true)
    expect(host.toasts).toEqual(['not-available'])
  })

  it('maps thrown check failures to an error status', async () => {
    const updater = createFakeUpdater()
    updater.checkForUpdates = vi.fn(async () => {
      throw new Error('GitHub 404')
    })
    const host = createHost(true, updater)
    bindSidelineUpdater(host)
    const snapshot = await checkForUpdates(true)
    expect(snapshot).toMatchObject({ state: 'error', message: 'GitHub 404' })
    expect(host.toasts).toEqual(['error'])
  })

  it('does not start a second GitHub check while one is in flight', async () => {
    const updater = createFakeUpdater()
    let release!: () => void
    updater.checkForUpdates = vi.fn(
      () =>
        new Promise((resolve) => {
          release = () => {
            updater.emit('update-not-available', { version: '1.0.0' })
            resolve({})
          }
        })
    )
    const host = createHost(true, updater)
    bindSidelineUpdater(host)
    const first = checkForUpdates(true)
    await vi.waitFor(() => expect(updater.checkForUpdates).toHaveBeenCalledTimes(1))
    await checkForUpdates(true)
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
    release()
    await first
  })
})

describe('installUpdate', () => {
  it('quitAndInstalls NSIS only after a download, and marks the app quitting first', async () => {
    const updater = createFakeUpdater()
    updater.checkForUpdates = vi.fn(async () => {
      updater.emit('update-downloaded', { version: '1.0.1' })
      return {}
    })
    const host = createHost(true, updater)
    bindSidelineUpdater(host)
    expect(installUpdate()).toEqual({ ok: false, error: 'No update downloaded' })
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
    await checkForUpdates(false)
    expect(installUpdate()).toEqual({ ok: true })
    expect(host.setQuitting).toHaveBeenCalled()
    expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true)
  })
})

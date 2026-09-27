import { afterEach, describe, expect, it, vi } from 'vitest'
import { windowClosePlan } from './updateQuit'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '1.0.1'
  }
}))

vi.mock('electron-updater', () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    allowPrerelease: true,
    logger: null,
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn()
  }
}))

vi.mock('./runtime', () => ({
  runtime: {
    sendUpdate: vi.fn(),
    beginUpdateQuit: vi.fn()
  }
}))

vi.mock('./log', () => ({
  appendLog: vi.fn()
}))

import type { UpdateSnapshot } from '@shared/updater'
import {
  UPDATE_CHECK_INTERVAL_MS,
  UPDATE_FIRST_CHECK_DELAY_MS,
  bindSidelineUpdater,
  checkForUpdates,
  dismissUpdateCountdown,
  getUpdateStatus,
  installUpdate,
  noteCompanionReady,
  resetUpdaterForTests,
  startAutoUpdater,
  type SidelineAutoUpdater,
  type SidelineUpdaterHost
} from './updater'

type FakeUpdater = SidelineAutoUpdater & {
  emit: (event: string, ...args: unknown[]) => void
  checkForUpdates: ReturnType<typeof vi.fn>
  quitAndInstall: ReturnType<typeof vi.fn>
  publisherName?: string
}

const createFakeUpdater = (): FakeUpdater => {
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>()
  const updater: FakeUpdater = {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    allowPrerelease: true,
    logger: null,
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
      updater.emit('update-not-available', { version: '1.0.1' })
      return {}
    }),
    downloadUpdate: vi.fn(async () => {
      updater.emit('download-progress', { percent: 100 })
      updater.emit('update-downloaded', { version: '1.0.2' })
      return []
    }),
    quitAndInstall: vi.fn()
  }
  return updater
}

const createHost = (
  packaged: boolean,
  updater: FakeUpdater
): SidelineUpdaterHost & {
  statuses: string[]
  logs: string[]
  quitting: boolean
  quittingForUpdate: boolean
} => {
  const statuses: string[] = []
  const logs: string[] = []
  const host: SidelineUpdaterHost & {
    statuses: string[]
    logs: string[]
    quitting: boolean
    quittingForUpdate: boolean
  } = {
    isPackaged: () => packaged,
    currentVersion: () => '1.0.1',
    updater,
    sendStatus: (snapshot) => {
      statuses.push(snapshot.state)
    },
    log: (level, message) => {
      logs.push(`${level}:${message}`)
    },
    setQuittingForUpdate: () => {
      host.quitting = true
      host.quittingForUpdate = true
    },
    statuses,
    logs,
    quitting: false,
    quittingForUpdate: false
  }
  return host
}

const downloadedCheck = (updater: FakeUpdater, version = '1.0.2'): void => {
  updater.checkForUpdates = vi.fn(async () => {
    updater.emit('update-available', { version })
    updater.emit('download-progress', { percent: 40 })
    updater.emit('update-downloaded', { version })
    return {}
  })
}

afterEach(() => {
  resetUpdaterForTests()
  vi.useRealTimers()
  delete process.env.SIDELINE_UPDATE_PREVIEW
})

describe('startAutoUpdater', () => {
  it('stays idle until the companion window is ready, then checks in the background', async () => {
    vi.useFakeTimers()
    const updater = createFakeUpdater()
    const host = createHost(true, updater)
    bindSidelineUpdater(host)
    expect(getUpdateStatus().state).toBe('idle')
    startAutoUpdater()
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
    expect(updater.autoDownload).toBe(true)
    expect(updater.autoInstallOnAppQuit).toBe(true)
    expect(updater.allowPrerelease).toBe(false)
    expect(updater.publisherName).toBeUndefined()
    noteCompanionReady()
    await vi.advanceTimersByTimeAsync(UPDATE_FIRST_CHECK_DELAY_MS - 1)
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
    expect(getUpdateStatus()).toMatchObject({ state: 'not-available', version: '1.0.1', currentVersion: '1.0.1' })
    expect(host.logs.some((line) => line.startsWith('info:updater'))).toBe(true)
    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS)
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2)
  })

  it('does not talk to electron-updater in unpackaged builds', async () => {
    vi.useFakeTimers()
    const updater = createFakeUpdater()
    const host = createHost(false, updater)
    bindSidelineUpdater(host)
    const snapshot = startAutoUpdater()
    expect(snapshot.state).toBe('disabled')
    if (snapshot.state === 'disabled') expect(snapshot.reason).toBe('dev')
    noteCompanionReady()
    await vi.advanceTimersByTimeAsync(UPDATE_FIRST_CHECK_DELAY_MS + UPDATE_CHECK_INTERVAL_MS)
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
    const manual = await checkForUpdates(true)
    expect(manual.state).toBe('disabled')
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
  })
})

describe('checkForUpdates', () => {
  it('downloads in the background and opens a restart countdown', async () => {
    vi.useFakeTimers()
    const updater = createFakeUpdater()
    downloadedCheck(updater)
    const host = createHost(true, updater)
    bindSidelineUpdater(host)
    const snapshot = await checkForUpdates(false)
    expect(updater.downloadUpdate).not.toHaveBeenCalled()
    expect(snapshot.state).toBe('countdown')
    if (snapshot.state !== 'countdown') return
    expect(snapshot.version).toBe('1.0.2')
    expect(snapshot.seconds).toBe(10)
    expect(snapshot.currentVersion).toBe('1.0.1')
    expect(host.statuses).toEqual(['checking', 'available', 'downloading', 'countdown'])
  })

  it('says up to date when the user is already on the latest version', async () => {
    const updater = createFakeUpdater()
    const host = createHost(true, updater)
    bindSidelineUpdater(host)
    const snapshot = await checkForUpdates(true)
    expect(snapshot).toMatchObject({ state: 'not-available', version: '1.0.1' })
  })

  it('shows a manual check failure and stays quiet on an automatic one', async () => {
    const updater = createFakeUpdater()
    updater.checkForUpdates = vi.fn(async () => {
      throw new Error('Unable to find latest.yml 404')
    })
    const host = createHost(true, updater)
    bindSidelineUpdater(host)
    const automatic = await checkForUpdates(false)
    expect(automatic.state).toBe('idle')
    expect(host.logs.some((line) => line.startsWith('error:'))).toBe(true)
    updater.checkForUpdates = vi.fn(async () => {
      throw new Error('net::ERR_INTERNET_DISCONNECTED')
    })
    const manual = await checkForUpdates(true)
    expect(manual).toMatchObject({ state: 'error', message: 'Offline. Could not reach GitHub Releases.' })
  })

  it('does not start a second GitHub check while one is in flight', async () => {
    const updater = createFakeUpdater()
    let release!: () => void
    updater.checkForUpdates = vi.fn(
      () =>
        new Promise((resolve) => {
          release = () => {
            updater.emit('update-not-available', { version: '1.0.1' })
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

describe('countdown', () => {
  it('calls quitAndInstall(true, true) when the countdown ends and does not block close', async () => {
    vi.useFakeTimers()
    const updater = createFakeUpdater()
    downloadedCheck(updater)
    const host = createHost(true, updater)
    const order: string[] = []
    host.setQuittingForUpdate = () => {
      host.quitting = true
      host.quittingForUpdate = true
      order.push('quit-flag')
    }
    updater.quitAndInstall = vi.fn(() => {
      order.push('install')
    })
    bindSidelineUpdater(host)
    await checkForUpdates(false)
    expect(getUpdateStatus().state).toBe('countdown')
    await vi.advanceTimersByTimeAsync(9_000)
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
    expect(getUpdateStatus()).toMatchObject({ state: 'countdown', seconds: 1 })
    await vi.advanceTimersByTimeAsync(1_000)
    expect(updater.quitAndInstall).toHaveBeenCalledWith(true, true)
    expect(order).toEqual(['quit-flag', 'install'])
    expect(getUpdateStatus().state).toBe('installing')
    const event = { preventDefault: vi.fn() }
    if (windowClosePlan(host.quitting, host.quittingForUpdate) === 'hide') event.preventDefault()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('Later dismisses the banner and will not count down that version again', async () => {
    vi.useFakeTimers()
    const updater = createFakeUpdater()
    downloadedCheck(updater)
    const host = createHost(true, updater)
    bindSidelineUpdater(host)
    await checkForUpdates(false)
    const deferred = dismissUpdateCountdown()
    expect(deferred).toMatchObject({ state: 'downloaded', version: '1.0.2' })
    await vi.advanceTimersByTimeAsync(15_000)
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
    updater.emit('update-downloaded', { version: '1.0.2' })
    expect(getUpdateStatus().state).toBe('downloaded')
    updater.emit('update-downloaded', { version: '1.0.3' })
    expect(getUpdateStatus()).toMatchObject({ state: 'countdown', version: '1.0.3', seconds: 10 })
  })

  it('Restart now installs immediately', async () => {
    const updater = createFakeUpdater()
    downloadedCheck(updater)
    const host = createHost(true, updater)
    bindSidelineUpdater(host)
    expect(installUpdate()).toEqual({ ok: false, error: 'No update downloaded' })
    await checkForUpdates(true)
    expect(installUpdate()).toEqual({ ok: true })
    expect(host.quittingForUpdate).toBe(true)
    expect(updater.quitAndInstall).toHaveBeenCalledWith(true, true)
    expect(getUpdateStatus().state).toBe('installing')
  })
})

describe('dev preview', () => {
  it('forces a countdown snapshot without calling electron-updater', () => {
    process.env.SIDELINE_UPDATE_PREVIEW = 'countdown'
    const updater = createFakeUpdater()
    const host = createHost(false, updater)
    bindSidelineUpdater(host)
    const snapshot: UpdateSnapshot = startAutoUpdater()
    expect(snapshot).toMatchObject({ state: 'countdown', version: '1.0.2', seconds: 10 })
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
  })
})

import { app } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import { runtime } from './runtime'
import {
  shouldToastUpdate,
  updateToast,
  type UpdateSnapshot,
  type UpdateStatus
} from '@shared/updater'

export type SidelineAutoUpdater = {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  on: (event: string, listener: (...args: unknown[]) => void) => unknown
  checkForUpdates: () => Promise<unknown>
  downloadUpdate: () => Promise<unknown>
  quitAndInstall: (isSilent?: boolean, isForceRunAfter?: boolean) => void
}

export type SidelineUpdaterHost = {
  isPackaged: () => boolean
  currentVersion: () => string
  updater: SidelineAutoUpdater
  sendStatus: (snapshot: UpdateSnapshot) => void
  sendToast: (toast: { id: string; title: string; body: string }) => void
  setQuitting: () => void
}

let host: SidelineUpdaterHost | null = null
let status: UpdateStatus = { state: 'idle' }
let bound = false
let userInitiated = false
let inFlight = false

const snapshot = (): UpdateSnapshot => ({
  currentVersion: host?.currentVersion() ?? '0.0.0',
  ...status
})

const applyStatus = (next: UpdateStatus): UpdateSnapshot => {
  status = next
  const current = snapshot()
  host?.sendStatus(current)
  if (host && shouldToastUpdate(next, userInitiated)) {
    host.sendToast(updateToast(next, current.currentVersion))
  }
  return current
}

const errorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return 'Update check failed'
}

const bindEvents = (updater: SidelineAutoUpdater): void => {
  if (bound) return
  bound = true
  // Who receives the download is `stagingPercentage` in latest.yml.
  // electron-updater skips the update when this install is outside that rollout.
  // An omitted percentage updates everyone. Dev and preview never reach this.
  updater.autoDownload = false
  updater.autoInstallOnAppQuit = true
  updater.on('checking-for-update', () => {
    applyStatus({ state: 'checking' })
  })
  updater.on('update-available', (...args: unknown[]) => {
    const info = args[0] as UpdateInfo | undefined
    applyStatus({ state: 'available', version: info?.version ?? 'unknown' })
  })
  updater.on('update-not-available', (...args: unknown[]) => {
    const info = args[0] as UpdateInfo | undefined
    applyStatus({ state: 'not-available', version: info?.version ?? host?.currentVersion() ?? '0.0.0' })
  })
  updater.on('download-progress', (...args: unknown[]) => {
    const progress = args[0] as ProgressInfo | undefined
    applyStatus({ state: 'downloading', percent: progress?.percent ?? 0 })
  })
  updater.on('update-downloaded', (...args: unknown[]) => {
    const info = args[0] as UpdateInfo | undefined
    applyStatus({ state: 'downloaded', version: info?.version ?? 'unknown' })
  })
  updater.on('error', (...args: unknown[]) => {
    applyStatus({ state: 'error', message: errorMessage(args[0]) })
  })
}

const ensureHost = (): SidelineUpdaterHost => {
  if (host) return host
  const created: SidelineUpdaterHost = {
    isPackaged: () => app.isPackaged,
    currentVersion: () => app.getVersion(),
    updater: autoUpdater as unknown as SidelineAutoUpdater,
    sendStatus: (next) => runtime.sendUpdate(next),
    sendToast: (toast) => runtime.sendToast(toast),
    setQuitting: () => runtime.setQuitting(true)
  }
  host = created
  return created
}

export const bindSidelineUpdater = (next: SidelineUpdaterHost): void => {
  host = next
}

export const getUpdateStatus = (): UpdateSnapshot => snapshot()

export const startAutoUpdater = (): UpdateSnapshot => {
  const current = ensureHost()
  if (!current.isPackaged()) {
    return applyStatus({ state: 'disabled', reason: 'dev' })
  }
  bindEvents(current.updater)
  void checkForUpdates(false)
  return snapshot()
}

export const checkForUpdates = async (initiatedByUser: boolean): Promise<UpdateSnapshot> => {
  const current = ensureHost()
  userInitiated = initiatedByUser
  if (!current.isPackaged()) {
    return applyStatus({ state: 'disabled', reason: 'dev' })
  }
  if (inFlight || status.state === 'checking' || status.state === 'downloading') {
    return snapshot()
  }
  bindEvents(current.updater)
  inFlight = true
  applyStatus({ state: 'checking' })
  try {
    await current.updater.checkForUpdates()
    return snapshot()
  } catch (error) {
    return applyStatus({ state: 'error', message: errorMessage(error) })
  } finally {
    inFlight = false
  }
}

export const downloadUpdate = async (): Promise<UpdateSnapshot> => {
  const current = ensureHost()
  if (!current.isPackaged()) {
    return applyStatus({ state: 'disabled', reason: 'dev' })
  }
  if (status.state !== 'available' || inFlight) return snapshot()
  bindEvents(current.updater)
  inFlight = true
  try {
    await current.updater.downloadUpdate()
    return snapshot()
  } catch (error) {
    return applyStatus({ state: 'error', message: errorMessage(error) })
  } finally {
    inFlight = false
  }
}

export const installUpdate = (): { ok: true } | { ok: false; error: string } => {
  const current = ensureHost()
  if (status.state !== 'downloaded') {
    return { ok: false, error: 'No update downloaded' }
  }
  current.setQuitting()
  current.updater.quitAndInstall(false, true)
  return { ok: true }
}

export const resetUpdaterForTests = (): void => {
  host = null
  status = { state: 'idle' }
  bound = false
  userInitiated = false
  inFlight = false
}

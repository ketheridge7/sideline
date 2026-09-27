import { app } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import {
  presentUpdateError,
  shouldSurfaceUpdateError,
  UPDATE_RESTART_SECONDS,
  type UpdateSnapshot,
  type UpdateStatus
} from '@shared/updater'
import { appendLog } from './log'
import { runtime } from './runtime'

export const UPDATE_FIRST_CHECK_DELAY_MS = 5_000
export const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

export type UpdaterLogger = {
  info: (message?: unknown) => void
  warn: (message?: unknown) => void
  error: (message?: unknown) => void
  debug?: (message?: unknown) => void
}

export type SidelineAutoUpdater = {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  allowPrerelease: boolean
  logger: UpdaterLogger | null
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
  log: (level: 'info' | 'warn' | 'error', message: string, code?: string) => void
  setQuittingForUpdate: () => void
}

let host: SidelineUpdaterHost | null = null
let status: UpdateStatus = { state: 'idle' }
let lastQuiet: UpdateStatus = { state: 'idle' }
let bound = false
let userInitiated = false
let inFlight = false
let started = false
let companionReady = false
let checksArmed = false
let epoch = 0
let pendingVersion: string | null = null
let deferredVersion: string | null = null
let checkTimer: ReturnType<typeof setTimeout> | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null

const snapshot = (): UpdateSnapshot => ({
  currentVersion: host?.currentVersion() ?? '0.0.0',
  ...status
})

const versionOf = (next: UpdateStatus): string | null => {
  switch (next.state) {
    case 'available':
    case 'not-available':
    case 'downloading':
    case 'downloaded':
    case 'countdown':
    case 'installing':
      return next.version
    case 'idle':
    case 'disabled':
    case 'checking':
    case 'error':
      return null
    default: {
      const _never: never = next
      return _never
    }
  }
}

const rememberQuiet = (next: UpdateStatus): void => {
  switch (next.state) {
    case 'idle':
    case 'disabled':
    case 'not-available':
    case 'downloaded':
    case 'countdown':
    case 'installing':
      lastQuiet = next
      return
    case 'checking':
    case 'available':
    case 'downloading':
    case 'error':
      return
    default: {
      const _never: never = next
      return _never
    }
  }
}

const shouldLog = (next: UpdateStatus): boolean => {
  if (next.state === 'countdown' && next.seconds !== UPDATE_RESTART_SECONDS) return false
  if (next.state === 'downloading' && next.percent > 0 && next.percent < 100) return false
  return true
}

const applyStatus = (next: UpdateStatus): UpdateSnapshot => {
  status = next
  rememberQuiet(next)
  const current = snapshot()
  host?.sendStatus(current)
  if (host && shouldLog(next)) {
    const code = versionOf(next) ?? (next.state === 'error' ? next.message : next.state === 'disabled' ? next.reason : undefined)
    host.log(next.state === 'error' ? 'error' : 'info', `updater ${next.state}`, code?.slice(0, 180))
  }
  return current
}

const fail = (error: unknown): UpdateSnapshot => {
  const message = presentUpdateError(error)
  host?.log('error', 'updater error', message.slice(0, 180))
  if (shouldSurfaceUpdateError(userInitiated)) return applyStatus({ state: 'error', message })
  return applyStatus(lastQuiet)
}

const clearCountdown = (): void => {
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = null
}

const clearCheckTimer = (): void => {
  if (checkTimer) clearTimeout(checkTimer)
  checkTimer = null
}

const blocksCheck = (state: UpdateStatus['state']): boolean => {
  switch (state) {
    case 'checking':
    case 'downloading':
    case 'countdown':
    case 'installing':
      return true
    case 'idle':
    case 'disabled':
    case 'available':
    case 'not-available':
    case 'downloaded':
    case 'error':
      return false
    default: {
      const _never: never = state
      return _never
    }
  }
}

const previewStatus = (): UpdateStatus | null => {
  if (app.isPackaged) return null
  switch (process.env.SIDELINE_UPDATE_PREVIEW) {
    case 'countdown':
      return { state: 'countdown', version: '1.0.2', seconds: UPDATE_RESTART_SECONDS }
    case 'ready':
      return { state: 'downloaded', version: '1.0.2' }
    case 'downloading':
      return { state: 'downloading', percent: 42, version: '1.0.2' }
    case 'checking':
      return { state: 'checking' }
    case 'current':
      return { state: 'not-available', version: '1.0.1' }
    case 'error':
      return { state: 'error', message: 'Offline. Could not reach GitHub Releases.' }
    default:
      return null
  }
}

const clip = (message: unknown): string => String(message ?? '').replace(/[\r\n]/g, ' ').slice(0, 300)

const bindEvents = (updater: SidelineAutoUpdater): void => {
  if (bound) return
  bound = true
  // Who receives the download is `stagingPercentage` in latest.yml.
  // electron-updater skips the update when this install is outside that rollout.
  // An omitted percentage updates everyone. Dev and preview never reach this.
  //
  // Unsigned NSIS. electron-updater verifies Authenticode only when publisherName
  // is set here or in app-update.yml. Leaving it unset skips verification, so an
  // unsigned GitHub Releases feed does not fail the check.
  updater.autoDownload = true
  updater.autoInstallOnAppQuit = true
  updater.allowPrerelease = false
  updater.logger = {
    info: (message) => host?.log('info', `updater ${clip(message)}`),
    warn: (message) => host?.log('warn', `updater ${clip(message)}`),
    error: (message) => host?.log('error', `updater ${clip(message)}`),
    debug: (message) => host?.log('info', `updater ${clip(message)}`)
  }
  updater.on('checking-for-update', () => {
    applyStatus({ state: 'checking' })
  })
  updater.on('update-available', (...args: unknown[]) => {
    const info = args[0] as UpdateInfo | undefined
    pendingVersion = info?.version ?? 'unknown'
    applyStatus({ state: 'available', version: pendingVersion })
  })
  updater.on('update-not-available', (...args: unknown[]) => {
    const info = args[0] as UpdateInfo | undefined
    applyStatus({ state: 'not-available', version: info?.version ?? host?.currentVersion() ?? '0.0.0' })
  })
  updater.on('download-progress', (...args: unknown[]) => {
    const progress = args[0] as ProgressInfo | undefined
    const percent = Math.max(0, Math.min(100, progress?.percent ?? 0))
    applyStatus({ state: 'downloading', percent, version: pendingVersion ?? 'unknown' })
  })
  updater.on('update-downloaded', (...args: unknown[]) => {
    const info = args[0] as UpdateInfo | undefined
    const version = info?.version ?? pendingVersion ?? 'unknown'
    pendingVersion = version
    if (deferredVersion === version) {
      applyStatus({ state: 'downloaded', version })
      return
    }
    beginCountdown(version)
  })
  updater.on('error', (...args: unknown[]) => {
    fail(args[0])
  })
}

const beginCountdown = (version: string): void => {
  clearCountdown()
  let seconds = UPDATE_RESTART_SECONDS
  const token = epoch
  applyStatus({ state: 'countdown', version, seconds })
  countdownTimer = setInterval(() => {
    if (token !== epoch) return
    seconds -= 1
    if (seconds <= 0) {
      clearCountdown()
      installUpdate()
      return
    }
    applyStatus({ state: 'countdown', version, seconds })
  }, 1000)
}

const ensureHost = (): SidelineUpdaterHost => {
  if (host) return host
  const created: SidelineUpdaterHost = {
    isPackaged: () => app.isPackaged,
    currentVersion: () => app.getVersion(),
    updater: autoUpdater as unknown as SidelineAutoUpdater,
    sendStatus: (next) => runtime.sendUpdate(next),
    log: (level, message, code) => appendLog(level, message, code ? { code } : undefined),
    setQuittingForUpdate: () => runtime.beginUpdateQuit()
  }
  host = created
  return created
}

const scheduleCheck = (delay: number): void => {
  const token = epoch
  clearCheckTimer()
  checkTimer = setTimeout(() => {
    if (token !== epoch) return
    checkTimer = null
    void checkForUpdates(false).finally(() => {
      if (token !== epoch || !started) return
      scheduleCheck(UPDATE_CHECK_INTERVAL_MS)
    })
  }, delay)
}

const armChecks = (): void => {
  if (checksArmed || !started || !companionReady) return
  if (!host?.isPackaged()) return
  checksArmed = true
  scheduleCheck(UPDATE_FIRST_CHECK_DELAY_MS)
}

export const bindSidelineUpdater = (next: SidelineUpdaterHost): void => {
  host = next
}

export const getUpdateStatus = (): UpdateSnapshot => snapshot()

export const noteCompanionReady = (): void => {
  companionReady = true
  armChecks()
}

export const startAutoUpdater = (): UpdateSnapshot => {
  const current = ensureHost()
  started = true
  if (!current.isPackaged()) {
    const preview = previewStatus()
    if (preview) return applyStatus(preview)
    return applyStatus({ state: 'disabled', reason: 'dev' })
  }
  bindEvents(current.updater)
  armChecks()
  return snapshot()
}

export const checkForUpdates = async (initiatedByUser: boolean): Promise<UpdateSnapshot> => {
  const current = ensureHost()
  if (!current.isPackaged()) {
    userInitiated = initiatedByUser
    const preview = previewStatus()
    if (preview) return applyStatus(preview)
    return applyStatus({ state: 'disabled', reason: 'dev' })
  }
  if (inFlight || blocksCheck(status.state)) return snapshot()
  userInitiated = initiatedByUser
  bindEvents(current.updater)
  inFlight = true
  applyStatus({ state: 'checking' })
  try {
    await current.updater.checkForUpdates()
    return snapshot()
  } catch (error) {
    return fail(error)
  } finally {
    inFlight = false
  }
}

export const downloadUpdate = async (): Promise<UpdateSnapshot> => {
  const current = ensureHost()
  if (!current.isPackaged()) return applyStatus({ state: 'disabled', reason: 'dev' })
  if (status.state !== 'available' || inFlight) return snapshot()
  bindEvents(current.updater)
  inFlight = true
  try {
    await current.updater.downloadUpdate()
    return snapshot()
  } catch (error) {
    return fail(error)
  } finally {
    inFlight = false
  }
}

export const dismissUpdateCountdown = (): UpdateSnapshot => {
  if (status.state !== 'countdown') return snapshot()
  const version = status.version
  deferredVersion = version
  clearCountdown()
  return applyStatus({ state: 'downloaded', version })
}

export const installUpdate = (): { ok: true } | { ok: false; error: string } => {
  if (status.state !== 'downloaded' && status.state !== 'countdown') {
    return { ok: false, error: 'No update downloaded' }
  }
  const version = status.version
  const current = ensureHost()
  clearCountdown()
  clearCheckTimer()
  applyStatus({ state: 'installing', version })
  current.setQuittingForUpdate()
  current.updater.quitAndInstall(true, true)
  return { ok: true }
}

export const resetUpdaterForTests = (): void => {
  epoch += 1
  clearCheckTimer()
  clearCountdown()
  host = null
  status = { state: 'idle' }
  lastQuiet = { state: 'idle' }
  bound = false
  userInitiated = false
  inFlight = false
  started = false
  companionReady = false
  checksArmed = false
  pendingVersion = null
  deferredVersion = null
}

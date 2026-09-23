import { OverlayListenError } from './overlayListen'

export type StartupStep =
  | 'ipc'
  | 'warmup'
  | 'warmup-publish'
  | 'overlay-server'
  | 'overlay-port'
  | 'tray'
  | 'companion'
  | 'shortcuts'
  | 'updater'
  | 'poller'

export type StartupDeps = {
  registerIpc: () => void
  warmupPollerCaches: () => void
  publishWarmupState: () => void
  startOverlayServer: () => Promise<number>
  onOverlayPort: (port: number) => void
  createTray: () => void
  createCompanionWindow: () => void
  registerAppShortcuts: () => void
  startAutoUpdater: () => void
  startPoller: () => void
  onStepFailed: (step: StartupStep, error: unknown) => void
  /** Called when neither the tray nor the companion window came up, so the single-instance lock is not held headless. */
  onNoUi: () => void
}

export type StartupResult = {
  failed: StartupStep[]
  overlay: Promise<number | null>
}

/**
 * Each step is isolated: a throw is reported and the next step still runs.
 * The overlay server is started but never awaited before the tray, companion
 * window, and poller — a bind failure only costs the OBS/TV URLs.
 */
export const runStartup = (deps: StartupDeps): StartupResult => {
  const failed: StartupStep[] = []
  const step = (name: StartupStep, run: () => void): boolean => {
    try {
      run()
      return true
    } catch (error) {
      failed.push(name)
      deps.onStepFailed(name, error)
      return false
    }
  }

  step('ipc', deps.registerIpc)
  step('warmup', deps.warmupPollerCaches)

  let serverStart: Promise<number>
  try {
    serverStart = deps.startOverlayServer()
  } catch (error) {
    serverStart = Promise.reject(error)
  }
  const overlay = serverStart.then(
    (port) => {
      step('overlay-port', () => deps.onOverlayPort(port))
      return port
    },
    (error: unknown) => {
      failed.push('overlay-server')
      deps.onStepFailed('overlay-server', error)
      return null
    }
  )

  step('warmup-publish', deps.publishWarmupState)
  const trayUp = step('tray', deps.createTray)
  const companionUp = step('companion', deps.createCompanionWindow)
  step('shortcuts', deps.registerAppShortcuts)
  step('updater', deps.startAutoUpdater)
  step('poller', deps.startPoller)
  if (!trayUp && !companionUp) deps.onNoUi()

  return { failed, overlay }
}

const errorMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : String(error)

/** User-facing banner text for a failed startup step. */
export const startupErrorMessage = (step: StartupStep, error: unknown): string => {
  switch (step) {
    case 'overlay-server': {
      const range =
        error instanceof OverlayListenError
          ? ` on ports ${error.startPort}-${error.endPort}${error.code ? ` (${error.code})` : ''}`
          : ''
      return `Overlay server could not start${range}. The HUD window still works; OBS and TV links are offline.`
    }
    case 'overlay-port':
      return `Overlay server started but its port could not be published: ${errorMessage(error)}`
    case 'ipc':
    case 'warmup':
    case 'warmup-publish':
    case 'tray':
    case 'companion':
    case 'shortcuts':
    case 'updater':
    case 'poller':
      return `Startup step "${step}" failed: ${errorMessage(error)}`
    default: {
      const _never: never = step
      return _never
    }
  }
}

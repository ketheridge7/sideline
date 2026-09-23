import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetNoticesForTests, reportStartupError, startupErrorNotice, statusErrorPlan, clearStartupError } from './notices'
import { OverlayListenError } from './overlayListen'
import { runStartup, startupErrorMessage, type StartupDeps } from './startup'

const deps = (overrides: Partial<StartupDeps> = {}): StartupDeps & { calls: string[] } => {
  const calls: string[] = []
  const track = (name: string) => () => {
    calls.push(name)
  }
  return {
    calls,
    registerIpc: track('ipc'),
    warmupPollerCaches: track('warmup'),
    publishWarmupState: track('warmup-publish'),
    startOverlayServer: () => {
      calls.push('overlay-server')
      return Promise.resolve(7333)
    },
    onOverlayPort: (port) => {
      calls.push(`overlay-port:${port}`)
    },
    createTray: track('tray'),
    createCompanionWindow: track('companion'),
    registerAppShortcuts: track('shortcuts'),
    startAutoUpdater: track('updater'),
    startPoller: track('poller'),
    onStepFailed: vi.fn(),
    onNoUi: vi.fn(),
    ...overrides
  }
}

afterEach(() => {
  resetNoticesForTests()
})

describe('runStartup', () => {
  it('creates tray, companion, and poller before the overlay server settles', async () => {
    let resolveServer: (port: number) => void = () => undefined
    const d = deps({
      startOverlayServer: () => new Promise<number>((resolve) => (resolveServer = resolve))
    })
    const result = runStartup(d)
    expect(d.calls).toEqual(['ipc', 'warmup', 'warmup-publish', 'tray', 'companion', 'shortcuts', 'updater', 'poller'])
    resolveServer(7335)
    await expect(result.overlay).resolves.toBe(7335)
    expect(d.calls.at(-1)).toBe('overlay-port:7335')
    expect(d.onStepFailed).not.toHaveBeenCalled()
  })

  it('still shows UI and starts the poller when the overlay server rejects (EACCES on every port)', async () => {
    const failure = new OverlayListenError('EACCES', 7333, 7362)
    const d = deps({ startOverlayServer: () => Promise.reject(failure) })
    const result = runStartup(d)
    await expect(result.overlay).resolves.toBeNull()
    expect(d.calls).toContain('tray')
    expect(d.calls).toContain('companion')
    expect(d.calls).toContain('poller')
    expect(d.calls.some((call) => call.startsWith('overlay-port'))).toBe(false)
    expect(d.onStepFailed).toHaveBeenCalledWith('overlay-server', failure)
    expect(result.failed).toContain('overlay-server')
    expect(d.onNoUi).not.toHaveBeenCalled()
  })

  it('treats a synchronous overlay throw like a rejection', async () => {
    const d = deps({
      startOverlayServer: () => {
        throw new Error('boom')
      }
    })
    const result = runStartup(d)
    await expect(result.overlay).resolves.toBeNull()
    expect(d.calls).toContain('companion')
    expect(d.onStepFailed).toHaveBeenCalledWith('overlay-server', expect.any(Error))
  })

  it('keeps going when warmup throws (e.g. a settings write fails)', () => {
    const d = deps({
      warmupPollerCaches: () => {
        throw new Error('EPERM settings')
      }
    })
    const result = runStartup(d)
    expect(result.failed).toEqual(['warmup'])
    expect(d.calls).toEqual(expect.arrayContaining(['tray', 'companion', 'poller']))
  })

  it('quits instead of holding the single-instance lock headless when no UI surface comes up', () => {
    const d = deps({
      createTray: () => {
        throw new Error('tray')
      },
      createCompanionWindow: () => {
        throw new Error('window')
      }
    })
    runStartup(d)
    expect(d.onNoUi).toHaveBeenCalledTimes(1)
  })

  it('does not quit when only one UI surface fails', () => {
    const d = deps({
      createTray: () => {
        throw new Error('tray')
      }
    })
    runStartup(d)
    expect(d.onNoUi).not.toHaveBeenCalled()
    expect(d.calls).toContain('companion')
  })
})

describe('startupErrorMessage', () => {
  it('names the port range and errno for an overlay bind failure', () => {
    expect(startupErrorMessage('overlay-server', new OverlayListenError('EACCES', 7333, 7362))).toBe(
      'Overlay server could not start on ports 7333-7362 (EACCES). The HUD window still works; OBS and TV links are offline.'
    )
  })
})

describe('startup notices', () => {
  it('keeps a startup failure sticky until cleared, below any refresh error', () => {
    reportStartupError('overlay-server', 'Overlay down')
    expect(startupErrorNotice()).toBe('Overlay down')
    expect(statusErrorPlan({ refreshError: null, startupError: startupErrorNotice(), holdNotice: null })).toBe(
      'Overlay down'
    )
    expect(statusErrorPlan({ refreshError: 'Could not confirm NFL week', startupError: 'Overlay down', holdNotice: 'x' })).toBe(
      'Could not confirm NFL week'
    )
    clearStartupError('overlay-server')
    expect(startupErrorNotice()).toBeNull()
    expect(statusErrorPlan({ refreshError: null, startupError: null, holdNotice: 'ESPN slow, holding' })).toBe(
      'ESPN slow, holding'
    )
  })
})

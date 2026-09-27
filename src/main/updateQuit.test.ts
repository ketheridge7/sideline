import { describe, expect, it, vi } from 'vitest'
import { handleBeforeQuit, windowClosePlan } from './updateQuit'

describe('windowClosePlan', () => {
  it('hides the companion on close-to-tray and lets an update quit replace files', () => {
    expect(windowClosePlan(false, false)).toBe('hide')
    expect(windowClosePlan(true, false)).toBe('close')
    expect(windowClosePlan(false, true)).toBe('close')
  })

  it('does not preventDefault once quitting for an update', () => {
    const event = { preventDefault: vi.fn() }
    if (windowClosePlan(false, true) === 'hide') event.preventDefault()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })
})

describe('handleBeforeQuit', () => {
  const deps = () => {
    const windows = [{ removeAllListeners: vi.fn() }]
    return {
      windows,
      setQuitting: vi.fn(),
      persistSession: vi.fn(),
      destroyTray: vi.fn(),
      shutdownOverlayServer: vi.fn(),
      releaseSingleInstanceLock: vi.fn(),
      releasePowerSave: vi.fn(),
      unregisterShortcuts: vi.fn()
    }
  }

  it('persists session and releases the process on every quit', () => {
    const harness = deps()
    handleBeforeQuit({ ...harness, quittingForUpdate: false })
    expect(harness.setQuitting).toHaveBeenCalledTimes(1)
    expect(harness.persistSession).toHaveBeenCalledTimes(1)
    expect(harness.destroyTray).toHaveBeenCalledTimes(1)
    expect(harness.shutdownOverlayServer).toHaveBeenCalledTimes(1)
    expect(harness.releaseSingleInstanceLock).toHaveBeenCalledTimes(1)
    expect(harness.windows[0]?.removeAllListeners).not.toHaveBeenCalled()
  })

  it('drops close handlers so quitAndInstall cannot be cancelled', () => {
    const harness = deps()
    handleBeforeQuit({ ...harness, quittingForUpdate: true })
    expect(harness.windows[0]?.removeAllListeners).toHaveBeenCalledWith('close')
  })
})

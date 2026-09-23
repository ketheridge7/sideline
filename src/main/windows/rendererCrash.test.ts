import { describe, expect, it, vi } from 'vitest'
import { createRendererRecovery, rendererGonePlan } from './rendererCrash'

describe('rendererGonePlan', () => {
  it('ignores a clean exit and a quit, reloads a crash, and stops after the cap', () => {
    expect(rendererGonePlan({ reason: 'clean-exit', quitting: false, reloadsInWindow: 0, maxReloads: 3 })).toBe('ignore')
    expect(rendererGonePlan({ reason: 'crashed', quitting: true, reloadsInWindow: 0, maxReloads: 3 })).toBe('ignore')
    expect(rendererGonePlan({ reason: 'crashed', quitting: false, reloadsInWindow: 0, maxReloads: 3 })).toBe('reload')
    expect(rendererGonePlan({ reason: 'oom', quitting: false, reloadsInWindow: 3, maxReloads: 3 })).toBe('stop')
  })
})

describe('createRendererRecovery', () => {
  it('reloads a gone overlay renderer and forces click-through', () => {
    const reload = vi.fn()
    const forceClickThrough = vi.fn()
    const log = vi.fn()
    const recovery = createRendererRecovery({
      role: 'overlay',
      quitting: () => false,
      isDestroyed: () => false,
      reload,
      forceClickThrough,
      log,
      maxReloads: 2
    })
    recovery.noteGone({ reason: 'crashed', exitCode: 11 })
    expect(forceClickThrough).toHaveBeenCalledTimes(1)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith('error', 'overlay renderer gone', { reason: 'crashed', exitCode: 11 })
    recovery.noteUnresponsive()
    expect(forceClickThrough).toHaveBeenCalledTimes(2)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload a companion renderer that exited cleanly', () => {
    const reload = vi.fn()
    const recovery = createRendererRecovery({
      role: 'companion',
      quitting: () => false,
      isDestroyed: () => false,
      reload,
      log: vi.fn()
    })
    recovery.noteGone({ reason: 'clean-exit', exitCode: 0 })
    expect(reload).not.toHaveBeenCalled()
  })
})

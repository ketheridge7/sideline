import { describe, expect, it } from 'vitest'
import { shouldToastUpdate, updateStatusCopy, updateToast, type UpdateStatus } from './updater'

describe('updateStatusCopy', () => {
  it('explains that unpackaged / electron-vite builds skip GitHub checks', () => {
    const copy = updateStatusCopy({ state: 'disabled', reason: 'dev' }, '1.0.0')
    expect(copy.body).toContain('1.0.0')
    expect(copy.body).toContain('GitHub Releases')
    expect(copy.body).toContain('npm start')
  })

  it('points Restart to install at Connect after a download', () => {
    const copy = updateStatusCopy({ state: 'downloaded', version: '1.0.1' }, '1.0.0')
    expect(copy.body).toContain('1.0.1')
    expect(copy.body).toContain('Restart to install')
  })
})

describe('shouldToastUpdate', () => {
  it('toasts available and downloaded on silent startup checks', () => {
    expect(shouldToastUpdate({ state: 'available', version: '1.0.1' }, false)).toBe(true)
    expect(shouldToastUpdate({ state: 'downloaded', version: '1.0.1' }, false)).toBe(true)
    expect(shouldToastUpdate({ state: 'not-available', version: '1.0.0' }, false)).toBe(false)
    expect(shouldToastUpdate({ state: 'checking' }, false)).toBe(false)
    expect(shouldToastUpdate({ state: 'downloading', percent: 40 }, false)).toBe(false)
    expect(shouldToastUpdate({ state: 'error', message: 'offline' }, false)).toBe(false)
    expect(shouldToastUpdate({ state: 'disabled', reason: 'dev' }, false)).toBe(false)
  })

  it('toasts up-to-date, errors, and dev-disabled only when the user clicked Check', () => {
    expect(shouldToastUpdate({ state: 'not-available', version: '1.0.0' }, true)).toBe(true)
    expect(shouldToastUpdate({ state: 'error', message: 'offline' }, true)).toBe(true)
    expect(shouldToastUpdate({ state: 'disabled', reason: 'dev' }, true)).toBe(true)
    expect(shouldToastUpdate({ state: 'checking' }, true)).toBe(false)
  })
})

describe('updateToast', () => {
  it('uses a status-toast id so the companion banner can show it on any screen', () => {
    const toast = updateToast({ state: 'available', version: '1.1.0' }, '1.0.0')
    expect(toast.id).toBe('sideline:update-available')
    expect(toast.body).toContain('1.1.0')
  })

  it('covers every status variant for copy', () => {
    const cases: UpdateStatus[] = [
      { state: 'idle' },
      { state: 'disabled', reason: 'dev' },
      { state: 'checking' },
      { state: 'available', version: '1.0.1' },
      { state: 'not-available', version: '1.0.0' },
      { state: 'downloading', percent: 12.4 },
      { state: 'downloaded', version: '1.0.1' },
      { state: 'error', message: '404' }
    ]
    for (const status of cases) {
      expect(updateStatusCopy(status, '1.0.0').body.length).toBeGreaterThan(0)
    }
  })
})

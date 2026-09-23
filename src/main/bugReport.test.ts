import { afterEach, describe, expect, it, vi } from 'vitest'

const { openExternal } = vi.hoisted(() => ({
  openExternal: vi.fn(async () => undefined)
}))

vi.mock('electron', () => ({
  app: {
    getVersion: () => '1.0.0'
  },
  shell: {
    openExternal
  }
}))

import { buildBugReportUrl } from '@shared/bugReport'
import { collectBugReportRuntime, openExternalUrl } from './bugReport'

describe('collectBugReportRuntime', () => {
  it('reads app version, Electron/Chrome, and OS without league or session data', () => {
    const info = collectBugReportRuntime()
    expect(info.appVersion).toBe('1.0.0')
    expect(info.platform).toBe(process.platform)
    expect(info.osRelease.length).toBeGreaterThan(0)
    expect(info).not.toHaveProperty('leagues')
    expect(JSON.stringify(info)).not.toContain('espn_s2')
  })
})

describe('openExternalUrl', () => {
  afterEach(() => {
    openExternal.mockClear()
  })

  it('opens an allowed GitHub new-issue URL', async () => {
    const url = buildBugReportUrl({
      appVersion: '1.0.0',
      electron: '38.0.0',
      chrome: '140.0.0',
      platform: 'win32',
      osRelease: '10.0.22631',
      activeView: 'Connect'
    })
    await expect(openExternalUrl(url)).resolves.toEqual({ ok: true })
    expect(openExternal).toHaveBeenCalledWith(url)
  })

  it('rejects arbitrary URLs', async () => {
    await expect(openExternalUrl('https://example.com')).resolves.toEqual({
      ok: false,
      error: 'Blocked URL'
    })
    expect(openExternal).not.toHaveBeenCalled()
  })
})

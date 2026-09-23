import { afterEach, describe, expect, it, vi } from 'vitest'

const { openExternal, writeText } = vi.hoisted(() => ({
  openExternal: vi.fn(async () => undefined),
  writeText: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    getVersion: () => '1.0.0'
  },
  shell: {
    openExternal
  },
  clipboard: {
    writeText
  }
}))

import { buildBugReportUrl } from '@shared/bugReport'
import { collectBugReportRuntime, copyDiagnostics, openExternalUrl } from './bugReport'
import { appendLog } from './log'

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

describe('copyDiagnostics', () => {
  it('copies runtime info and a scrubbed log with no cookies', () => {
    writeText.mockClear()
    appendLog('error', 'unhandledRejection espn_s2=secret-cookie')
    expect(copyDiagnostics()).toEqual({ ok: true })
    const text = String(writeText.mock.calls[0]?.[0])
    expect(text).toContain('Sideline: 1.0.0')
    expect(text).toContain('unhandledRejection')
    expect(text).not.toContain('secret-cookie')
    expect(text).not.toContain('espn_s2=')
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

type TestCookie = { name: string; value: string }

type FakeWindow = {
  opts: Record<string, unknown>
  destroyed: boolean
  currentUrl: string
  loadURL: ReturnType<typeof vi.fn>
  close: () => void
  isDestroyed: () => boolean
  on: (event: string, handler: () => void) => void
  webContents: { getURL: () => string }
}

const primaryDisplay = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workArea: { x: 0, y: 0, width: 1920, height: 1040 },
  scaleFactor: 1
}

const secondaryDisplay = {
  id: 2,
  bounds: { x: 1920, y: 0, width: 2048, height: 1152 },
  workArea: { x: 1920, y: 0, width: 2048, height: 1112 },
  scaleFactor: 1.25
}

const harness = vi.hoisted(() => {
  const state = {
    cookies: [] as TestCookie[],
    window: null as FakeWindow | null,
    clearStorage: true,
    displays: [] as Array<{
      id: number
      bounds: { x: number; y: number; width: number; height: number }
      workArea: { x: number; y: number; width: number; height: number }
      scaleFactor: number
    }>,
    failLoad: false,
    ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Electron/38.8.6 Safari/537.36',
    popup: null as ((url: string) => 'allow' | 'deny') | null
  }
  return state
})

vi.mock('electron', () => {
  class BrowserWindow {
    destroyed = false
    currentUrl = ''
    closedHandler: (() => void) | null = null
    loadURL = vi.fn(async (url: string) => {
      this.currentUrl = url
      if (harness.failLoad) throw new Error('net::ERR_NAME_NOT_RESOLVED')
    })
    webContents = {
      getURL: (): string => this.currentUrl,
      getUserAgent: (): string => harness.ua,
      setUserAgent: (ua: string): void => {
        harness.ua = ua
      },
      setWindowOpenHandler: (handler: (details: { url: string }) => { action: 'allow' | 'deny' }): void => {
        harness.popup = (url: string) => handler({ url }).action
      },
      on: (): void => undefined
    }

    opts: Record<string, unknown> = {}

    constructor(opts?: Record<string, unknown>) {
      this.opts = opts ?? {}
      harness.window = this as unknown as FakeWindow
    }

    isDestroyed(): boolean {
      return this.destroyed
    }

    close(): void {
      if (this.destroyed) return
      this.destroyed = true
      this.closedHandler?.()
    }

    on(event: string, handler: () => void): void {
      if (event === 'closed') this.closedHandler = handler
    }
  }

  return {
    BrowserWindow,
    screen: {
      getAllDisplays: () => harness.displays,
      getPrimaryDisplay: () => harness.displays[0]
    },
    session: {
      fromPartition: () => ({
        cookies: {
          get: async () => harness.cookies,
          remove: async (_url: string, name: string) => {
            if (!harness.clearStorage) return
            harness.cookies = harness.cookies.filter((row) => row.name !== name)
          }
        },
        clearStorageData: async () => {
          if (harness.clearStorage) harness.cookies = []
        },
        getUserAgent: () => harness.ua,
        setUserAgent: (ua: string) => {
          harness.ua = ua
        }
      })
    }
  }
})

import { runtime } from '../runtime'
import { ESPN_LOGIN_URL, ESPN_SIGNIN_CLOSED, ESPN_SIGNIN_LOAD_FAILED, openEspnLogin } from './espnLogin'

const staleCookies: TestCookie[] = [
  { name: 'espn_s2', value: 'stale-s2' },
  { name: 'SWID', value: '{11111111-1111-1111-1111-111111111111}' }
]

const freshCookies: TestCookie[] = [
  { name: 'espn_s2', value: 'fresh-s2' },
  { name: 'SWID', value: '{22222222-2222-2222-2222-222222222222}' }
]

afterEach(() => {
  vi.useRealTimers()
  harness.cookies = []
  harness.window = null
  harness.clearStorage = true
  harness.displays = [primaryDisplay]
  runtime.setCompanion(null)
  harness.failLoad = false
  harness.ua =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Electron/38.8.6 Safari/537.36'
  harness.popup = null
})

describe('openEspnLogin', () => {
  it('opens on the display that holds the companion, not always the primary', async () => {
    harness.displays = [primaryDisplay, secondaryDisplay]
    runtime.setCompanion({
      isDestroyed: () => false,
      getBounds: () => ({ x: 2200, y: 80, width: 1440, height: 900 })
    } as never)
    vi.useFakeTimers()
    const pending = openEspnLogin()
    await vi.advanceTimersByTimeAsync(0)
    expect(harness.window?.opts.x).toBe(1920 + Math.round((2048 - 980) / 2))
    expect(harness.window?.opts.y).toBe(Math.round((1112 - 760) / 2))
    harness.window?.close()
    await expect(pending).resolves.toEqual({ ok: false, error: ESPN_SIGNIN_CLOSED })
  })

  it('clears a stale persist:espn session and stays open until a new cookie pair appears', async () => {
    harness.cookies = [...staleCookies]
    vi.useFakeTimers()

    const pending = openEspnLogin()
    await vi.advanceTimersByTimeAsync(0)
    expect(harness.window).not.toBeNull()
    expect(ESPN_LOGIN_URL).toBe('https://www.espn.com/login?redirect=https://fantasy.espn.com/')
    expect(harness.window?.loadURL).toHaveBeenCalledWith(ESPN_LOGIN_URL)
    expect(harness.ua).not.toContain('Electron')
    expect(harness.popup?.('https://accounts.google.com/o/oauth2/v2/auth')).toBe('allow')
    expect(harness.popup?.('https://evil.example/phish')).toBe('deny')
    expect(harness.popup?.('http://accounts.google.com/')).toBe('deny')
    expect(harness.cookies).toEqual([])
    expect(harness.window?.destroyed).toBe(false)

    await vi.advanceTimersByTimeAsync(5000)
    expect(harness.window?.destroyed).toBe(false)

    harness.cookies = [...freshCookies]
    await vi.advanceTimersByTimeAsync(1000)
    expect(harness.window?.destroyed).toBe(false)

    if (harness.window) harness.window.currentUrl = 'https://fantasy.espn.com/'
    await vi.advanceTimersByTimeAsync(1000)
    await expect(pending).resolves.toEqual({ ok: true })
    expect(harness.window?.destroyed).toBe(true)
  })

  it('does not treat leftover espn_s2 + SWID as a completed login if clear leaves them', async () => {
    harness.cookies = [...staleCookies]
    harness.clearStorage = false
    vi.useFakeTimers()

    const pending = openEspnLogin()
    await vi.advanceTimersByTimeAsync(0)
    expect(harness.cookies).toEqual(staleCookies)

    await vi.advanceTimersByTimeAsync(4000)
    expect(harness.window?.destroyed).toBe(false)

    harness.window?.close()
    await expect(pending).resolves.toEqual({ ok: false, error: ESPN_SIGNIN_CLOSED })
  })

  it('resolves false when the user closes the window before cookies appear', async () => {
    vi.useFakeTimers()
    const pending = openEspnLogin()
    await vi.advanceTimersByTimeAsync(0)
    harness.window?.close()
    await expect(pending).resolves.toEqual({ ok: false, error: ESPN_SIGNIN_CLOSED })
  })

  it('treats a fresh cookie pair as success when the user closes the window while still on the login page', async () => {
    vi.useFakeTimers()
    const pending = openEspnLogin()
    await vi.advanceTimersByTimeAsync(0)
    harness.cookies = [...freshCookies]
    harness.window?.close()
    await expect(pending).resolves.toEqual({ ok: true })
  })

  it('closes after a fresh cookie pair stays on the login page', async () => {
    vi.useFakeTimers()
    const pending = openEspnLogin()
    await vi.advanceTimersByTimeAsync(0)
    harness.cookies = [...freshCookies]
    await vi.advanceTimersByTimeAsync(2000)
    expect(harness.window?.destroyed).toBe(false)
    await vi.advanceTimersByTimeAsync(1000)
    await expect(pending).resolves.toEqual({ ok: true })
  })

  it('reports a load failure instead of hanging on a blank window', async () => {
    harness.failLoad = true
    vi.useFakeTimers()
    const pending = openEspnLogin()
    await vi.advanceTimersByTimeAsync(0)
    await expect(pending).resolves.toEqual({
      ok: false,
      error: `${ESPN_SIGNIN_LOAD_FAILED} (net::ERR_NAME_NOT_RESOLVED)`
    })
  })
})

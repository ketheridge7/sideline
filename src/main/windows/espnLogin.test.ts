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
    }>
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
    })
    webContents = {
      getURL: (): string => this.currentUrl
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
          get: async () => harness.cookies
        },
        clearStorageData: async () => {
          if (harness.clearStorage) harness.cookies = []
        }
      })
    }
  }
})

import { runtime } from '../runtime'
import { ESPN_LOGIN_URL, openEspnLogin } from './espnLogin'

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
    await expect(pending).resolves.toEqual({ ok: false })
  })

  it('clears a stale persist:espn session and stays open until a new cookie pair appears', async () => {
    harness.cookies = [...staleCookies]
    vi.useFakeTimers()

    const pending = openEspnLogin()
    await vi.advanceTimersByTimeAsync(0)
    expect(harness.window).not.toBeNull()
    expect(harness.window?.loadURL).toHaveBeenCalledWith(ESPN_LOGIN_URL)
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
    await expect(pending).resolves.toEqual({ ok: false })
  })

  it('resolves false when the user closes the window before cookies appear', async () => {
    vi.useFakeTimers()
    const pending = openEspnLogin()
    await vi.advanceTimersByTimeAsync(0)
    harness.window?.close()
    await expect(pending).resolves.toEqual({ ok: false })
  })
})

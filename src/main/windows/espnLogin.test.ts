import { afterEach, describe, expect, it, vi } from 'vitest'

type TestCookie = { name: string; value: string }

type FakeWindow = {
  destroyed: boolean
  loadURL: ReturnType<typeof vi.fn>
  close: () => void
  isDestroyed: () => boolean
  on: (event: string, handler: () => void) => void
}

const harness = vi.hoisted(() => {
  const state = {
    cookies: [] as TestCookie[],
    window: null as FakeWindow | null,
    clearStorage: true
  }
  return state
})

vi.mock('electron', () => {
  class BrowserWindow {
    destroyed = false
    closedHandler: (() => void) | null = null
    loadURL = vi.fn(async () => undefined)

    constructor() {
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
})

describe('openEspnLogin', () => {
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

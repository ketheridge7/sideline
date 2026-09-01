import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindAppFetch, bindEspnFetch, fetchJson, HttpError, recentFetchTimings, resetAppFetch } from './http'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  resetAppFetch()
})

describe('fetchJson', () => {
  it('returns JSON on 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ week: 1 })
      })
    )
    await expect(fetchJson({ url: 'https://example.test/state' })).resolves.toEqual({ week: 1 })
    const last = recentFetchTimings().at(-1)
    expect(last?.url).toBe('https://example.test/state')
    expect(last?.ok).toBe(true)
    expect(last?.ms).toBeGreaterThanOrEqual(0)
  })

  it('treats an empty JSON 200 as null so a truncated body cannot throw on the live path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => '',
        json: async () => {
          throw new SyntaxError('Unexpected end of JSON input')
        }
      })
    )
    await expect(fetchJson({ url: 'https://example.test/empty' })).resolves.toBeNull()
    const last = recentFetchTimings().at(-1)
    expect(last?.ok).toBe(true)
  })

  it('throws HttpError with status on 4xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({})
      })
    )
    await expect(fetchJson({ url: 'https://example.test/private' })).rejects.toMatchObject({
      name: 'HttpError',
      status: 401
    })
    await expect(fetchJson({ url: 'https://example.test/private' })).rejects.toBeInstanceOf(HttpError)
  })

  it('retries once on 429 then succeeds', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)
    const pending = fetchJson({ url: 'https://example.test/slow', retries: 1, timeoutMs: 60_000 })
    await vi.advanceTimersByTimeAsync(1_500)
    await expect(pending).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('honors Retry-After on 429 when it fits the fetch timeout', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: (name: string) => (name.toLowerCase() === 'retry-after' ? '2' : null) },
        json: async () => ({})
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)
    const pending = fetchJson({ url: 'https://example.test/slow', retries: 1, timeoutMs: 5_000 })
    await vi.advanceTimersByTimeAsync(1_500)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(500)
    await expect(pending).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not sleep past the fetch timeout on a long Retry-After', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: (name: string) => (name.toLowerCase() === 'retry-after' ? '60' : null) },
      json: async () => ({})
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      fetchJson({ url: 'https://example.test/slow', retries: 1, timeoutMs: 5_000 })
    ).rejects.toMatchObject({ name: 'HttpError', status: 429 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('coalesces identical in-flight GETs into one fetch', async () => {
    let release: (value: { ok: boolean; status: number; json: () => Promise<{ n: number }> }) => void = () =>
      undefined
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve
        })
    )
    vi.stubGlobal('fetch', fetchMock)
    const a = fetchJson({ url: 'https://example.test/once' })
    const b = fetchJson({ url: 'https://example.test/once' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: 'no-store' })
    release({
      ok: true,
      status: 200,
      json: async () => ({ n: 1 })
    })
    await expect(Promise.all([a, b])).resolves.toEqual([{ n: 1 }, { n: 1 }])
  })

  it('passes Chromium fetch priority and does not coalesce high onto low', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise(() => {
          // hang
        })
    )
    vi.stubGlobal('fetch', fetchMock)
    void fetchJson({ url: 'https://example.test/score', priority: 'high' })
    void fetchJson({ url: 'https://example.test/score', priority: 'low' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ priority: 'high', cache: 'no-store' })
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ priority: 'low', cache: 'no-store' })
  })

  it('uses the bound app fetch so Electron net.fetch can honor Chromium priority', async () => {
    const appFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true })
    })
    bindAppFetch(appFetch)
    await expect(fetchJson({ url: 'https://example.test/live', priority: 'high' })).resolves.toEqual({
      ok: true
    })
    expect(appFetch).toHaveBeenCalledTimes(1)
    expect(appFetch.mock.calls[0]?.[0]).toBe('https://example.test/live')
    expect(appFetch.mock.calls[0]?.[1]).toMatchObject({ priority: 'high', cache: 'no-store' })
  })

  it('sends ESPN GETs through persist:espn session.fetch and keeps the Cookie header', async () => {
    const espn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true })
    })
    const appFetch = vi.fn()
    bindAppFetch(appFetch)
    bindEspnFetch(espn)
    await expect(
      fetchJson({
        url: 'https://lm-api-reads.fantasy.espn.com/live',
        headers: { Cookie: 'espn_s2=copied; SWID={1}', Accept: 'application/json' },
        useEspnSession: true,
        priority: 'high'
      })
    ).resolves.toEqual({ ok: true })
    expect(espn).toHaveBeenCalledTimes(1)
    expect(appFetch).not.toHaveBeenCalled()
    expect(espn.mock.calls[0]?.[1]).toMatchObject({
      priority: 'high',
      cache: 'no-store',
      headers: { Cookie: 'espn_s2=copied; SWID={1}', Accept: 'application/json' }
    })
  })

  it('defaults to a 5s live budget with no retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({})
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchJson({ url: 'https://example.test/live' })).rejects.toBeInstanceOf(HttpError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not coalesce a live 5s GET onto an 8s retry in-flight', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise(() => {
          // hang
        })
    )
    vi.stubGlobal('fetch', fetchMock)
    void fetchJson({ url: 'https://example.test/state', timeoutMs: 8_000, retries: 1 })
    void fetchJson({ url: 'https://example.test/state', timeoutMs: 5_000, retries: 0 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry a 200 HTML or invalid JSON body', async () => {
    const htmlMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/html; charset=utf-8' },
      json: async () => ({})
    })
    vi.stubGlobal('fetch', htmlMock)
    await expect(
      fetchJson({ url: 'https://example.test/html', retries: 1 })
    ).rejects.toMatchObject({ name: 'HttpError', status: 200 })
    expect(htmlMock).toHaveBeenCalledTimes(1)

    const badJson = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token')
      }
    })
    vi.stubGlobal('fetch', badJson)
    await expect(
      fetchJson({ url: 'https://example.test/empty', retries: 1 })
    ).rejects.toMatchObject({ name: 'HttpError', status: 200 })
    expect(badJson).toHaveBeenCalledTimes(1)
  })
})

export class HttpError extends Error {
  status: number
  url: string

  constructor(status: number, url: string, message: string) {
    super(message)
    this.status = status
    this.url = url
    this.name = 'HttpError'
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export type FetchPriority = 'high' | 'low' | 'auto'

export type FetchJsonOpts = {
  url: string
  headers?: Record<string, string>
  timeoutMs?: number
  retries?: number
  priority?: FetchPriority
  useEspnSession?: boolean
}

export type FetchTiming = {
  url: string
  ms: number
  ok: boolean
}

const TIMING_LIMIT = 24
const timings: FetchTiming[] = []

export const recentFetchTimings = (): FetchTiming[] => timings.slice()

const recordTiming = (url: string, started: number, ok: boolean): void => {
  timings.push({ url, ms: Date.now() - started, ok })
  if (timings.length > TIMING_LIMIT) timings.splice(0, timings.length - TIMING_LIMIT)
}

const inflight = new Map<string, Promise<unknown>>()

type AppFetch = (url: string, init?: RequestInit & { priority?: FetchPriority }) => Promise<Response>

let appFetch: AppFetch = (url, init) => fetch(url, init)
let espnFetch: AppFetch | null = null

export const bindAppFetch = (next: AppFetch): void => {
  appFetch = next
}

export const bindEspnFetch = (next: AppFetch): void => {
  espnFetch = next
}

export const resetAppFetch = (): void => {
  appFetch = (url, init) => fetch(url, init)
  espnFetch = null
}

export const DEFAULT_FETCH_TIMEOUT_MS = 5_000
export const DEFAULT_FETCH_RETRIES = 0

const inflightKey = (opts: FetchJsonOpts): string => {
  const headers = opts.headers ?? {}
  return [
    opts.url,
    headers.Cookie ?? '',
    headers['X-Fantasy-Filter'] ?? '',
    String(opts.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS),
    String(opts.retries ?? DEFAULT_FETCH_RETRIES),
    opts.priority ?? '',
    opts.useEspnSession && espnFetch ? 'espn-session' : ''
  ].join('\n')
}

const retryAfterMs = (res: Response): number | undefined => {
  const raw =
    typeof res.headers?.get === 'function' ? res.headers.get('retry-after') : undefined
  if (!raw || raw.trim() === '') return undefined
  const secs = Number(raw)
  if (Number.isFinite(secs) && secs >= 0) return secs * 1000
  const when = Date.parse(raw)
  if (Number.isFinite(when)) return Math.max(0, when - Date.now())
  return undefined
}

const fetchJsonOnce = async <T>(opts: FetchJsonOpts): Promise<T> => {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS
  const retries = opts.retries ?? DEFAULT_FETCH_RETRIES
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    const started = Date.now()
    try {
      const viaEspn = Boolean(opts.useEspnSession && espnFetch)
      const init: RequestInit & { priority?: FetchPriority } = {
        headers: opts.headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs)
      }
      if (opts.priority) init.priority = opts.priority
      const runner = viaEspn && espnFetch ? espnFetch : appFetch
      const res = await runner(opts.url, init)
      if (res.status === 429) {
        recordTiming(opts.url, started, false)
        if (attempt === retries) {
          throw new HttpError(429, opts.url, `HTTP 429 ${opts.url}`)
        }
        const hinted = retryAfterMs(res)
        if (hinted != null && hinted > timeoutMs) {
          throw new HttpError(429, opts.url, `HTTP 429 ${opts.url}`)
        }
        await sleep(hinted ?? 1_500 * (attempt + 1))
        continue
      }
      if (res.status >= 500 && attempt < retries) {
        recordTiming(opts.url, started, false)
        await sleep(400 * (attempt + 1))
        continue
      }
      if (!res.ok) {
        recordTiming(opts.url, started, false)
        throw new HttpError(res.status, opts.url, `HTTP ${res.status} ${opts.url}`)
      }
      const contentType =
        typeof res.headers?.get === 'function' ? (res.headers.get('content-type') ?? '') : ''
      if (contentType.includes('text/html')) {
        recordTiming(opts.url, started, false)
        throw new HttpError(res.status, opts.url, `Non-JSON ${opts.url}`)
      }
      let body: T
      try {
        if (typeof res.text === 'function') {
          const raw = await res.text()
          if (!raw.trim()) {
            recordTiming(opts.url, started, true)
            return null as T
          }
          body = JSON.parse(raw) as T
        } else {
          body = (await res.json()) as T
        }
      } catch (error) {
        if (error instanceof HttpError) throw error
        recordTiming(opts.url, started, false)
        throw new HttpError(res.status, opts.url, `Invalid JSON ${opts.url}`)
      }
      recordTiming(opts.url, started, true)
      return body
    } catch (error) {
      if (error instanceof HttpError) throw error
      recordTiming(opts.url, started, false)
      lastError = error
      if (attempt === retries) break
      await sleep(400 * (attempt + 1))
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Request failed ${opts.url}`)
}

export const fetchJson = async <T = unknown>(opts: FetchJsonOpts): Promise<T> => {
  const key = inflightKey(opts)
  const pending = inflight.get(key)
  if (pending) return pending as Promise<T>
  const promise = fetchJsonOnce<T>(opts).finally(() => {
    if (inflight.get(key) === promise) inflight.delete(key)
  })
  inflight.set(key, promise)
  return promise
}

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

/**
 * Thrown without touching the network while a host is backing off after a
 * 429 / 5xx / edge-block 403. Status 429 so callers never read it as an auth
 * failure; the poller keeps painting cached scores.
 */
export class HttpBackoffError extends HttpError {
  retryAt: number

  constructor(url: string, retryAt: number) {
    super(429, url, `Backing off ${url} until ${new Date(retryAt).toISOString()}`)
    this.name = 'HttpBackoffError'
    this.retryAt = retryAt
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export const HOST_BACKOFF_BASE_MS = 10_000
export const HOST_BACKOFF_MAX_MS = 5 * 60_000
export const HOST_RETRY_AFTER_MAX_MS = 15 * 60_000
/** Consecutive 5xx before the breaker opens, so one blip still allows the poller's same-host recover GET. */
export const HOST_5XX_OPEN_AFTER = 3

/** Retry-After wins when present (capped); otherwise 10s, 20s, 40s… up to 5 min per consecutive open. */
export const hostBackoffDelayMs = (opens: number, retryAfterMs?: number): number => {
  if (retryAfterMs != null) return Math.min(HOST_RETRY_AFTER_MAX_MS, Math.max(1_000, retryAfterMs))
  return Math.min(HOST_BACKOFF_MAX_MS, HOST_BACKOFF_BASE_MS * 2 ** Math.max(0, opens - 1))
}

/**
 * 429 (or any Retry-After) opens at once; so does a non-JSON 403 edge block —
 * a JSON 403 is ESPN auth, not rate limiting. 5xx opens after
 * HOST_5XX_OPEN_AFTER consecutive failures.
 */
export const hostBackoffPlan = (opts: {
  status: number
  contentType: string
  hasRetryAfter: boolean
  consecutiveFailures: number
}): 'open' | 'count' | 'ignore' => {
  if (opts.status === 429) return 'open'
  if (opts.status === 403) return opts.contentType.includes('json') ? 'ignore' : 'open'
  if (opts.status >= 500) {
    if (opts.hasRetryAfter || opts.consecutiveFailures >= HOST_5XX_OPEN_AFTER) return 'open'
    return 'count'
  }
  return 'ignore'
}

type HostBackoff = { until: number; failures: number; opens: number }

const hostBackoff = new Map<string, HostBackoff>()

const backoffKeyOf = (opts: FetchJsonOpts): string | null => {
  if (opts.backoffKey) return opts.backoffKey
  try {
    return new URL(opts.url).host
  } catch {
    return null
  }
}

const recordHostFailure = (
  opts: FetchJsonOpts,
  status: number,
  contentType: string,
  retryAfter?: number
): void => {
  const key = backoffKeyOf(opts)
  if (!key) return
  const prev = hostBackoff.get(key) ?? { until: 0, failures: 0, opens: 0 }
  const failures = prev.failures + 1
  const plan = hostBackoffPlan({ status, contentType, hasRetryAfter: retryAfter != null, consecutiveFailures: failures })
  switch (plan) {
    case 'ignore':
      return
    case 'count':
      hostBackoff.set(key, { ...prev, failures })
      return
    case 'open': {
      const opens = prev.opens + 1
      hostBackoff.set(key, { failures, opens, until: Date.now() + hostBackoffDelayMs(opens, retryAfter) })
      return
    }
    default: {
      const _never: never = plan
      void _never
    }
  }
}

const clearHost = (opts: FetchJsonOpts): void => {
  const key = backoffKeyOf(opts)
  if (key) hostBackoff.delete(key)
}

const backoffUntil = (opts: FetchJsonOpts): number | null => {
  const key = backoffKeyOf(opts)
  const row = key ? hostBackoff.get(key) : undefined
  return row && row.until > Date.now() ? row.until : null
}

/** Backoff keys (hosts, unless a caller set `backoffKey`) currently holding requests. */
export const hostsInBackoff = (now = Date.now()): string[] =>
  [...hostBackoff.entries()].filter(([, row]) => row.until > now).map(([key]) => key)

export const resetHostBackoff = (): void => {
  hostBackoff.clear()
}

export type FetchPriority = 'high' | 'low' | 'auto'

export type FetchJsonOpts = {
  url: string
  headers?: Record<string, string>
  timeoutMs?: number
  retries?: number
  priority?: FetchPriority
  useEspnSession?: boolean
  /** Breaker scope; defaults to the URL host. */
  backoffKey?: string
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
  hostBackoff.clear()
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
    const holdUntil = backoffUntil(opts)
    if (holdUntil != null) throw new HttpBackoffError(opts.url, holdUntil)
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
        const hinted = retryAfterMs(res)
        if (attempt === retries || (hinted != null && hinted > timeoutMs)) {
          recordHostFailure(opts, 429, '', hinted)
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
      const contentType =
        typeof res.headers?.get === 'function' ? (res.headers.get('content-type') ?? '') : ''
      if (!res.ok) {
        recordTiming(opts.url, started, false)
        recordHostFailure(opts, res.status, contentType, retryAfterMs(res))
        throw new HttpError(res.status, opts.url, `HTTP ${res.status} ${opts.url}`)
      }
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
            clearHost(opts)
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
      clearHost(opts)
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

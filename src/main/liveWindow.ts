/** How early a known kickoff opens the calendar fallback, and how long that game stays live. */
export const KNOWN_KICKOFF_LEAD_MS = 15 * 60_000
export const KNOWN_KICKOFF_LENGTH_MS = 4 * 60 * 60_000

const etClock = (now: Date): { weekday: string | undefined; mins: number } => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23'
  }).formatToParts(now)
  const weekday = parts.find((part) => part.type === 'weekday')?.value
  const hour = Number(parts.find((part) => part.type === 'hour')?.value)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value)
  return { weekday, mins: hour * 60 + minute }
}

/** Broad gameday hours. Thursday morning and Monday afternoon stay idle unless a kickoff says otherwise. */
const calendarWindowLive = (now: Date): boolean => {
  const { weekday, mins } = etClock(now)
  if (weekday === 'Thu' && mins >= 12 * 60) return true
  if (weekday === 'Fri' && mins >= 9 * 60) return true
  if (weekday === 'Sat' && mins >= 9 * 60) return true
  if (weekday === 'Sun' && mins >= 9 * 60) return true
  if (weekday === 'Mon' && mins >= 19 * 60) return true
  // Monday night, including a second Monday game, can still be on after midnight Eastern.
  if (weekday === 'Tue' && mins < 2 * 60) return true
  return false
}

/** One kickoff, from 15 minutes before through a full game. Does not open the rest of that weekday. */
export const knownKickoffLive = (nowMs: number, kickoffMs: number): boolean =>
  Number.isFinite(kickoffMs) &&
  nowMs >= kickoffMs - KNOWN_KICKOFF_LEAD_MS &&
  nowMs <= kickoffMs + KNOWN_KICKOFF_LENGTH_MS

/**
 * Broad gameday calendar window. Only decides cadence while the NFL scoreboard is unreachable.
 * `kickoffs` (epoch ms from a previous scoreboard) extend that window for those games only.
 */
export const isLikelyLive = (now: Date, seasonType: string, kickoffs?: readonly number[]): boolean => {
  if (seasonType !== 'regular' && seasonType !== 'post') return false
  if (calendarWindowLive(now)) return true
  if (!kickoffs || kickoffs.length === 0) return false
  const nowMs = now.getTime()
  return kickoffs.some((at) => knownKickoffLive(nowMs, at))
}

export const LIVE_POLL_MS = 3_000
export const IDLE_POLL_MS = 30_000

export const pollIntervalMs = (live: boolean): number => (live ? LIVE_POLL_MS : IDLE_POLL_MS)

export const nextPollDelayMs = (intervalMs: number, elapsedMs: number): number =>
  Math.max(0, intervalMs - elapsedMs)

/** Hold the machine awake only while the LAN TV overlay is on during a live window. */
export const lanPowerSavePlan = (opts: { lanEnabled: boolean; live: boolean }): 'hold' | 'release' =>
  opts.lanEnabled && opts.live ? 'hold' : 'release'

type PowerBlocker = {
  start: (type: 'prevent-app-suspension') => number
  stop: (id: number) => void
  isStarted: (id: number) => boolean
}

export const createLanPowerController = (
  api: Partial<PowerBlocker> | null | undefined,
  hooks?: { onStart?: () => void; onStop?: () => void }
): { sync: (lanEnabled: boolean, live: boolean) => void } => {
  const ready = Boolean(
    api && typeof api.start === 'function' && typeof api.stop === 'function' && typeof api.isStarted === 'function'
  )
  const blocker = api as PowerBlocker
  let activeId: number | null = null
  return {
    sync: (lanEnabled, live) => {
      const plan = lanPowerSavePlan({ lanEnabled, live })
      switch (plan) {
        case 'hold':
          if (!ready) return
          if (activeId != null && blocker.isStarted(activeId)) return
          try {
            activeId = blocker.start('prevent-app-suspension')
            hooks?.onStart?.()
          } catch {
            activeId = null
          }
          return
        case 'release':
          if (activeId == null) return
          try {
            if (ready && blocker.isStarted(activeId)) blocker.stop(activeId)
          } catch {
            // still drop the id so a later live window can start a fresh blocker
          }
          activeId = null
          hooks?.onStop?.()
          return
        default: {
          const _never: never = plan
          void _never
        }
      }
    }
  }
}

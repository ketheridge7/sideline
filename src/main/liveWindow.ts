/** Broad gameday calendar window. Only decides cadence while the NFL scoreboard is unreachable. */
export const isLikelyLive = (now: Date, seasonType: string): boolean => {
  if (seasonType !== 'regular' && seasonType !== 'post') return false
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
  const mins = hour * 60 + minute
  if (weekday === 'Thu' && mins >= 12 * 60) return true
  if (weekday === 'Fri' && mins >= 9 * 60) return true
  if (weekday === 'Sat' && mins >= 9 * 60) return true
  if (weekday === 'Sun' && mins >= 9 * 60) return true
  if (weekday === 'Mon' && mins >= 19 * 60) return true
  return false
}

export const LIVE_POLL_MS = 3_000
export const IDLE_POLL_MS = 30_000

export const pollIntervalMs = (live: boolean): number => (live ? LIVE_POLL_MS : IDLE_POLL_MS)

export const nextPollDelayMs = (intervalMs: number, elapsedMs: number): number =>
  Math.max(0, intervalMs - elapsedMs)

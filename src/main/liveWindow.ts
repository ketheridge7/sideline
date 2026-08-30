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
  if (weekday === 'Sun' && mins >= 12 * 60 + 55) return true
  if (weekday === 'Mon' && mins >= 19 * 60) return true
  if (weekday === 'Thu' && mins >= 19 * 60 + 30) return true
  return false
}

export const pollIntervalMs = (live: boolean): number => (live ? 10_000 : 30_000)

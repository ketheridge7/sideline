const startupErrors = new Map<string, string>()

export const reportStartupError = (step: string, message: string): void => {
  startupErrors.set(step, message)
}

export const clearStartupError = (step: string): void => {
  startupErrors.delete(step)
}

export const startupErrorNotice = (): string | null => {
  for (const message of startupErrors.values()) return message
  return null
}

export const resetNoticesForTests = (): void => {
  startupErrors.clear()
}

const providerForHost = (host: string): 'ESPN' | 'Sleeper' | null => {
  const name = host.toLowerCase()
  if (name.endsWith('fantasy.espn.com') || name === 'fan.api.espn.com') return 'ESPN'
  if (name.endsWith('sleeper.app') || name.endsWith('sleeper.com')) return 'Sleeper'
  return null
}

/**
 * Quiet "holding" line for fantasy providers in backoff. NFL scoreboard hosts
 * are left out: another host or the calendar fallback covers them, and
 * site.api routinely 403s.
 */
export const backoffNoticePlan = (hosts: readonly string[]): string | null => {
  const names = [...new Set(hosts.map(providerForHost).filter((name): name is 'ESPN' | 'Sleeper' => name != null))]
  if (names.length === 0) return null
  return `${names.join(' and ')} slow, holding last scores`
}

/** A refresh error wins; sticky startup failures and quiet provider holds only fill an empty banner. */
export const statusErrorPlan = (opts: {
  refreshError: string | null
  startupError: string | null
  holdNotice: string | null
}): string | null => opts.refreshError ?? opts.startupError ?? opts.holdNotice

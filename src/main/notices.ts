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

/** A refresh error wins; sticky startup failures and quiet provider holds only fill an empty banner. */
export const statusErrorPlan = (opts: {
  refreshError: string | null
  startupError: string | null
  holdNotice: string | null
}): string | null => opts.refreshError ?? opts.startupError ?? opts.holdNotice

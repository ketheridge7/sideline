export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'disabled'; reason: 'dev' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available'; version: string }
  | { state: 'downloading'; percent: number; version: string }
  | { state: 'downloaded'; version: string }
  | { state: 'countdown'; version: string; seconds: number }
  | { state: 'installing'; version: string }
  | { state: 'error'; message: string }

export type UpdateSnapshot = UpdateStatus & {
  currentVersion: string
}

export const UPDATE_RESTART_SECONDS = 10

export const updateBannerText = (version: string, seconds: number): string =>
  `Updating Sideline to v${version} — restarting in ${seconds}s`

export const updateSettingsLabel = (status: UpdateStatus): string => {
  switch (status.state) {
    case 'idle':
      return ''
    case 'disabled':
      return 'Updates are available in the installed app'
    case 'checking':
      return 'Checking'
    case 'available':
      return 'Downloading 0%'
    case 'not-available':
      return 'Up to date'
    case 'downloading':
      return `Downloading ${Math.round(status.percent)}%`
    case 'downloaded':
    case 'countdown':
      return 'Ready (restart)'
    case 'installing':
      return 'Restarting'
    case 'error':
      return status.message
    default: {
      const _never: never = status
      return _never
    }
  }
}

export const presentUpdateError = (error: unknown): string => {
  const raw =
    error instanceof Error && error.message
      ? error.message
      : typeof error === 'string' && error
        ? error
        : 'Update check failed'
  if (/\b404\b/.test(raw)) return 'No update feed found (404).'
  if (
    /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ECONNRESET|offline|network|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|getaddrinfo/i.test(
      raw
    )
  ) {
    return 'Offline. Could not reach GitHub Releases.'
  }
  return raw
}

/** Automatic checks stay quiet. The settings row shows offline and 404 only after Check for updates. */
export const shouldSurfaceUpdateError = (userInitiated: boolean): boolean => userInitiated

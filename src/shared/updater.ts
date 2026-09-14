import type { ToastPayload } from './types'

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'disabled'; reason: 'dev' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }

export type UpdateSnapshot = UpdateStatus & {
  currentVersion: string
}

export const UPDATE_TOAST_PREFIX = 'sideline:update'

export const updateStatusCopy = (status: UpdateStatus, currentVersion: string): { title: string; body: string } => {
  switch (status.state) {
    case 'idle':
      return {
        title: 'Updates',
        body: currentVersion ? `This build is ${currentVersion}. Not checked yet.` : 'Not checked yet.'
      }
    case 'disabled':
      return {
        title: 'Updates',
        body: currentVersion
          ? `This build is ${currentVersion}. Installed Windows builds check GitHub Releases. Dev (npm start) skips this.`
          : 'Installed Windows builds check GitHub Releases. Dev (npm start) skips this.'
      }
    case 'checking':
      return { title: 'Updates', body: 'Checking GitHub Releases…' }
    case 'available':
      return { title: 'Update available', body: `Sideline ${status.version} is downloading.` }
    case 'not-available':
      return { title: 'Updates', body: `Sideline ${status.version} is up to date.` }
    case 'downloading':
      return { title: 'Downloading update', body: `Sideline download ${Math.round(status.percent)}%.` }
    case 'downloaded':
      return {
        title: 'Update ready',
        body: `Sideline ${status.version} is ready. Connect → Restart to install.`
      }
    case 'error':
      return { title: 'Update check failed', body: status.message }
    default: {
      const _never: never = status
      return _never
    }
  }
}

export const shouldToastUpdate = (status: UpdateStatus, userInitiated: boolean): boolean => {
  switch (status.state) {
    case 'available':
    case 'downloaded':
      return true
    case 'not-available':
    case 'error':
    case 'disabled':
      return userInitiated
    case 'idle':
    case 'checking':
    case 'downloading':
      return false
    default: {
      const _never: never = status
      return _never
    }
  }
}

export const updateToast = (status: UpdateStatus, currentVersion: string): ToastPayload => {
  const copy = updateStatusCopy(status, currentVersion)
  return {
    id: `${UPDATE_TOAST_PREFIX}-${status.state}`,
    title: copy.title,
    body: copy.body
  }
}

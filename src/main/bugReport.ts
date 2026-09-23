import os from 'node:os'
import { app, shell } from 'electron'
import { isAllowedBugReportUrl, type BugReportRuntime } from '@shared/bugReport'

export const collectBugReportRuntime = (): BugReportRuntime => ({
  appVersion: app.getVersion(),
  electron: process.versions.electron ?? '',
  chrome: process.versions.chrome ?? '',
  platform: process.platform,
  osRelease: os.release()
})

export const openExternalUrl = async (
  url: unknown
): Promise<{ ok: true } | { ok: false; error: string }> => {
  if (!isAllowedBugReportUrl(url)) return { ok: false, error: 'Blocked URL' }
  await shell.openExternal(url)
  return { ok: true }
}

import os from 'node:os'
import { app, clipboard, shell } from 'electron'
import { isAllowedBugReportUrl, type BugReportRuntime } from '@shared/bugReport'
import { buildDiagnosticsText } from '@shared/diagnostics'
import { readRecentLog } from './log'

export const collectBugReportRuntime = (): BugReportRuntime => ({
  appVersion: app.getVersion(),
  electron: process.versions.electron ?? '',
  chrome: process.versions.chrome ?? '',
  platform: process.platform,
  osRelease: os.release()
})

export const copyDiagnostics = (): { ok: true } | { ok: false; error: string } => {
  try {
    clipboard.writeText(buildDiagnosticsText(collectBugReportRuntime(), readRecentLog()))
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not copy diagnostics' }
  }
}

export const openExternalUrl = async (
  url: unknown
): Promise<{ ok: true } | { ok: false; error: string }> => {
  if (!isAllowedBugReportUrl(url)) return { ok: false, error: 'Blocked URL' }
  await shell.openExternal(url)
  return { ok: true }
}

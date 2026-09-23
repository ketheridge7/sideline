export const BUG_REPORT_REPO = 'ketheridge7/sideline'
export const BUG_REPORT_TEMPLATE = 'bug_report.yml'
export const BUG_REPORT_NEW_ISSUE_PATH = `/${BUG_REPORT_REPO}/issues/new`
export const BUG_REPORT_TITLE_PLACEHOLDER = '[Bug] '
export const BUG_REPORT_ASSIGNEE = 'ketheridge7'

export type CompanionScreen = 'board' | 'boards' | 'connect'

export type BugReportRuntime = {
  appVersion: string
  electron: string
  chrome: string
  platform: string
  osRelease: string
}

export type BugReportDiagnostics = BugReportRuntime & {
  activeView?: string | null
}

export const bugReportActiveView = (screen: CompanionScreen, overlayVisible: boolean): string => {
  let companion: 'Scoreboard' | 'Leagues' | 'Connect'
  switch (screen) {
    case 'board':
      companion = 'Scoreboard'
      break
    case 'boards':
      companion = 'Leagues'
      break
    case 'connect':
      companion = 'Connect'
      break
    default: {
      const _never: never = screen
      return _never
    }
  }
  return overlayVisible ? `${companion} / HUD` : companion
}

export const buildBugReportDiagnostics = (info: BugReportDiagnostics): string => {
  const view = info.activeView?.trim() ? info.activeView.trim() : 'unknown'
  return [
    `- Sideline: ${info.appVersion}`,
    `- Electron: ${info.electron || 'unknown'}`,
    `- Chrome: ${info.chrome || 'unknown'}`,
    `- OS: ${info.platform} ${info.osRelease}`,
    `- Active view: ${view}`
  ].join('\n')
}

export const buildBugReportBody = (info: BugReportDiagnostics): string =>
  [
    '## Diagnostics',
    '',
    buildBugReportDiagnostics(info),
    '',
    'Do not include league names, cookies, tokens, or Sleeper/ESPN credentials.',
    '',
    '## Steps to reproduce',
    '',
    '',
    '## Expected',
    '',
    '',
    '## Actual',
    '',
    ''
  ].join('\n')

export const buildBugReportUrl = (info: BugReportDiagnostics): string => {
  const params = new URLSearchParams()
  params.set('template', BUG_REPORT_TEMPLATE)
  params.set('labels', 'bug')
  params.set('assignees', BUG_REPORT_ASSIGNEE)
  params.set('title', BUG_REPORT_TITLE_PLACEHOLDER)
  params.set('body', buildBugReportBody(info))
  params.set('diagnostics', buildBugReportDiagnostics(info))
  return `https://github.com${BUG_REPORT_NEW_ISSUE_PATH}?${params.toString()}`
}

export const isAllowedBugReportUrl = (url: unknown): url is string => {
  if (typeof url !== 'string' || url.length === 0 || url.length > 8000) return false
  try {
    const parsed = new URL(url)
    const path = parsed.pathname.replace(/\/+$/, '') || '/'
    return parsed.protocol === 'https:' && parsed.hostname === 'github.com' && path === BUG_REPORT_NEW_ISSUE_PATH
  } catch {
    return false
  }
}

export const submitBugReport = async (
  info: BugReportDiagnostics,
  openExternal: (url: string) => Promise<unknown>
): Promise<string> => {
  const url = buildBugReportUrl(info)
  await openExternal(url)
  return url
}

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  BUG_REPORT_NEW_ISSUE_PATH,
  bugReportActiveView,
  buildBugReportBody,
  buildBugReportUrl,
  isAllowedBugReportUrl,
  submitBugReport
} from './bugReport'

const sample = {
  appVersion: '1.0.0',
  electron: '38.0.0',
  chrome: '140.0.7339.0',
  platform: 'win32',
  osRelease: '10.0.22631',
  activeView: 'Connect'
}

describe('bugReportActiveView', () => {
  it('names the companion screen and HUD when the overlay is on', () => {
    expect(bugReportActiveView('board', false)).toBe('Scoreboard')
    expect(bugReportActiveView('boards', false)).toBe('Leagues')
    expect(bugReportActiveView('connect', false)).toBe('Connect')
    expect(bugReportActiveView('connect', true)).toBe('Connect / HUD')
  })
})

describe('buildBugReportUrl', () => {
  it('opens a prefilled GitHub new-issue URL with version and platform in the body', () => {
    const url = buildBugReportUrl(sample)
    expect(url).toContain('github.com/ketheridge7/sideline/issues/new')
    expect(url).toContain('labels=bug')
    expect(url).toContain('template=bug_report.yml')
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe(`https://github.com${BUG_REPORT_NEW_ISSUE_PATH}`)
    const body = parsed.searchParams.get('body') ?? ''
    expect(body).toContain('1.0.0')
    expect(body).toContain('win32')
    expect(body).toContain('10.0.22631')
    expect(body).toContain('Electron: 38.0.0')
    expect(body).toContain('Chrome: 140.0.7339.0')
    expect(body).toContain('Active view: Connect')
    expect(body).toContain('## Steps to reproduce')
    expect(body).toContain('## Expected')
    expect(body).toContain('## Actual')
    expect(body).not.toContain('espn_s2')
    expect(body).not.toContain('SWID')
  })
})

describe('buildBugReportBody', () => {
  it('never asks for league names or credentials', () => {
    const body = buildBugReportBody(sample)
    expect(body).toContain('Do not include league names, cookies, tokens, or Sleeper/ESPN credentials.')
    expect(body).not.toContain('espn_s2')
    expect(body).not.toContain('sleeperUsername')
  })
})

describe('isAllowedBugReportUrl', () => {
  it('allows only https GitHub new-issue URLs for this repo', () => {
    expect(isAllowedBugReportUrl(buildBugReportUrl(sample))).toBe(true)
    expect(isAllowedBugReportUrl('https://github.com/ketheridge7/sideline/issues/new')).toBe(true)
    expect(isAllowedBugReportUrl('https://evil.example/ketheridge7/sideline/issues/new')).toBe(false)
    expect(isAllowedBugReportUrl('https://github.com/ketheridge7/sideline/issues')).toBe(false)
    expect(isAllowedBugReportUrl('http://github.com/ketheridge7/sideline/issues/new')).toBe(false)
    expect(isAllowedBugReportUrl('file:///etc/passwd')).toBe(false)
    expect(isAllowedBugReportUrl('')).toBe(false)
    expect(isAllowedBugReportUrl(1)).toBe(false)
  })
})

describe('submitBugReport', () => {
  it('builds the GitHub URL and hands it to openExternal', async () => {
    const openExternal = vi.fn(async () => ({ ok: true }))
    const url = await submitBugReport(sample, openExternal)
    expect(openExternal).toHaveBeenCalledTimes(1)
    expect(openExternal).toHaveBeenCalledWith(url)
    expect(url).toContain('github.com/ketheridge7/sideline/issues/new')
    expect(url).toContain('body=')
    const decoded = decodeURIComponent(url.replace(/\+/g, '%20'))
    expect(decoded).toContain('1.0.0')
    expect(decoded).toContain('win32')
  })
})

describe('GitHub issue template', () => {
  it('ships a bug form with the bug label and [Bug] title placeholder', () => {
    const yaml = readFileSync(resolve(process.cwd(), '.github/ISSUE_TEMPLATE/bug_report.yml'), 'utf8')
    expect(yaml).toContain('name: Bug report')
    expect(yaml).toContain('title: "[Bug] "')
    expect(yaml).toContain('labels: ["bug"]')
    expect(yaml).toContain('id: diagnostics')
    expect(yaml).toContain('id: steps')
    expect(yaml).toContain('id: expected')
    expect(yaml).toContain('id: actual')
    expect(yaml).toContain('league names, cookies, tokens')
  })
})

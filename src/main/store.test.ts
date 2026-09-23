import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  const fs = require('fs') as typeof import('fs')
  const os = require('os') as typeof import('os')
  const path = require('path') as typeof import('path')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sideline-store-'))
  return { app: { getPath: () => dir } }
})

import { app } from 'electron'
import { SETTINGS_UNREADABLE_NOTICE, resetNoticesForTests, settingsFileNotice } from './notices'
import { leagueSettingsRevision, loadSettings, resetStoreForTests, saveSettings } from './store'

const settingsPath = (): string => join(app.getPath('userData'), 'sideline-settings.json')

afterEach(() => {
  resetStoreForTests()
  resetNoticesForTests()
  rmSync(settingsPath(), { force: true })
  rmSync(`${settingsPath()}.bak`, { force: true })
  rmSync(`${settingsPath()}.tmp`, { force: true })
})

describe('settings store', () => {
  it('writes settings atomically', () => {
    saveSettings({ sleeperUsername: 'keeper' })
    expect(existsSync(`${settingsPath()}.tmp`)).toBe(false)
    const parsed = JSON.parse(readFileSync(settingsPath(), 'utf8')) as { sleeperUsername: string }
    expect(parsed.sleeperUsername).toBe('keeper')
  })

  it('bumps the league revision only when league or provider fields change', () => {
    const start = leagueSettingsRevision()
    saveSettings({ lanOverlayEnabled: true })
    expect(leagueSettingsRevision()).toBe(start)
    saveSettings({ espnLeagueIds: ['111'] })
    expect(leagueSettingsRevision()).toBe(start + 1)
    saveSettings({ espnLeagueIds: ['111'] })
    expect(leagueSettingsRevision()).toBe(start + 1)
    saveSettings({ sleeperUsername: null, sleeperUserId: null, sleeperLeagueIds: null })
    expect(leagueSettingsRevision()).toBe(start + 1)
    saveSettings({ sleeperUsername: 'ada' })
    expect(leagueSettingsRevision()).toBe(start + 2)
  })

  it('keeps a backup and a notice when the settings file cannot be parsed', () => {
    writeFileSync(settingsPath(), '{"sleeperUsername": "ada",', 'utf8')
    resetStoreForTests()
    const loaded = loadSettings()
    expect(loaded.sleeperUsername).toBeNull()
    expect(settingsFileNotice()).toBe(SETTINGS_UNREADABLE_NOTICE)
    expect(readFileSync(`${settingsPath()}.bak`, 'utf8')).toContain('ada')
    expect(readFileSync(settingsPath(), 'utf8')).toContain('ada')
    saveSettings({ sleeperUsername: 'restored' })
    const next = JSON.parse(readFileSync(settingsPath(), 'utf8')) as { sleeperUsername: string }
    expect(next.sleeperUsername).toBe('restored')
    expect(readFileSync(`${settingsPath()}.bak`, 'utf8')).toContain('ada')
  })

  it('treats a missing settings file as defaults without a notice', () => {
    rmSync(settingsPath(), { force: true })
    resetStoreForTests()
    expect(loadSettings().espnLeagueIds).toEqual([])
    expect(settingsFileNotice()).toBeNull()
    expect(existsSync(`${settingsPath()}.bak`)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
  presentUpdateError,
  shouldSurfaceUpdateError,
  updateBannerText,
  updateSettingsLabel,
  UPDATE_RESTART_SECONDS,
  type UpdateStatus
} from './updater'

describe('updateSettingsLabel', () => {
  it('names the dev skip next to Check for updates', () => {
    expect(updateSettingsLabel({ state: 'disabled', reason: 'dev' })).toBe(
      'Updates are available in the installed app'
    )
  })

  it('uses the settings vocabulary for check, download, and ready', () => {
    expect(updateSettingsLabel({ state: 'checking' })).toBe('Checking')
    expect(updateSettingsLabel({ state: 'not-available', version: '1.0.1' })).toBe('Up to date')
    expect(updateSettingsLabel({ state: 'available', version: '1.0.2' })).toBe('Downloading 0%')
    expect(updateSettingsLabel({ state: 'downloading', percent: 42.2, version: '1.0.2' })).toBe('Downloading 42%')
    expect(updateSettingsLabel({ state: 'downloaded', version: '1.0.2' })).toBe('Ready (restart)')
    expect(updateSettingsLabel({ state: 'countdown', version: '1.0.2', seconds: 10 })).toBe('Ready (restart)')
    expect(updateSettingsLabel({ state: 'installing', version: '1.0.2' })).toBe('Restarting')
    expect(updateSettingsLabel({ state: 'error', message: 'Offline. Could not reach GitHub Releases.' })).toBe(
      'Offline. Could not reach GitHub Releases.'
    )
  })

  it('covers every status variant', () => {
    const cases: UpdateStatus[] = [
      { state: 'idle' },
      { state: 'disabled', reason: 'dev' },
      { state: 'checking' },
      { state: 'available', version: '1.0.2' },
      { state: 'not-available', version: '1.0.1' },
      { state: 'downloading', percent: 12.4, version: '1.0.2' },
      { state: 'downloaded', version: '1.0.2' },
      { state: 'countdown', version: '1.0.2', seconds: UPDATE_RESTART_SECONDS },
      { state: 'installing', version: '1.0.2' },
      { state: 'error', message: '404' }
    ]
    for (const status of cases) {
      expect(typeof updateSettingsLabel(status)).toBe('string')
    }
  })
})

describe('updateBannerText', () => {
  it('counts down a silent restart', () => {
    expect(updateBannerText('1.0.2', 10)).toBe('Updating Sideline to v1.0.2 — restarting in 10s')
  })
})

describe('presentUpdateError', () => {
  it('turns 404 and offline into a short settings line', () => {
    expect(presentUpdateError(new Error('Unable to find latest.yml 404'))).toBe('No update feed found (404).')
    expect(presentUpdateError('net::ERR_INTERNET_DISCONNECTED')).toBe('Offline. Could not reach GitHub Releases.')
    expect(presentUpdateError(new Error('getaddrinfo ENOTFOUND github.com'))).toBe(
      'Offline. Could not reach GitHub Releases.'
    )
    expect(presentUpdateError('something else')).toBe('something else')
  })
})

describe('shouldSurfaceUpdateError', () => {
  it('shows errors only when the user clicked Check for updates', () => {
    expect(shouldSurfaceUpdateError(false)).toBe(false)
    expect(shouldSurfaceUpdateError(true)).toBe(true)
  })
})

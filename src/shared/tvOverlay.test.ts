import { describe, expect, it } from 'vitest'
import { defaultSettings } from './settings'
import {
  TV_OVERLAY_ENABLED,
  bindHostForOverlay,
  lanOverlayRequested,
  settingsHadShelvedLan,
  shelfLanSettings
} from './tvOverlay'

describe('shelved TV overlay', () => {
  it('stays disabled and refuses a LAN request', () => {
    expect(TV_OVERLAY_ENABLED).toBe(false)
    expect(lanOverlayRequested(true)).toBe(false)
    expect(lanOverlayRequested(false)).toBe(false)
  })

  it('binds every interface only when the flag and the request are both on', () => {
    expect(bindHostForOverlay(false, true)).toBe('127.0.0.1')
    expect(bindHostForOverlay(false, false)).toBe('127.0.0.1')
    expect(bindHostForOverlay(true, false)).toBe('127.0.0.1')
    expect(bindHostForOverlay(true, true)).toBe('0.0.0.0')
  })

  it('clears a saved Wi-Fi toggle until the flag is turned back on', () => {
    const saved = { ...defaultSettings(), lanOverlayEnabled: true, lanOverlayToken: 'deadbeefcafebabe' }
    const shelved = shelfLanSettings(saved, false)
    expect(shelved.lanOverlayEnabled).toBe(false)
    expect(shelved.lanOverlayToken).toBeNull()
    expect(shelfLanSettings(saved, true).lanOverlayToken).toBe('deadbeefcafebabe')
    expect(settingsHadShelvedLan({ lanOverlayEnabled: true }, false)).toBe(true)
    expect(settingsHadShelvedLan({ lanOverlayToken: 'deadbeefcafebabe' }, false)).toBe(true)
    expect(settingsHadShelvedLan({ lanOverlayEnabled: false, lanOverlayToken: null }, false)).toBe(false)
    expect(settingsHadShelvedLan({ lanOverlayEnabled: true }, true)).toBe(false)
  })
})

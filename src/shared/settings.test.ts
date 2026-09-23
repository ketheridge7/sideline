import { describe, expect, it } from 'vitest'
import { OVERLAY_LAYOUT_SCHEMA_VERSION } from './overlayLayout'
import { defaultSettings, hydrateSettings, isLanOverlayToken, sanitizeLeagueIds } from './settings'

describe('sanitizeLeagueIds', () => {
  it('keeps unique numeric ids and drops junk', () => {
    expect(sanitizeLeagueIds(['11', '11', 'abc', 22, null])).toEqual(['11', '22'])
    expect(sanitizeLeagueIds(undefined)).toEqual([])
  })
})

describe('isLanOverlayToken', () => {
  it('accepts the 16-hex token the overlay server generates', () => {
    expect(isLanOverlayToken('deadbeefcafebabe')).toBe(true)
    expect(isLanOverlayToken('DEADBEEFCAFEBABE')).toBe(false)
    expect(isLanOverlayToken('deadbeef')).toBe(false)
    expect(isLanOverlayToken(null)).toBe(false)
  })
})

describe('hydrateSettings', () => {
  it('keeps a persisted Sleeper user id and drops junk', () => {
    expect(hydrateSettings({ sleeperUsername: 'bob', sleeperUserId: '12345' }).sleeperUserId).toBe('12345')
    expect(hydrateSettings({ sleeperUserId: '' }).sleeperUserId).toBeNull()
    expect(defaultSettings().sleeperUserId).toBeNull()
  })

  it('treats missing Sleeper league ids as legacy-all and hydrates an allowlist', () => {
    expect(defaultSettings().sleeperLeagueIds).toBeNull()
    expect(hydrateSettings({ sleeperUsername: 'bob' }).sleeperLeagueIds).toBeNull()
    expect(hydrateSettings({ sleeperLeagueIds: ['11', '11', 'nope', 22 as never] }).sleeperLeagueIds).toEqual([
      '11',
      '22'
    ])
    expect(hydrateSettings({ sleeperLeagueIds: [] }).sleeperLeagueIds).toEqual([])
  })

  it('auto-heals a stale overlay layout to Preset 1 and keeps slots 1–5', () => {
    const next = hydrateSettings({
      overlayLayout: {
        presetId: 'national',
        widgets: [{ id: 'score.mine', x: 40, y: 40, w: 10, h: 10 }],
        slots: {
          '1': [{ id: 'score.mine', x: 2, y: 14, w: 18, h: 9 }]
        }
      } as never
    })
    expect(next.overlayLayout.schemaVersion).toBe(OVERLAY_LAYOUT_SCHEMA_VERSION)
    expect(next.overlayLayout.presetId).toBe('1')
    expect(next.overlayLayout.widgets.find((row) => row.id === 'score.mine')?.x).not.toBe(40)
    expect(next.overlayLayout.slots['1']?.find((row) => row.id === 'score.mine')?.x).toBe(2)
    expect(defaultSettings().overlayLayout.schemaVersion).toBe(OVERLAY_LAYOUT_SCHEMA_VERSION)
  })

  it('keeps a persisted LAN token and drops junk', () => {
    expect(defaultSettings().lanOverlayToken).toBeNull()
    expect(hydrateSettings({ lanOverlayToken: 'deadbeefcafebabe' }).lanOverlayToken).toBe('deadbeefcafebabe')
    expect(hydrateSettings({ lanOverlayToken: 'nope' }).lanOverlayToken).toBeNull()
    expect(hydrateSettings({}).lanOverlayToken).toBeNull()
  })

  it('hydrates shortcut defaults and heals a colliding persisted accelerator', () => {
    expect(defaultSettings().overlayDisplayHotkey).toBe('CommandOrControl+Shift+M')
    expect(defaultSettings().nextLeagueHotkey).toBe(']')
    expect(defaultSettings().prevLeagueHotkey).toBe('[')
    const healed = hydrateSettings({
      overlayHotkey: 'CommandOrControl+Shift+O',
      overlayDisplayHotkey: 'CommandOrControl+Shift+O',
      nextLeagueHotkey: 'nope',
      prevLeagueHotkey: '['
    })
    expect(healed.overlayHotkey).toBe('CommandOrControl+Shift+O')
    expect(healed.overlayDisplayHotkey).toBe('CommandOrControl+Shift+M')
    expect(healed.nextLeagueHotkey).toBe(']')
    expect(healed.prevLeagueHotkey).toBe('[')
    expect(healed.overlayEditHotkey).toBe('CommandOrControl+Shift+E')
  })
})

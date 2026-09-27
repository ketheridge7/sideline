import { describe, expect, it } from 'vitest'
import { OVERLAY_LAYOUT_SCHEMA_VERSION } from './overlayLayout'
import { defaultSettings, hotkeysAtPublish, hydrateSettings, isLanOverlayToken, sanitizeLeagueIds } from './settings'

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

  it('migrates a saved font color into all text without dropping role overrides', () => {
    const migrated = hydrateSettings({
      overlayLayout: {
        schemaVersion: OVERLAY_LAYOUT_SCHEMA_VERSION,
        presetId: '2',
        fontColor: '#b6ff3b'
      } as never
    })
    expect(migrated.overlayLayout.textColors.all).toBe('#B6FF3B')
    expect(migrated.overlayLayout.textColors.playerName).toBeNull()
    expect(migrated.overlayLayout.textColors.teamName).toBeNull()
    expect(migrated.overlayLayout.presetId).toBe('2')
    const kept = hydrateSettings({
      overlayLayout: {
        schemaVersion: OVERLAY_LAYOUT_SCHEMA_VERSION,
        presetId: '3',
        fontColor: '#FFFFFF',
        textColors: { all: '#E8E4DC', playerScore: '#b6ff3b', teamName: 'nope' }
      } as never
    })
    expect(kept.overlayLayout.textColors.all).toBe('#E8E4DC')
    expect(kept.overlayLayout.textColors.playerScore).toBe('#B6FF3B')
    expect(kept.overlayLayout.textColors.teamName).toBeNull()
    expect(kept.overlayLayout.textColors.playerName).toBeNull()
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
    expect(defaultSettings().nextLeagueHotkey).toBe('CommandOrControl+Shift+]')
    expect(defaultSettings().prevLeagueHotkey).toBe('CommandOrControl+Shift+[')
    const healed = hydrateSettings({
      overlayHotkey: 'CommandOrControl+Shift+O',
      overlayDisplayHotkey: 'CommandOrControl+Shift+O',
      nextLeagueHotkey: 'nope',
      prevLeagueHotkey: '['
    })
    expect(healed.overlayHotkey).toBe('CommandOrControl+Shift+O')
    expect(healed.overlayDisplayHotkey).toBe('CommandOrControl+Shift+M')
    expect(healed.nextLeagueHotkey).toBe('CommandOrControl+Shift+]')
    expect(healed.prevLeagueHotkey).toBe('CommandOrControl+Shift+[')
    expect(healed.overlayEditHotkey).toBe('CommandOrControl+Shift+E')
  })

  it('migrates the old bracket league defaults and leaves a custom binding', () => {
    const migrated = hydrateSettings({ nextLeagueHotkey: ']', prevLeagueHotkey: '[' })
    expect(migrated.nextLeagueHotkey).toBe('CommandOrControl+Shift+]')
    expect(migrated.prevLeagueHotkey).toBe('CommandOrControl+Shift+[')
    const custom = hydrateSettings({ nextLeagueHotkey: 'L', prevLeagueHotkey: 'CommandOrControl+Alt+[' })
    expect(custom.nextLeagueHotkey).toBe('L')
    expect(custom.prevLeagueHotkey).toBe('CommandOrControl+Alt+[')
    const swapped = hydrateSettings({ nextLeagueHotkey: '[', prevLeagueHotkey: ']' })
    expect(swapped.nextLeagueHotkey).toBe('[')
    expect(swapped.prevLeagueHotkey).toBe(']')
  })

  it('keeps a custom Cycle HUD display accelerator instead of merging the default back over it', () => {
    const saved = hydrateSettings({
      overlayHotkey: 'CommandOrControl+Alt+O',
      overlayEditHotkey: 'CommandOrControl+Alt+E',
      overlayDisplayHotkey: 'CommandOrControl+Shift+K',
      nextLeagueHotkey: 'CommandOrControl+Alt+]',
      prevLeagueHotkey: 'CommandOrControl+Alt+['
    })
    expect(saved.overlayDisplayHotkey).toBe('CommandOrControl+Shift+K')
    expect(saved.overlayHotkey).toBe('CommandOrControl+Alt+O')
    expect(saved.overlayEditHotkey).toBe('CommandOrControl+Alt+E')
    expect(saved.nextLeagueHotkey).toBe('CommandOrControl+Alt+]')
    expect(saved.prevLeagueHotkey).toBe('CommandOrControl+Alt+[')
    const again = hydrateSettings(saved)
    expect(again.overlayDisplayHotkey).toBe('CommandOrControl+Shift+K')
    expect(again.overlayHotkey).toBe('CommandOrControl+Alt+O')
  })

  it('does not treat the display key M as the Meta modifier', () => {
    const saved = hydrateSettings({ overlayDisplayHotkey: 'CommandOrControl+Alt+M' })
    expect(saved.overlayDisplayHotkey).toBe('CommandOrControl+Alt+M')
    expect(saved.overlayHotkey).toBe('CommandOrControl+Shift+O')
  })
})

describe('hotkeysAtPublish', () => {
  it('paints the accelerator saved during a poll, not the copy from when the poll started', () => {
    const kickoff = defaultSettings()
    const latest = {
      ...kickoff,
      overlayDisplayHotkey: 'CommandOrControl+Shift+K',
      nextLeagueHotkey: 'CommandOrControl+Alt+]'
    }
    const painted = hotkeysAtPublish(kickoff, latest)
    expect(painted.overlayDisplayHotkey).toBe('CommandOrControl+Shift+K')
    expect(painted.nextLeagueHotkey).toBe('CommandOrControl+Alt+]')
    expect(painted.overlayHotkey).toBe(kickoff.overlayHotkey)
    expect(painted.overlayEditHotkey).toBe(kickoff.overlayEditHotkey)
    expect(painted.prevLeagueHotkey).toBe(kickoff.prevLeagueHotkey)
  })
})

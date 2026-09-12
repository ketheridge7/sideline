import { describe, expect, it } from 'vitest'
import { OVERLAY_LAYOUT_SCHEMA_VERSION } from './overlayLayout'
import { defaultSettings, hydrateSettings } from './settings'

describe('hydrateSettings', () => {
  it('keeps a persisted Sleeper user id and drops junk', () => {
    expect(hydrateSettings({ sleeperUsername: 'bob', sleeperUserId: '12345' }).sleeperUserId).toBe('12345')
    expect(hydrateSettings({ sleeperUserId: '' }).sleeperUserId).toBeNull()
    expect(defaultSettings().sleeperUserId).toBeNull()
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
})

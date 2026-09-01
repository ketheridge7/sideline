import { describe, expect, it } from 'vitest'
import { defaultSettings, hydrateSettings } from './settings'

describe('hydrateSettings', () => {
  it('keeps a persisted Sleeper user id and drops junk', () => {
    expect(hydrateSettings({ sleeperUsername: 'bob', sleeperUserId: '12345' }).sleeperUserId).toBe('12345')
    expect(hydrateSettings({ sleeperUserId: '' }).sleeperUserId).toBeNull()
    expect(defaultSettings().sleeperUserId).toBeNull()
  })
})

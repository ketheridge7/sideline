import { describe, expect, it } from 'vitest'
import { shouldCloseOnCookies } from './espnLoginPolicy'

const stale = { espn_s2: 'stale-s2', SWID: '{11111111-1111-1111-1111-111111111111}' }
const fresh = { espn_s2: 'fresh-s2', SWID: '{22222222-2222-2222-2222-222222222222}' }

describe('shouldCloseOnCookies', () => {
  it('does not close while cookies are still missing', () => {
    expect(shouldCloseOnCookies(null, null)).toBe(false)
    expect(shouldCloseOnCookies(null, stale)).toBe(false)
  })

  it('does not close on the same pre-existing espn_s2 + SWID', () => {
    expect(shouldCloseOnCookies(stale, stale)).toBe(false)
    expect(shouldCloseOnCookies({ ...stale }, stale)).toBe(false)
  })

  it('closes when cookies appear after a cleared session', () => {
    expect(shouldCloseOnCookies(fresh, null)).toBe(true)
  })

  it('closes when a fresh login replaces the previous cookie pair', () => {
    expect(shouldCloseOnCookies(fresh, stale)).toBe(true)
    expect(shouldCloseOnCookies({ ...stale, espn_s2: 'rotated-s2' }, stale)).toBe(true)
    expect(shouldCloseOnCookies({ ...stale, SWID: fresh.SWID }, stale)).toBe(true)
  })
})

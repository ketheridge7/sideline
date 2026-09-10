import { describe, expect, it } from 'vitest'
import {
  espnFantasySessionReady,
  espnLoginPageIsAuthWall,
  shouldCloseOnCookies,
  shouldCloseOnEspnLogin
} from './espnLoginPolicy'

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

describe('espn login page', () => {
  it('treats ESPN login and Disney identity as an auth wall', () => {
    expect(espnLoginPageIsAuthWall('https://www.espn.com/login?redirectUri=https://fantasy.espn.com/')).toBe(
      true
    )
    expect(espnLoginPageIsAuthWall('https://cdn.registerdisney.go.com/')).toBe(true)
    expect(espnLoginPageIsAuthWall(null)).toBe(true)
    expect(espnLoginPageIsAuthWall('https://fantasy.espn.com/football/team?leagueId=543268341')).toBe(false)
  })

  it('is ready on fantasy.espn.com after leaving login', () => {
    expect(espnFantasySessionReady('https://www.espn.com/login?redirectUri=https://fantasy.espn.com/')).toBe(
      false
    )
    expect(espnFantasySessionReady('https://fantasy.espn.com/')).toBe(true)
    expect(espnFantasySessionReady('https://www.espn.com/')).toBe(true)
  })
})

describe('shouldCloseOnEspnLogin', () => {
  it('does not close on a fresh cookie pair while still on the login page', () => {
    expect(
      shouldCloseOnEspnLogin(fresh, null, 'https://www.espn.com/login?redirectUri=https://fantasy.espn.com/')
    ).toBe(false)
  })

  it('closes once a fresh cookie pair lands on fantasy.espn.com', () => {
    expect(shouldCloseOnEspnLogin(fresh, null, 'https://fantasy.espn.com/')).toBe(true)
    expect(shouldCloseOnEspnLogin(stale, stale, 'https://fantasy.espn.com/')).toBe(false)
  })
})

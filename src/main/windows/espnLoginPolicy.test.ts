import { describe, expect, it } from 'vitest'
import {
  espnFantasySessionReady,
  espnLoginPageIsAuthWall,
  espnLoginPollPlan,
  espnLoginPopupAction,
  espnLoginUserAgent,
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

describe('espn login window helpers', () => {
  it('strips the Electron token so Disney reCAPTCHA sees Chrome', () => {
    expect(
      espnLoginUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Electron/38.8.6 Safari/537.36'
      )
    ).toBe(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
    )
  })

  it('allows ESPN and Google popups and blocks everything else', () => {
    expect(espnLoginPopupAction('https://accounts.google.com/o/oauth2/v2/auth')).toBe('allow')
    expect(espnLoginPopupAction('https://cdn.registerdisney.go.com/v2/inner')).toBe('allow')
    expect(espnLoginPopupAction('https://www.espn.com/login')).toBe('allow')
    expect(espnLoginPopupAction('http://accounts.google.com/')).toBe('deny')
    expect(espnLoginPopupAction('https://evil.example/')).toBe('deny')
    expect(espnLoginPopupAction('not a url')).toBe('deny')
  })

  it('waits on the login page, then accepts a cookie pair that never navigates away', () => {
    expect(espnLoginPollPlan({ closeNow: false, freshCookiesOnWall: true, wallPolls: 0 })).toEqual({
      action: 'wait',
      wallPolls: 1
    })
    expect(espnLoginPollPlan({ closeNow: false, freshCookiesOnWall: true, wallPolls: 2 })).toEqual({
      action: 'close',
      wallPolls: 3
    })
    expect(espnLoginPollPlan({ closeNow: true, freshCookiesOnWall: true, wallPolls: 0 })).toEqual({
      action: 'close',
      wallPolls: 0
    })
    expect(espnLoginPollPlan({ closeNow: false, freshCookiesOnWall: false, wallPolls: 2 })).toEqual({
      action: 'wait',
      wallPolls: 0
    })
  })
})

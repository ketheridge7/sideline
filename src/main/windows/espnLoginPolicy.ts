import type { EspnCookies } from '../providers/espnClient'

/** True only when espn_s2 + SWID exist and are not the snapshot from before this login. */
export const shouldCloseOnCookies = (
  observed: EspnCookies | null,
  preexisting: EspnCookies | null
): boolean => {
  if (!observed) return false
  if (!preexisting) return true
  return observed.espn_s2 !== preexisting.espn_s2 || observed.SWID !== preexisting.SWID
}

/** Login/identity hosts still set leftover names; fantasy.espn.com is where espn_s2 is usable. */
export const espnLoginPageIsAuthWall = (pageUrl: string | null | undefined): boolean => {
  if (!pageUrl) return true
  try {
    const url = new URL(pageUrl)
    const host = url.hostname.toLowerCase()
    const path = url.pathname.toLowerCase()
    if (host.includes('registerdisney') || host.includes('identity') || host.includes('cdn.registerdisney')) {
      return true
    }
    if (path.includes('/login') || path.includes('/signin') || path.includes('/welcome')) return true
    return false
  } catch {
    return true
  }
}

export const espnFantasySessionReady = (pageUrl: string | null | undefined): boolean => {
  if (!pageUrl || espnLoginPageIsAuthWall(pageUrl)) return false
  try {
    const host = new URL(pageUrl).hostname.toLowerCase()
    return host === 'fantasy.espn.com' || host.endsWith('.fantasy.espn.com') || host === 'espn.com' || host.endsWith('.espn.com')
  } catch {
    return false
  }
}

/** Close only after a fresh cookie pair AND the window has left the auth wall. */
export const shouldCloseOnEspnLogin = (
  observed: EspnCookies | null,
  preexisting: EspnCookies | null,
  pageUrl: string | null | undefined
): boolean => shouldCloseOnCookies(observed, preexisting) && espnFantasySessionReady(pageUrl)

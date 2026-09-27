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

/**
 * ESPN's login page redirects on `redirect`, not `redirectUri`. If that navigation
 * never leaves /login, still accept a fresh pair after a few polls so the window
 * cannot sit on a finished session forever.
 */
export const ESPN_LOGIN_WALL_POLLS_BEFORE_CLOSE = 3

export const espnLoginPollPlan = (opts: {
  closeNow: boolean
  freshCookiesOnWall: boolean
  wallPolls: number
}): { action: 'close' | 'wait'; wallPolls: number } => {
  if (opts.closeNow) return { action: 'close', wallPolls: 0 }
  if (opts.freshCookiesOnWall) {
    const wallPolls = opts.wallPolls + 1
    if (wallPolls >= ESPN_LOGIN_WALL_POLLS_BEFORE_CLOSE) return { action: 'close', wallPolls }
    return { action: 'wait', wallPolls }
  }
  return { action: 'wait', wallPolls: 0 }
}

/** reCAPTCHA and Disney OneID reject the Electron token in the default user agent. */
export const espnLoginUserAgent = (electronUserAgent: string): string =>
  electronUserAgent.replace(/ Electron\/\S+/g, '').replace(/ sideline\/\S+/gi, '').trim()

const POPUP_HOST_SUFFIXES = [
  'espn.com',
  'espncdn.com',
  'espn.go.com',
  'go.com',
  'registerdisney.go.com',
  'disney.com',
  'google.com',
  'gstatic.com',
  'recaptcha.net',
  'apple.com',
  'icloud.com'
]

/** Email/password stays in the Disney iframe. Google and Apple sign-in open a popup. */
export const espnLoginPopupAction = (url: string): 'allow' | 'deny' => {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return 'deny'
    const host = parsed.hostname.toLowerCase()
    const allowed = POPUP_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
    return allowed ? 'allow' : 'deny'
  } catch {
    return 'deny'
  }
}

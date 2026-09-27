import { BrowserWindow, session, type Cookie } from 'electron'
import { pickEspnCookies, type EspnCookies } from '../providers/espnClient'
import {
  espnLoginPollPlan,
  espnLoginPopupAction,
  espnLoginUserAgent,
  shouldCloseOnCookies,
  shouldCloseOnEspnLogin
} from './espnLoginPolicy'

const PARTITION = 'persist:espn'

/**
 * ESPN's page only honors returnURL, referer, redirect, or appRedirect.
 * `redirectUri` is ignored, so a finished login used to fall through to http://www.espn.com.
 */
export const ESPN_LOGIN_URL = 'https://www.espn.com/login?redirect=https://fantasy.espn.com/'

export const ESPN_SIGNIN_CLOSED =
  'ESPN sign-in was closed before espn_s2 and SWID were saved. Finish signing in in the ESPN window, or paste a league ID under Advanced.'

export const ESPN_SIGNIN_LOAD_FAILED = 'Could not open ESPN sign-in. Check your connection and try again.'

export const ESPN_SIGNIN_NO_COOKIES =
  'ESPN sign-in finished, but Sideline could not read espn_s2 and SWID. Try again.'

export const espnSession = (): Electron.Session => session.fromPartition(PARTITION)

const cookieRemovalUrl = (row: Cookie): string => {
  const host = (row.domain ?? 'espn.com').replace(/^\./, '')
  const path = row.path && row.path.startsWith('/') ? row.path : '/'
  return `https://${host}${path}`
}

const COOKIE_URLS = [
  'https://fantasy.espn.com/',
  'https://www.espn.com/',
  'https://lm-api-reads.fantasy.espn.com/'
] as const

export const readEspnCookies = async (): Promise<EspnCookies | null> => {
  const sess = espnSession()
  const groups = await Promise.all([
    sess.cookies.get({}),
    ...COOKIE_URLS.map((url) => sess.cookies.get({ url }))
  ])
  return pickEspnCookies(groups.flat())
}

export const clearEspnCookies = async (): Promise<void> => {
  const sess = espnSession()
  const rows = await sess.cookies.get({})
  await Promise.all(rows.map((row) => sess.cookies.remove(cookieRemovalUrl(row), row.name)))
  await sess.clearStorageData({
    storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage']
  })
}

export type EspnLoginResult = { ok: boolean; error?: string }

const applyEspnLoginUserAgent = (contents: Electron.WebContents): void => {
  const ua = espnLoginUserAgent(contents.getUserAgent() || espnSession().getUserAgent())
  espnSession().setUserAgent(ua)
  contents.setUserAgent(ua)
}

let loginInFlight: Promise<EspnLoginResult> | null = null

export const openEspnLogin = (): Promise<EspnLoginResult> => {
  if (loginInFlight) return loginInFlight
  loginInFlight = openEspnLoginOnce().finally(() => {
    loginInFlight = null
  })
  return loginInFlight
}

const openEspnLoginOnce = async (): Promise<EspnLoginResult> => {
  // Re-login is intentional: drop leftover persist:espn cookies so a stale
  // espn_s2 + SWID pair cannot instantly dismiss the window.
  await clearEspnCookies()
  const preexisting = await readEspnCookies()

  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 980,
      height: 760,
      title: 'Sign in to ESPN',
      autoHideMenuBar: true,
      webPreferences: {
        partition: PARTITION,
        nodeIntegration: false,
        contextIsolation: true
      }
    })
    applyEspnLoginUserAgent(win.webContents)

    let settled = false
    let wallPolls = 0
    let poll: ReturnType<typeof setInterval> | undefined
    const finish = (result: EspnLoginResult): void => {
      if (settled) return
      settled = true
      if (poll) clearInterval(poll)
      if (!win.isDestroyed()) win.close()
      resolve(result)
    }

    poll = setInterval(() => {
      void readEspnCookies().then((cookies) => {
        if (settled || win.isDestroyed()) return
        const pageUrl = win.webContents.getURL()
        const plan = espnLoginPollPlan({
          closeNow: shouldCloseOnEspnLogin(cookies, preexisting, pageUrl),
          freshCookiesOnWall: shouldCloseOnCookies(cookies, preexisting),
          wallPolls
        })
        wallPolls = plan.wallPolls
        if (plan.action === 'close') finish({ ok: true })
      })
    }, 1000)

    win.webContents.setWindowOpenHandler((details) => {
      if (espnLoginPopupAction(details.url) === 'deny') return { action: 'deny' }
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          parent: win,
          width: 480,
          height: 720,
          autoHideMenuBar: true,
          webPreferences: {
            partition: PARTITION,
            nodeIntegration: false,
            contextIsolation: true
          }
        }
      }
    })

    win.webContents.on('did-fail-load', (_event, code, desc, _url, isMainFrame) => {
      if (!isMainFrame || code === -3) return
      const detail = desc.trim() || `code ${code}`
      finish({ ok: false, error: `${ESPN_SIGNIN_LOAD_FAILED} (${detail})` })
    })

    win.on('closed', () => {
      if (poll) clearInterval(poll)
      if (settled) return
      void readEspnCookies().then((cookies) => {
        if (shouldCloseOnCookies(cookies, preexisting)) finish({ ok: true })
        else finish({ ok: false, error: ESPN_SIGNIN_CLOSED })
      })
    })

    void win.loadURL(ESPN_LOGIN_URL).catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : 'network error'
      finish({ ok: false, error: `${ESPN_SIGNIN_LOAD_FAILED} (${detail})` })
    })
  })
}

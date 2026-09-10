import { BrowserWindow, session } from 'electron'
import { pickEspnCookies, type EspnCookies } from '../providers/espnClient'
import { shouldCloseOnEspnLogin } from './espnLoginPolicy'

const PARTITION = 'persist:espn'

export const ESPN_LOGIN_URL = 'https://www.espn.com/login?redirectUri=https://fantasy.espn.com/'

export const espnSession = (): Electron.Session => session.fromPartition(PARTITION)

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
  await espnSession().clearStorageData()
}

export const openEspnLogin = async (): Promise<{ ok: boolean }> => {
  // Re-login is intentional: drop leftover persist:espn cookies so a stale
  // espn_s2 + SWID pair cannot instantly dismiss the window.
  await clearEspnCookies()
  const preexisting = await readEspnCookies()

  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 980,
      height: 760,
      title: 'Sign in to ESPN',
      webPreferences: {
        partition: PARTITION,
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    let settled = false
    const finishOk = (): void => {
      if (settled) return
      settled = true
      if (!win.isDestroyed()) win.close()
      resolve({ ok: true })
    }

    const poll = setInterval(() => {
      void readEspnCookies().then((cookies) => {
        const pageUrl = win.isDestroyed() ? null : win.webContents.getURL()
        if (shouldCloseOnEspnLogin(cookies, preexisting, pageUrl)) finishOk()
      })
    }, 1000)

    win.on('closed', () => {
      clearInterval(poll)
      if (!settled) resolve({ ok: false })
    })

    void win.loadURL(ESPN_LOGIN_URL)
  })
}

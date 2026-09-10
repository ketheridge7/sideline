import { BrowserWindow, session } from 'electron'
import { normalizeEspnCookies, type EspnCookies } from '../providers/espnClient'
import { shouldCloseOnCookies } from './espnLoginPolicy'

const PARTITION = 'persist:espn'

export const ESPN_LOGIN_URL = 'https://www.espn.com/login?redirectUri=https://fantasy.espn.com/'

export const espnSession = (): Electron.Session => session.fromPartition(PARTITION)

export const readEspnCookies = async (): Promise<EspnCookies | null> => {
  const sess = espnSession()
  const groups = await Promise.all([
    sess.cookies.get({ domain: '.espn.com' }),
    sess.cookies.get({ domain: 'espn.com' }),
    sess.cookies.get({ domain: 'fantasy.espn.com' })
  ])
  const all = groups.flat()
  const espn_s2 = all.find((cookie) => cookie.name === 'espn_s2')?.value
  const SWID = all.find((cookie) => cookie.name === 'SWID')?.value
  if (!espn_s2 || !SWID) return null
  return normalizeEspnCookies({ espn_s2, SWID })
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
        if (shouldCloseOnCookies(cookies, preexisting)) finishOk()
      })
    }, 1000)

    win.on('closed', () => {
      clearInterval(poll)
      if (!settled) resolve({ ok: false })
    })

    void win.loadURL(ESPN_LOGIN_URL)
  })
}

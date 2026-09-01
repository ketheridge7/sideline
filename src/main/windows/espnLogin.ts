import { BrowserWindow, session } from 'electron'
import { normalizeEspnCookies, type EspnCookies } from '../providers/espnClient'

const PARTITION = 'persist:espn'

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

export const openEspnLogin = (): Promise<{ ok: boolean }> => {
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
        if (cookies) finishOk()
      })
    }, 1000)

    win.on('closed', () => {
      clearInterval(poll)
      if (!settled) resolve({ ok: false })
    })

    win.loadURL('https://www.espn.com/login?redirectUri=https://fantasy.espn.com/')
  })
}

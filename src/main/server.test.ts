import { request as httpRequest, type IncomingHttpHeaders } from 'http'
import { Server } from 'net'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }))

import { listenOnFreePort, OverlayListenError } from './overlayListen'
import { resetLanIPv4LookupForTests, setLanIPv4LookupForTests } from './overlayAccess'
import {
  bindLanTokenPersistence,
  overlayLanState,
  resetLanTokenPersistenceForTests,
  setOverlayLanEnabled,
  startOverlayServer,
  stopOverlayServer
} from './server'

afterEach(async () => {
  vi.restoreAllMocks()
  await stopOverlayServer()
  resetLanTokenPersistenceForTests()
  resetLanIPv4LookupForTests()
})

const getWithHost = (
  port: number,
  path: string,
  host: string
): Promise<{ status: number; headers: IncomingHttpHeaders; body: string }> =>
  new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'GET',
        headers: { Host: host, Connection: 'close' }
      },
      (res) => {
        const chunks: Buffer[] = []
        let settled = false
        const finish = (): void => {
          if (settled) return
          settled = true
          res.destroy()
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8')
          })
        }
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk)
          finish()
        })
        res.on('end', finish)
        res.on('error', finish)
      }
    )
    req.on('error', reject)
    req.end()
  })

const errno = (code: string): NodeJS.ErrnoException => Object.assign(new Error(code), { code })

describe('overlay server port fallback', () => {
  it('moves past a non-EADDRINUSE bind failure (EACCES excluded range) to the next port', async () => {
    const realListen = Server.prototype.listen
    const refused: number[] = []
    vi.spyOn(Server.prototype, 'listen').mockImplementation(function (this: Server, ...args: unknown[]) {
      const port = args[0]
      if (port === 18480) {
        refused.push(port)
        process.nextTick(() => this.emit('error', errno('EACCES')))
        return this
      }
      return (realListen as (...rest: unknown[]) => Server).apply(this, args)
    })
    const port = await startOverlayServer(18480, false)
    expect(refused).toEqual([18480])
    expect(port).toBe(18481)
    const res = await fetch(`http://127.0.0.1:${port}/events`)
    expect(res.status).toBe(200)
    res.body?.cancel()
  })

  it('tries every port in the span on mixed errors and reports the last code', async () => {
    const tried: number[] = []
    const attempt = async (port: number): Promise<number> => {
      tried.push(port)
      throw errno(port % 2 === 0 ? 'EACCES' : 'EADDRNOTAVAIL')
    }
    const failure = await listenOnFreePort(7333, '127.0.0.1', attempt, 4).catch((error: unknown) => error)
    expect(tried).toEqual([7333, 7334, 7335, 7336])
    expect(failure).toBeInstanceOf(OverlayListenError)
    expect(failure).toMatchObject({ code: 'EACCES', startPort: 7333, endPort: 7336 })
  })

  it('returns the first port that binds', async () => {
    const attempt = async (port: number): Promise<number> => {
      if (port < 7335) throw errno('EACCES')
      return port
    }
    await expect(listenOnFreePort(7333, '127.0.0.1', attempt)).resolves.toBe(7335)
  })
})

describe('overlay server LAN gate', () => {
  it('serves SSE without a token when bound to loopback', async () => {
    const port = await startOverlayServer(18300, false)
    const res = await fetch(`http://127.0.0.1:${port}/events`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
    res.body?.cancel()
  })

  it('rejects overlay and SSE without a token when LAN is on', async () => {
    const port = await startOverlayServer(18330, true, '127.0.0.1')
    const events = await fetch(`http://127.0.0.1:${port}/events`)
    expect(events.status).toBe(403)
    events.body?.cancel()
    const overlay = await fetch(`http://127.0.0.1:${port}/overlay`)
    expect(overlay.status).toBe(403)
  })

  it('allows SSE with the session token and omits wildcard CORS', async () => {
    const port = await startOverlayServer(18360, true, '127.0.0.1')
    const token = overlayLanState().token
    expect(token).toBeTruthy()
    const res = await fetch(`http://127.0.0.1:${port}/events?k=${token}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
    res.body?.cancel()
  })

  it('resolves a 6-digit pairing code to the session token', async () => {
    const port = await startOverlayServer(18390, true, '127.0.0.1')
    const lan = overlayLanState()
    expect(lan.pairingCode).toMatch(/^\d{6}$/)
    expect(lan.token).toBeTruthy()
    const res = await fetch(`http://127.0.0.1:${port}/pair?code=${lan.pairingCode}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ token: lan.token, port })
    const spaced = await fetch(
      `http://127.0.0.1:${port}/pair?code=${lan.pairingCode?.slice(0, 3)}+${lan.pairingCode?.slice(3)}`
    )
    expect(spaced.status).toBe(200)
    expect(await spaced.json()).toEqual({ token: lan.token, port })
  })

  it('rejects a bad pairing code and does not serve the HUD without the token', async () => {
    const port = await startOverlayServer(18420, true, '127.0.0.1')
    const lan = overlayLanState()
    const code = lan.pairingCode ?? '418302'
    const wrong = code.startsWith('0') ? `1${code.slice(1)}` : `0${code.slice(1)}`
    const bad = await fetch(`http://127.0.0.1:${port}/pair?code=${wrong}`)
    expect(bad.status).toBe(404)
    expect(await bad.json()).toEqual({ ok: false })
    const overlay = await fetch(`http://127.0.0.1:${port}/overlay`)
    expect(overlay.status).toBe(403)
  })

  it('rejects a foreign Host so a webpage cannot open the loopback HUD', async () => {
    const port = await startOverlayServer(18580, false)
    const ok = await getWithHost(port, '/events', `127.0.0.1:${port}`)
    expect(ok.status).toBe(200)
    expect(ok.headers['access-control-allow-origin']).toBeUndefined()
    expect(ok.headers['content-type']).toContain('text/event-stream')
    const localhost = await getWithHost(port, '/events', `localhost:${port}`)
    expect(localhost.status).toBe(200)
    const evil = await getWithHost(port, '/events', `evil.example:${port}`)
    expect(evil.status).toBe(403)
    expect(evil.body).toBe('forbidden')
    expect(evil.headers['access-control-allow-origin']).toBeUndefined()
    expect(evil.headers['content-type']).not.toContain('text/event-stream')
    const wrongPort = await getWithHost(port, '/events', `127.0.0.1:${port + 1}`)
    expect(wrongPort.status).toBe(403)
  })

  it('allows a LAN address of this machine only while LAN overlay is on', async () => {
    const address = '203.0.113.10'
    setLanIPv4LookupForTests(() => [address])
    const port = await startOverlayServer(18610, true, '127.0.0.1')
    const token = overlayLanState().token
    const allowed = await getWithHost(port, `/events?k=${token}`, `${address}:${port}`)
    expect(allowed.status).toBe(200)
    await stopOverlayServer()
    const loop = await startOverlayServer(18620, false)
    const denied = await getWithHost(loop, '/events', `${address}:${loop}`)
    expect(denied.status).toBe(403)
  })

  it('keeps the LAN token across a server restart', async () => {
    await startOverlayServer(18640, true, '127.0.0.1')
    const token = overlayLanState().token
    expect(token).toMatch(/^[0-9a-f]{16}$/)
    await stopOverlayServer()
    expect(overlayLanState().token).toBeNull()
    const port = await startOverlayServer(18650, true, '127.0.0.1')
    expect(overlayLanState().token).toBe(token)
    const res = await fetch(`http://127.0.0.1:${port}/events?k=${token}`)
    expect(res.status).toBe(200)
    res.body?.cancel()
  })

  it('forgets the LAN token when LAN is turned off and issues a new one when turned back on', async () => {
    await startOverlayServer(18670, true, '127.0.0.1')
    const token = overlayLanState().token
    const off = await setOverlayLanEnabled(false, '127.0.0.1')
    expect(overlayLanState().enabled).toBe(false)
    expect(overlayLanState().token).toBeNull()
    const open = await fetch(`http://127.0.0.1:${off}/events`)
    expect(open.status).toBe(200)
    open.body?.cancel()
    const on = await setOverlayLanEnabled(true, '127.0.0.1')
    const next = overlayLanState().token
    expect(next).toBeTruthy()
    expect(next).not.toBe(token)
    const denied = await fetch(`http://127.0.0.1:${on}/events?k=${token}`)
    expect(denied.status).toBe(403)
    const allowed = await fetch(`http://127.0.0.1:${on}/events?k=${next}`)
    expect(allowed.status).toBe(200)
    allowed.body?.cancel()
  })

  it('reuses a stored token and replaces a corrupt one', async () => {
    let saved: string | null = 'abc123abc123abcd'
    bindLanTokenPersistence({
      load: () => saved,
      save: (token) => {
        saved = token
      }
    })
    await startOverlayServer(18700, true, '127.0.0.1')
    expect(overlayLanState().token).toBe('abc123abc123abcd')
    expect(saved).toBe('abc123abc123abcd')
    await stopOverlayServer()
    saved = 'not-a-token'
    await startOverlayServer(18710, true, '127.0.0.1')
    expect(overlayLanState().token).toMatch(/^[0-9a-f]{16}$/)
    expect(overlayLanState().token).not.toBe('not-a-token')
    expect(saved).toBe(overlayLanState().token)
  })

  it('does not expose pairing when LAN overlay is off', async () => {
    const port = await startOverlayServer(18450, false)
    expect(overlayLanState().pairingCode).toBeNull()
    const pair = await fetch(`http://127.0.0.1:${port}/pair?code=418302`)
    expect(pair.status).toBe(404)
    const events = await fetch(`http://127.0.0.1:${port}/events`)
    expect(events.status).toBe(200)
    events.body?.cancel()
  })
})

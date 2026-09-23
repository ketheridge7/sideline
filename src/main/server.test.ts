import { Server } from 'net'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }))

import { listenOnFreePort, OverlayListenError } from './overlayListen'
import { overlayLanState, startOverlayServer, stopOverlayServer } from './server'

afterEach(async () => {
  vi.restoreAllMocks()
  await stopOverlayServer()
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
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
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

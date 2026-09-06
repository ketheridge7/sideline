import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }))

import { overlayLanState, startOverlayServer, stopOverlayServer } from './server'

afterEach(async () => {
  await stopOverlayServer()
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

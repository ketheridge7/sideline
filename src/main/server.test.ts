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
})

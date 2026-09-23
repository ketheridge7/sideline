import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import { createReadStream, existsSync, statSync } from 'fs'
import { extname, join, sep } from 'path'
import { is } from '@electron-toolkit/utils'
import type { OverlayHudState } from '@shared/types'
import { emptyAppState, overlayHudUnchanged, toOverlayHud } from '@shared/types'
import { isLanOverlayToken } from '@shared/settings'
import {
  generateOverlayToken,
  lanBindHost,
  lanIPv4,
  lanIPv4Addresses,
  overlayHostAllowed,
  requiresOverlayToken,
  resolveOverlayFile,
  tokenMatches
} from './overlayAccess'
import { listenOnFreePort } from './overlayListen'
import { OverlayPairing, pairingHttpStatus } from './overlayPairing'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2'
}

const clients = new Set<ServerResponse>()
let lastHud: OverlayHudState | null = null
let lastEvent = `data: ${JSON.stringify(toOverlayHud(emptyAppState()))}\n\n`
let server: Server | null = null
let boundPort = 7333
let lanEnabled = false
let sessionToken: string | null = null
const pairing = new OverlayPairing()

export type LanTokenPersistence = {
  load: () => string | null
  save: (token: string | null) => void
}

let memoryToken: string | null = null
const memoryTokenStore: LanTokenPersistence = {
  load: () => memoryToken,
  save: (token) => {
    memoryToken = token
  }
}
let tokenStore: LanTokenPersistence = memoryTokenStore

/** Production wires this to settings. Tests keep the in-memory store. */
export const bindLanTokenPersistence = (store: LanTokenPersistence): void => {
  tokenStore = store
}

export const resetLanTokenPersistenceForTests = (): void => {
  memoryToken = null
  tokenStore = memoryTokenStore
}

export const overlayLanState = (): {
  enabled: boolean
  token: string | null
  host: string | null
  pairingCode: string | null
} => ({
  enabled: lanEnabled,
  token: sessionToken,
  host: lanEnabled ? lanIPv4() : null,
  pairingCode: lanEnabled ? pairing.currentCode() : null
})

export const publishOverlay = (hud: OverlayHudState): void => {
  if (lastHud && overlayHudUnchanged(lastHud, hud)) return
  lastHud = hud
  lastEvent = `data: ${JSON.stringify(hud)}\n\n`
  for (const client of clients) client.write(lastEvent)
}

const sendForbidden = (res: ServerResponse): void => {
  res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('forbidden')
}

const sendJson = (res: ServerResponse, status: number, body: unknown): void => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

const handlePair = (url: URL, res: ServerResponse): void => {
  // TODO(phase-0): advertise `_sideline._tcp` so the TV can skip the /24 HTTP scan.
  if (!lanEnabled) {
    sendJson(res, 404, { ok: false })
    return
  }
  const result = pairing.resolve(url.searchParams.get('code') ?? '')
  if (!result.ok) {
    sendJson(res, pairingHttpStatus(result.reason), { ok: false })
    return
  }
  sendJson(res, 200, { token: result.token, port: boundPort })
}

const disarmLanSession = (): void => {
  sessionToken = null
  pairing.clear()
}

/** Reuse the saved token. Generate one only when nothing valid is stored. */
const armLanSession = (): void => {
  const existing = tokenStore.load()
  const token = isLanOverlayToken(existing) ? existing : generateOverlayToken()
  if (token !== existing) tokenStore.save(token)
  sessionToken = token
  pairing.issue(sessionToken)
}

/** User turned LAN off. The next time it is turned on, the TV must pair again. */
const forgetLanToken = (): void => {
  tokenStore.save(null)
  disarmLanSession()
}

const sendSse = (res: ServerResponse): void => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  })
  res.write(lastEvent)
  clients.add(res)
  const ping = setInterval(() => {
    res.write('event: ping\ndata: {}\n\n')
  }, 15000)
  res.on('close', () => {
    clearInterval(ping)
    clients.delete(res)
  })
}

const rendererRoot = (): string => join(__dirname, '../renderer')

const closeServer = (): Promise<void> =>
  new Promise((resolve) => {
    if (!server) {
      resolve()
      return
    }
    const current = server
    server = null
    for (const client of clients) client.end()
    clients.clear()
    if (typeof current.closeAllConnections === 'function') current.closeAllConnections()
    current.close(() => resolve())
  })

const hostAllowed = (req: IncomingMessage): boolean => {
  const header = req.headers.host
  return overlayHostAllowed(typeof header === 'string' ? header : undefined, {
    port: boundPort,
    lanEnabled,
    lanAddresses: lanEnabled ? lanIPv4Addresses() : []
  })
}

const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  if (!hostAllowed(req)) {
    sendForbidden(res)
    return
  }
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  if (requiresOverlayToken(lanEnabled, url.pathname) && !tokenMatches(url.searchParams.get('k'), sessionToken)) {
    sendForbidden(res)
    return
  }

  if (url.pathname === '/pair') {
    handlePair(url, res)
    return
  }

  if (url.pathname === '/events') {
    sendSse(res)
    return
  }

  let pathname = url.pathname
  if (pathname === '/overlay') {
    res.writeHead(302, { Location: `/overlay/index.html${url.search}` })
    res.end()
    return
  }
  if (pathname === '/' || pathname === '/overlay/') pathname = '/overlay/index.html'

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    const target = `${process.env.ELECTRON_RENDERER_URL}${pathname}${url.search}`
    try {
      const proxied = await fetch(target)
      res.writeHead(proxied.status, {
        'Content-Type': proxied.headers.get('content-type') || 'text/plain'
      })
      res.end(Buffer.from(await proxied.arrayBuffer()))
    } catch {
      res.writeHead(502)
      res.end('overlay proxy failed')
    }
    return
  }

  const root = rendererRoot()
  const filePath = resolveOverlayFile(root, pathname)
  if (!filePath || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    res.writeHead(404)
    res.end('not found')
    return
  }
  if (!filePath.startsWith(root + sep) && filePath !== root) {
    res.writeHead(404)
    res.end('not found')
    return
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' })
  createReadStream(filePath).pipe(res)
}

const tryListen = (port: number, host: string): Promise<number> =>
  new Promise((resolve, reject) => {
    const next = createServer((req, res) => {
      void handle(req, res)
    })
    next.once('error', (error) => {
      next.close()
      reject(error)
    })
    next.listen(port, host, () => {
      server = next
      resolve(port)
    })
  })

const listen = (startPort: number, host: string): Promise<number> =>
  listenOnFreePort(startPort, host, tryListen)

export const startOverlayServer = async (
  startPort = 7333,
  enabled = false,
  host = lanBindHost(enabled)
): Promise<number> => {
  lanEnabled = enabled
  if (enabled) armLanSession()
  else disarmLanSession()
  boundPort = await listen(startPort, host)
  return boundPort
}

export const setOverlayLanEnabled = async (
  enabled: boolean,
  host = lanBindHost(enabled)
): Promise<number> => {
  const port = boundPort
  lanEnabled = enabled
  if (enabled) armLanSession()
  else forgetLanToken()
  await closeServer()
  await new Promise((resolve) => setTimeout(resolve, 100))
  boundPort = await listen(port, host)
  return boundPort
}

export const stopOverlayServer = async (): Promise<void> => {
  await closeServer()
  // A process stop keeps the saved token so a paired TV survives a PC restart.
  // Turning LAN off is what forgets it.
  disarmLanSession()
  lanEnabled = false
  lastHud = null
}

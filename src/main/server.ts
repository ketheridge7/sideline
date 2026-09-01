import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import { createReadStream, existsSync, statSync } from 'fs'
import { extname, join, sep } from 'path'
import { is } from '@electron-toolkit/utils'
import type { OverlayHudState } from '@shared/types'
import { emptyAppState, overlayHudUnchanged, toOverlayHud } from '@shared/types'
import {
  generateOverlayToken,
  lanBindHost,
  lanIPv4,
  requiresOverlayToken,
  resolveOverlayFile,
  tokenMatches
} from './overlayAccess'

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

export const overlayLanState = (): { enabled: boolean; token: string | null; host: string | null } => ({
  enabled: lanEnabled,
  token: sessionToken,
  host: lanEnabled ? lanIPv4() : null
})

export const publishOverlay = (hud: OverlayHudState): void => {
  if (lastHud && overlayHudUnchanged(lastHud, hud)) return
  lastHud = hud
  lastEvent = `data: ${JSON.stringify(hud)}\n\n`
  for (const client of clients) client.write(lastEvent)
}

const corsHeaders = (): Record<string, string> =>
  lanEnabled ? {} : { 'Access-Control-Allow-Origin': '*' }

const sendForbidden = (res: ServerResponse): void => {
  res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders() })
  res.end('forbidden')
}

const sendSse = (res: ServerResponse): void => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    ...corsHeaders()
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

const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  if (requiresOverlayToken(lanEnabled, url.pathname) && !tokenMatches(url.searchParams.get('k'), sessionToken)) {
    sendForbidden(res)
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
        'Content-Type': proxied.headers.get('content-type') || 'text/plain',
        ...corsHeaders()
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

const listen = async (startPort: number, host: string): Promise<number> => {
  for (let port = startPort; port < startPort + 30; port += 1) {
    try {
      return await tryListen(port, host)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'EADDRINUSE') throw error
    }
  }
  throw new Error('No free port for overlay server')
}

export const startOverlayServer = async (
  startPort = 7333,
  enabled = false,
  host = lanBindHost(enabled)
): Promise<number> => {
  lanEnabled = enabled
  sessionToken = enabled ? generateOverlayToken() : null
  boundPort = await listen(startPort, host)
  return boundPort
}

export const setOverlayLanEnabled = async (enabled: boolean): Promise<number> => {
  const port = boundPort
  lanEnabled = enabled
  sessionToken = enabled ? generateOverlayToken() : null
  await closeServer()
  await new Promise((resolve) => setTimeout(resolve, 100))
  boundPort = await listen(port, lanBindHost(enabled))
  return boundPort
}

export const stopOverlayServer = async (): Promise<void> => {
  await closeServer()
  sessionToken = null
  lanEnabled = false
  lastHud = null
}

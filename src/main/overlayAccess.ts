import { randomBytes, timingSafeEqual } from 'crypto'
import { isAbsolute, join, normalize, relative } from 'path'
import { networkInterfaces } from 'os'

export const generateOverlayToken = (): string => randomBytes(8).toString('hex')

export const lanBindHost = (lanEnabled: boolean): string => (lanEnabled ? '0.0.0.0' : '127.0.0.1')

export const lanIPv4 = (): string | null => {
  for (const addrs of Object.values(networkInterfaces())) {
    if (!addrs) continue
    for (const addr of addrs) {
      if (String(addr.family) !== 'IPv4' && String(addr.family) !== '4') continue
      if (addr.internal) continue
      if (addr.address.startsWith('169.254.')) continue
      return addr.address
    }
  }
  return null
}

export const overlayPageUrl = (host: string, port: number, token: string, tv: boolean): string => {
  const params = new URLSearchParams({ k: token })
  if (tv) params.set('tv', '1')
  return `http://${host}:${port}/overlay?${params.toString()}`
}

export const tokenMatches = (provided: string | null, expected: string | null): boolean => {
  if (!expected) return true
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export const isOverlayHtmlPath = (pathname: string): boolean =>
  pathname === '/' ||
  pathname === '/overlay' ||
  pathname === '/overlay/' ||
  pathname === '/overlay/index.html' ||
  pathname.endsWith('.html')

export const requiresOverlayToken = (lanEnabled: boolean, pathname: string): boolean =>
  lanEnabled && (pathname === '/events' || isOverlayHtmlPath(pathname))

export const resolveOverlayFile = (root: string, pathname: string): string | null => {
  let decoded = pathname
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  const relativePath = decoded.replace(/^\/+/, '')
  const filePath = normalize(join(root, relativePath))
  const rel = relative(root, filePath)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null
  return filePath
}

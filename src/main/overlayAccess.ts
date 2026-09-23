import { randomBytes, timingSafeEqual } from 'crypto'
import { isAbsolute, join, normalize, relative } from 'path'
import { networkInterfaces } from 'os'

export const generateOverlayToken = (): string => randomBytes(8).toString('hex')

export const lanBindHost = (lanEnabled: boolean): string => (lanEnabled ? '0.0.0.0' : '127.0.0.1')

const isRoutableLanIPv4 = (family: string | number, internal: boolean, address: string): boolean => {
  if (String(family) !== 'IPv4' && String(family) !== '4') return false
  if (internal) return false
  if (address.startsWith('169.254.')) return false
  return true
}

const collectLanIPv4s = (): string[] => {
  const found: string[] = []
  for (const addrs of Object.values(networkInterfaces())) {
    if (!addrs) continue
    for (const addr of addrs) {
      if (!isRoutableLanIPv4(addr.family, addr.internal, addr.address)) continue
      found.push(addr.address)
    }
  }
  return found
}

let lanIPv4Lookup = collectLanIPv4s

/** Every non-link-local IPv4 on this machine. The HUD URL uses the first; the Host check allows all. */
export const lanIPv4Addresses = (): string[] => lanIPv4Lookup()

export const setLanIPv4LookupForTests = (lookup: () => string[]): void => {
  lanIPv4Lookup = lookup
}

export const resetLanIPv4LookupForTests = (): void => {
  lanIPv4Lookup = collectLanIPv4s
}

export const lanIPv4 = (): string | null => lanIPv4Addresses()[0] ?? null

export type OverlayHostCheck = {
  port: number
  lanEnabled: boolean
  lanAddresses: readonly string[]
}

/**
 * OBS and the TV app load the HUD from this machine. A browser page on another
 * origin must not. Allow only loopback, or a LAN address of this PC while LAN is on.
 */
export const overlayHostAllowed = (hostHeader: string | undefined, check: OverlayHostCheck): boolean => {
  if (!hostHeader) return false
  const host = hostHeader.trim().toLowerCase()
  if (!host || /[\s/@]/.test(host)) return false
  const colon = host.lastIndexOf(':')
  if (colon <= 0) return false
  const name = host.slice(0, colon)
  const portText = host.slice(colon + 1)
  if (portText !== String(check.port)) return false
  if (name === '127.0.0.1' || name === 'localhost') return true
  if (!check.lanEnabled) return false
  return check.lanAddresses.some((address) => address.toLowerCase() === name)
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

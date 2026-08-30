import { mkdirSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  generateOverlayToken,
  isOverlayHtmlPath,
  lanBindHost,
  overlayPageUrl,
  requiresOverlayToken,
  resolveOverlayFile,
  tokenMatches
} from './overlayAccess'

describe('lanBindHost', () => {
  it('binds loopback when LAN is off', () => {
    expect(lanBindHost(false)).toBe('127.0.0.1')
  })

  it('binds all interfaces when LAN is on', () => {
    expect(lanBindHost(true)).toBe('0.0.0.0')
  })
})

describe('tokenMatches', () => {
  it('allows any request when no token is required', () => {
    expect(tokenMatches(null, null)).toBe(true)
    expect(tokenMatches('anything', null)).toBe(true)
  })

  it('rejects a missing or wrong token', () => {
    expect(tokenMatches(null, 'abc')).toBe(false)
    expect(tokenMatches('ab', 'abc')).toBe(false)
    expect(tokenMatches('abd', 'abc')).toBe(false)
  })

  it('accepts an exact match', () => {
    expect(tokenMatches('deadbeef', 'deadbeef')).toBe(true)
  })
})

describe('requiresOverlayToken', () => {
  it('never requires a token when LAN is off', () => {
    expect(requiresOverlayToken(false, '/events')).toBe(false)
    expect(requiresOverlayToken(false, '/overlay')).toBe(false)
  })

  it('requires a token for HUD HTML and SSE when LAN is on', () => {
    expect(requiresOverlayToken(true, '/events')).toBe(true)
    expect(requiresOverlayToken(true, '/overlay')).toBe(true)
    expect(requiresOverlayToken(true, '/overlay/index.html')).toBe(true)
    expect(requiresOverlayToken(true, '/')).toBe(true)
  })

  it('does not token-gate static assets', () => {
    expect(requiresOverlayToken(true, '/overlay/assets/index.js')).toBe(false)
  })
})

describe('isOverlayHtmlPath', () => {
  it('matches overlay HTML entry points', () => {
    expect(isOverlayHtmlPath('/overlay/index.html')).toBe(true)
    expect(isOverlayHtmlPath('/overlay/foo.js')).toBe(false)
  })
})

describe('overlayPageUrl', () => {
  it('includes the token and optional tv flag', () => {
    expect(overlayPageUrl('192.168.1.20', 7333, 'abc', false)).toBe(
      'http://192.168.1.20:7333/overlay?k=abc'
    )
    expect(overlayPageUrl('192.168.1.20', 7333, 'abc', true)).toBe(
      'http://192.168.1.20:7333/overlay?k=abc&tv=1'
    )
  })
})

describe('generateOverlayToken', () => {
  it('returns 16 hex characters', () => {
    expect(generateOverlayToken()).toMatch(/^[0-9a-f]{16}$/)
  })
})

describe('resolveOverlayFile', () => {
  const root = mkdtempSync(join(tmpdir(), 'sideline-overlay-'))
  mkdirSync(join(root, 'overlay'))
  writeFileSync(join(root, 'overlay', 'index.html'), '<html></html>')

  it('resolves files inside the renderer root', () => {
    expect(resolveOverlayFile(root, '/overlay/index.html')).toBe(join(root, 'overlay', 'index.html'))
  })

  it('rejects sibling and parent paths', () => {
    expect(resolveOverlayFile(root, '/../secret.txt')).toBeNull()
    expect(resolveOverlayFile(root, '/overlay/../../secret.txt')).toBeNull()
    expect(resolveOverlayFile(root, '/%2e%2e/secret.txt')).toBeNull()
  })

  it('rejects an empty path that would map to the root itself', () => {
    expect(resolveOverlayFile(root, '/')).toBeNull()
  })
})

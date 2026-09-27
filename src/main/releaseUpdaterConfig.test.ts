import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

describe('unsigned NSIS update feed', () => {
  const yml = readFileSync('electron-builder.yml', 'utf8')

  it('keeps a per-user one-click installer so silent updates need no UAC', () => {
    expect(yml).toMatch(/oneClick:\s*true/)
    expect(yml).toMatch(/perMachine:\s*false/)
    expect(yml).toMatch(/allowElevation:\s*false/)
  })

  it('publishes only the configured GitHub Releases feed and does not require a signature', () => {
    expect(yml).toMatch(/provider:\s*github/)
    expect(yml).toMatch(/owner:\s*ketheridge7/)
    expect(yml).toMatch(/repo:\s*sideline/)
    expect(yml).not.toMatch(/publisherName/)
    expect(yml).not.toMatch(/verifyUpdateCodeSignature/)
  })
})

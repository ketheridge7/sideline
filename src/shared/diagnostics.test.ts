import { describe, expect, it } from 'vitest'
import { buildDiagnosticsText, scrubDiagnostics } from './diagnostics'

const runtime = {
  appVersion: '1.0.0',
  electron: '38.0.0',
  chrome: '140.0.7339.0',
  platform: 'win32',
  osRelease: '10.0.22631'
}

describe('scrubDiagnostics', () => {
  it('redacts cookies, tokens, and SWID values', () => {
    const raw = [
      'espn_s2=super-secret-cookie',
      'SWID={11111111-1111-1111-1111-111111111111}',
      'token=abcdef0123456789',
      'Authorization: Bearer abc.def.ghi',
      'Cookie: espn_s2=again'
    ].join('\n')
    const scrubbed = scrubDiagnostics(raw)
    expect(scrubbed).not.toContain('super-secret-cookie')
    expect(scrubbed).not.toContain('11111111-1111-1111-1111-111111111111')
    expect(scrubbed).not.toContain('abcdef0123456789')
    expect(scrubbed).not.toContain('abc.def.ghi')
    expect(scrubbed).not.toContain('again')
    expect(scrubbed).toContain('[redacted]')
  })
})

describe('buildDiagnosticsText', () => {
  it('includes runtime versions and a scrubbed log, with no league name', () => {
    const text = buildDiagnosticsText(runtime, 'info overlay renderer gone reason=crashed\nespn_s2=leak')
    expect(text).toContain('Sideline: 1.0.0')
    expect(text).toContain('win32')
    expect(text).toContain('overlay renderer gone')
    expect(text).not.toContain('leak')
    expect(text).not.toContain('espn_s2=')
    expect(text).toContain('Do not include league names')
  })
})

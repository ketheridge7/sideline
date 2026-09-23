import { mkdtempSync, readFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { LOG_FILE_NAME, LOG_MAX_BYTES, appendLogFile, formatLogLine, readLogTail } from './logFile'

describe('formatLogLine', () => {
  it('keeps reason codes and scrubs secrets', () => {
    const line = formatLogLine(new Date('2026-09-23T12:00:00.000Z'), 'error', 'overlay renderer gone espn_s2=secret', {
      reason: 'crashed',
      exitCode: 1
    })
    expect(line).toContain('overlay renderer gone')
    expect(line).toContain('reason=crashed')
    expect(line).toContain('exitCode=1')
    expect(line).not.toContain('secret')
  })
})

describe('appendLogFile', () => {
  it('rotates once the log passes the size cap and the tail stays scrubbed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sideline-log-'))
    appendLogFile(dir, 'a'.repeat(LOG_MAX_BYTES))
    appendLogFile(dir, 'token=should-not-survive')
    expect(existsSync(join(dir, `${LOG_FILE_NAME}.1`))).toBe(true)
    const current = readFileSync(join(dir, LOG_FILE_NAME), 'utf8')
    expect(current).not.toContain('should-not-survive')
    expect(current).toContain('[redacted]')
    expect(readLogTail(dir, 200)).not.toContain('should-not-survive')
  })
})

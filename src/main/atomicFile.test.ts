import { mkdtempSync, readFileSync, existsSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { writeAtomicSync } from './atomicFile'

describe('writeAtomicSync', () => {
  it('replaces the target and leaves no temp file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sideline-atomic-'))
    const target = join(dir, 'sideline-settings.json')
    writeFileSync(target, '{"old":true}', 'utf8')
    writeAtomicSync(target, '{"ok":true}', { fsync: true })
    expect(readFileSync(target, 'utf8')).toBe('{"ok":true}')
    expect(existsSync(`${target}.tmp`)).toBe(false)
  })
})

import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const read = (path: string): string => readFileSync(path, 'utf8')

describe('P1-9 release gate', () => {
  it('runs typecheck and tests on pull requests and before Windows publish', () => {
    const ci = read('.github/workflows/ci.yml')
    const release = read('.github/workflows/release.yml')
    for (const workflow of [ci, release]) {
      expect(workflow).toContain('npm run typecheck')
      expect(workflow).toContain('npm test')
    }
    expect(ci).toContain('pull_request')
    expect(release).toContain('npm run build:win:publish')
    expect(release).toContain('stamp-staging-percentage.mjs')
    expect(release).toContain('SIDELINE_STAGING_PERCENTAGE')
    expect(release).toContain('Thursday through Monday')
  })
})

describe('P1-10 electron fuses', () => {
  it('enables cookie encryption and the other packaged-build fuses', () => {
    const config = read('electron-builder.yml')
    expect(config).toContain('asar: true')
    expect(config).toContain('enableCookieEncryption: true')
    expect(config).toContain('runAsNode: false')
    expect(config).toContain('enableNodeOptionsEnvironmentVariable: false')
    expect(config).toContain('enableNodeCliInspectArguments: false')
    expect(config).toContain('onlyLoadAppFromAsar: true')
    expect(config).toMatch(/one-way/i)
  })
})

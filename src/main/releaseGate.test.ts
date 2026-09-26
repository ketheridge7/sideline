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
    expect(release).toContain('gh release create "$tag" --title "$version" --draft --verify-tag')
    expect(release.indexOf('stamp-staging-percentage.mjs')).toBeLessThan(release.indexOf('gh release edit "$GITHUB_REF_NAME" --draft=false'))
    expect(release.indexOf('--draft=false')).toBeLessThan(release.indexOf('verify-release-assets.mjs'))
    const verify = read('scripts/verify-release-assets.mjs')
    expect(verify).toContain("['Sideline-Setup.exe', 'Sideline-Setup.exe.blockmap', 'latest.yml']")
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

describe('Windows installer filename', () => {
  it('publishes a versionless NSIS artifact so /releases/latest/download/Sideline-Setup.exe stays stable', () => {
    const config = read('electron-builder.yml')
    const nsis = config.slice(config.indexOf('\nnsis:'), config.indexOf('\nmac:'))
    expect(nsis).toContain('artifactName: Sideline-Setup.${ext}')
    expect(nsis).not.toContain('${name}-${version}-setup.${ext}')
  })
})

describe('GitHub publish', () => {
  it('uploads into a draft so the workflow can publish one release after latest.yml is stamped', () => {
    const config = read('electron-builder.yml')
    expect(config).toContain('releaseType: draft')
    expect(config).not.toContain('releaseType: release')
  })
})

import { describe, expect, it, vi } from 'vitest'
import { listReleases, REQUIRED_RELEASE_ASSETS, verifyPublishedRelease, verifyTaggedRelease } from '../../scripts/verify-release-assets.mjs'

const assets = (...names: string[]) => names.map((name, id) => ({ id, name }))

const release = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  tag_name: 'v1.0.0',
  draft: false,
  assets: assets(...REQUIRED_RELEASE_ASSETS),
  ...overrides
})

describe('verifyTaggedRelease', () => {
  it('accepts the one published release that has the Windows installer assets', () => {
    expect(verifyTaggedRelease([release(), release({ id: 2, tag_name: 'v0.9.0' })], 'v1.0.0').id).toBe(1)
  })

  it('fails when two releases share the tag', () => {
    expect(() => verifyTaggedRelease([release({ id: 11 }), release({ id: 12 })], 'v1.0.0')).toThrow(/exactly one/)
  })

  it('fails when the release is still a draft or missing an asset', () => {
    expect(() => verifyTaggedRelease([release({ draft: true })], 'v1.0.0')).toThrow(/draft/)
    expect(() => verifyTaggedRelease([release({ assets: assets('Sideline-Setup.exe.blockmap') })], 'v1.0.0')).toThrow(
      /Sideline-Setup.exe/
    )
  })
})

describe('listReleases', () => {
  it('follows pages until a short page', async () => {
    const pages = [
      Array.from({ length: 100 }, (_, id) => ({ id, tag_name: `v0.${id}` })),
      [release()]
    ]
    const fetchImpl = vi.fn(async (url: string) => {
      const page = Number(new URL(url).searchParams.get('page'))
      return new Response(JSON.stringify(pages[page - 1] ?? []), { status: 200 })
    })
    const releases = await listReleases({ token: 't', repository: 'ketheridge7/sideline', fetchImpl })
    expect(releases).toHaveLength(101)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})

describe('verifyPublishedRelease', () => {
  it('checks the live release list for this tag', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify([release()]), { status: 200 }))
    const result = await verifyPublishedRelease({
      token: 't',
      repository: 'ketheridge7/sideline',
      tag: 'v1.0.0',
      fetchImpl
    })
    expect(result.assets).toEqual(expect.arrayContaining([...REQUIRED_RELEASE_ASSETS]))
  })
})

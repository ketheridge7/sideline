import { describe, expect, it, vi } from 'vitest'
import { parseStagingPercentage, stampLatestYml, stampReleaseLatestYml } from '../../scripts/stamp-staging-percentage.mjs'

const sample = `version: 1.0.1
files:
  - url: sideline-1.0.1-setup.exe
    sha512: abc
    size: 10
path: sideline-1.0.1-setup.exe
sha512: abc
releaseDate: '2026-09-01T00:00:00.000Z'
`

describe('parseStagingPercentage', () => {
  it('treats an empty value as a full rollout', () => {
    expect(parseStagingPercentage(undefined)).toBeNull()
    expect(parseStagingPercentage('')).toBeNull()
    expect(parseStagingPercentage('  ')).toBeNull()
  })

  it('accepts 1 through 99', () => {
    expect(parseStagingPercentage('1')).toBe(1)
    expect(parseStagingPercentage('99')).toBe(99)
  })

  it('rejects 0, 100, and junk so a bad release variable fails the job', () => {
    expect(() => parseStagingPercentage('0')).toThrow(/1 to 99/)
    expect(() => parseStagingPercentage('100')).toThrow(/1 to 99/)
    expect(() => parseStagingPercentage('01')).toThrow(/1 to 99/)
    expect(() => parseStagingPercentage('10.5')).toThrow(/1 to 99/)
    expect(() => parseStagingPercentage('nope')).toThrow(/1 to 99/)
  })
})

describe('stampLatestYml', () => {
  it('appends the key electron-updater reads', () => {
    const next = stampLatestYml(sample, 25)
    expect(next).toContain("releaseDate: '2026-09-01T00:00:00.000Z'\n")
    expect(next.endsWith('stagingPercentage: 25\n')).toBe(true)
    expect(next.match(/stagingPercentage:/g)).toHaveLength(1)
  })

  it('replaces an existing percentage and keeps CRLF', () => {
    const crlf = `${sample.replace(/\n/g, '\r\n')}stagingPercentage: 10\r\n`
    const next = stampLatestYml(crlf, 40)
    expect(next.match(/stagingPercentage:/g)).toHaveLength(1)
    expect(next.endsWith('stagingPercentage: 40\r\n')).toBe(true)
    expect(next.replaceAll('\r\n', '')).not.toContain('\n')
  })
})

describe('stampReleaseLatestYml', () => {
  const release = {
    id: 9,
    assets: [{ id: 4, name: 'latest.yml', url: 'https://api.github.com/repos/o/r/releases/assets/4' }]
  }

  const jsonResponse = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  it('uploads latest.yml only when the percentage changes', async () => {
    const calls: string[] = []
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`)
      if (String(url).includes('/releases/tags/')) return jsonResponse(release)
      if (String(url).includes('/releases/assets/4') && (init?.method ?? 'GET') === 'GET') {
        return new Response(sample, { status: 200 })
      }
      if (init?.method === 'DELETE') return new Response(null, { status: 204 })
      if (String(url).includes('uploads.github.com')) {
        expect(init?.body).toContain('stagingPercentage: 15')
        return jsonResponse({ name: 'latest.yml' }, 201)
      }
      return new Response('missing', { status: 404 })
    })
    const result = await stampReleaseLatestYml({
      token: 'test-token',
      repository: 'ketheridge7/sideline',
      tag: 'v1.0.1',
      percentage: 15,
      fetchImpl
    })
    expect(result).toEqual({ updated: true, percentage: 15 })
    expect(calls.some((call) => call.startsWith('DELETE '))).toBe(true)
    expect(calls.some((call) => call.startsWith('POST https://uploads.github.com/'))).toBe(true)
  })

  it('leaves the release alone when latest.yml already has that percentage', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/releases/tags/')) return jsonResponse(release)
      if ((init?.method ?? 'GET') === 'GET') return new Response(`${sample}stagingPercentage: 15\n`, { status: 200 })
      throw new Error(`unexpected ${init?.method} ${url}`)
    })
    const result = await stampReleaseLatestYml({
      token: 'test-token',
      repository: 'ketheridge7/sideline',
      tag: 'v1.0.1',
      percentage: 15,
      fetchImpl
    })
    expect(result).toEqual({ updated: false, percentage: 15 })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})

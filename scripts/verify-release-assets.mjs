import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const REQUIRED_RELEASE_ASSETS = ['Sideline-Setup.exe', 'Sideline-Setup.exe.blockmap', 'latest.yml']

const githubHeaders = (token) => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'User-Agent': 'sideline-release-verify',
  'X-GitHub-Api-Version': '2022-11-28'
})

const readError = async (response) => (await response.text()).slice(0, 300)

export const releasesMatchingTag = (releases, tag) => releases.filter((release) => release?.tag_name === tag)

export const verifyTaggedRelease = (releases, tag, required = REQUIRED_RELEASE_ASSETS) => {
  if (!tag) throw new Error('RELEASE_TAG is required')
  const matches = releasesMatchingTag(releases, tag)
  if (matches.length !== 1) {
    const ids = matches.map((release) => release.id).join(', ') || 'none'
    throw new Error(`Expected exactly one GitHub release for ${tag}, found ${matches.length} (${ids})`)
  }
  const release = matches[0]
  if (release.draft) throw new Error(`Release ${tag} is still a draft`)
  const names = (release.assets ?? []).map((asset) => asset.name)
  const present = new Set(names)
  const missing = required.filter((name) => !present.has(name))
  if (missing.length > 0) {
    throw new Error(`Release ${tag} is missing ${missing.join(', ')} (has ${names.join(', ') || 'no assets'})`)
  }
  return { id: release.id, tag, assets: names }
}

export const listReleases = async ({ token, repository, fetchImpl = fetch }) => {
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) {
    throw new Error(`GITHUB_REPOSITORY must be owner/repo (got ${repository || 'unset'})`)
  }
  const releases = []
  for (let page = 1; page <= 20; page += 1) {
    const response = await fetchImpl(
      `https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`,
      { headers: githubHeaders(token) }
    )
    if (!response.ok) {
      throw new Error(`GitHub ${response.status} listing releases: ${await readError(response)}`)
    }
    const batch = await response.json()
    if (!Array.isArray(batch) || batch.length === 0) break
    releases.push(...batch)
    if (batch.length < 100) break
  }
  return releases
}

export const verifyPublishedRelease = async ({ token, repository, tag, fetchImpl = fetch }) => {
  const releases = await listReleases({ token, repository, fetchImpl })
  return verifyTaggedRelease(releases, tag)
}

const isDirectRun = () => {
  const entry = process.argv[1]
  if (!entry) return false
  return path.resolve(fileURLToPath(import.meta.url)) === path.resolve(entry)
}

const main = async () => {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  if (!token) throw new Error('GH_TOKEN is required to verify the release')
  const result = await verifyPublishedRelease({
    token,
    repository: process.env.GITHUB_REPOSITORY ?? '',
    tag: process.env.RELEASE_TAG ?? ''
  })
  console.log(`Release ${result.tag} (${result.id}) has ${REQUIRED_RELEASE_ASSETS.join(', ')}`)
}

if (isDirectRun()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}

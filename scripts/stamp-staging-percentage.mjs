import { fileURLToPath } from 'node:url'
import path from 'node:path'

/**
 * electron-updater reads top-level `stagingPercentage` (1-99) from latest.yml
 * and skips the update when this install falls outside that rollout.
 * Omit the key for a full rollout. 100 is not written: a present 100 still
 * excludes the one install whose stable hash compares equal to 1.
 */
export const parseStagingPercentage = (raw) => {
  if (raw == null) return null
  const text = String(raw).trim()
  if (text === '') return null
  if (!/^(?:[1-9]|[1-9][0-9])$/.test(text)) {
    throw new Error(
      `SIDELINE_STAGING_PERCENTAGE must be an integer from 1 to 99 (got ${text}). Leave it unset for a full rollout.`
    )
  }
  return Number(text)
}

export const stampLatestYml = (latestYml, percentage) => {
  if (!Number.isInteger(percentage) || percentage < 1 || percentage > 99) {
    throw new Error(`stagingPercentage must be an integer from 1 to 99, got ${String(percentage)}`)
  }
  const useCrlf = latestYml.includes('\r\n')
  const normalized = latestYml.replace(/\r\n/g, '\n')
  const line = `stagingPercentage: ${percentage}`
  const next = /^stagingPercentage:\s*.*$/m.test(normalized)
    ? normalized.replace(/^stagingPercentage:\s*.*$/m, line)
    : `${normalized.replace(/\s*$/, '')}\n${line}\n`
  return useCrlf ? next.replace(/\n/g, '\r\n') : next
}

const githubHeaders = (token, accept) => ({
  Accept: accept,
  Authorization: `Bearer ${token}`,
  'User-Agent': 'sideline-staging-stamp',
  'X-GitHub-Api-Version': '2022-11-28'
})

const readError = async (response) => {
  const body = await response.text()
  return body.slice(0, 300)
}

export const stampReleaseLatestYml = async ({ token, repository, tag, percentage, fetchImpl = fetch }) => {
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) {
    throw new Error(`GITHUB_REPOSITORY must be owner/repo (got ${repository || 'unset'})`)
  }
  if (!tag) throw new Error('RELEASE_TAG is required to stamp latest.yml')
  const releaseResponse = await fetchImpl(`https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`, {
    headers: githubHeaders(token, 'application/vnd.github+json')
  })
  if (!releaseResponse.ok) {
    throw new Error(`GitHub ${releaseResponse.status} reading release ${tag}: ${await readError(releaseResponse)}`)
  }
  const release = await releaseResponse.json()
  const asset = (release.assets ?? []).find((item) => item.name === 'latest.yml')
  if (!asset) throw new Error(`Release ${tag} has no latest.yml asset`)
  const download = await fetchImpl(asset.url, {
    headers: githubHeaders(token, 'application/octet-stream')
  })
  if (!download.ok) {
    throw new Error(`GitHub ${download.status} downloading latest.yml: ${await readError(download)}`)
  }
  const current = await download.text()
  const stamped = stampLatestYml(current, percentage)
  if (stamped === current) return { updated: false, percentage }
  const deleted = await fetchImpl(`https://api.github.com/repos/${repository}/releases/assets/${asset.id}`, {
    method: 'DELETE',
    headers: githubHeaders(token, 'application/vnd.github+json')
  })
  if (!deleted.ok) {
    throw new Error(`GitHub ${deleted.status} deleting latest.yml: ${await readError(deleted)}`)
  }
  const uploadUrl = `https://uploads.github.com/repos/${repository}/releases/${release.id}/assets?name=latest.yml`
  const uploaded = await fetchImpl(uploadUrl, {
    method: 'POST',
    headers: {
      ...githubHeaders(token, 'application/vnd.github+json'),
      'Content-Type': 'application/x-yaml'
    },
    body: stamped
  })
  if (!uploaded.ok) {
    throw new Error(`GitHub ${uploaded.status} uploading latest.yml: ${await readError(uploaded)}`)
  }
  return { updated: true, percentage }
}

const isDirectRun = () => {
  const entry = process.argv[1]
  if (!entry) return false
  return path.resolve(fileURLToPath(import.meta.url)) === path.resolve(entry)
}

const main = async () => {
  const percentage = parseStagingPercentage(process.env.SIDELINE_STAGING_PERCENTAGE)
  if (percentage == null) {
    console.log('SIDELINE_STAGING_PERCENTAGE unset; latest.yml stays a full rollout')
    return
  }
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  if (!token) throw new Error('GH_TOKEN is required to stamp latest.yml')
  const result = await stampReleaseLatestYml({
    token,
    repository: process.env.GITHUB_REPOSITORY ?? '',
    tag: process.env.RELEASE_TAG ?? '',
    percentage
  })
  console.log(
    result.updated
      ? `Wrote stagingPercentage: ${result.percentage} into latest.yml`
      : `latest.yml already has stagingPercentage: ${result.percentage}`
  )
}

if (isDirectRun()) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    const requested = (process.env.SIDELINE_STAGING_PERCENTAGE ?? '').trim() !== ''
    if (requested) {
      console.error(
        'The GitHub Release is already published. Until this step succeeds, latest.yml is a full rollout.'
      )
    }
    process.exit(1)
  })
}

import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { PLAYER_DUMP_FAIL_COOLDOWN_MS, sleeperPlayerDumpPlan } from '../pollTargets'
import { getPlayersNfl, type CachedPlayer } from './sleeperClient'

type PlayerCacheFile = {
  fetchedAt: number
  players: Record<string, CachedPlayer>
}

const DAY_MS = 24 * 60 * 60 * 1000

let memory: PlayerCacheFile | null = null
let inflight: Promise<Record<string, CachedPlayer>> | null = null
let lastFailAt: number | null = null

const cachePath = (): string => join(app.getPath('userData'), 'sleeper-players.json')

const trimPlayer = (raw: unknown): CachedPlayer | null => {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const name = typeof row.full_name === 'string' ? row.full_name : null
  if (!name) return null
  const position = typeof row.position === 'string' ? row.position : ''
  const nflTeam = typeof row.team === 'string' ? row.team : ''
  const status = typeof row.injury_status === 'string' ? row.injury_status : undefined
  return { name, position, nflTeam, status }
}

const readDisk = (): PlayerCacheFile | null => {
  try {
    const parsed = JSON.parse(readFileSync(cachePath(), 'utf8')) as PlayerCacheFile
    if (!parsed?.players || typeof parsed.fetchedAt !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export const peekPlayerDumpReady = (): boolean => memory != null

export const peekPlayerMap = (): Record<string, CachedPlayer> => memory?.players ?? {}

export const hydratePlayerMapFromDisk = (): Record<string, CachedPlayer> => {
  if (memory) return memory.players
  const disk = readDisk()
  if (disk) {
    memory = disk
    return disk.players
  }
  return {}
}

export const getPlayerMap = async (opts?: { liveTick?: boolean }): Promise<Record<string, CachedPlayer>> => {
  const peeked = opts?.liveTick ? peekPlayerMap() : hydratePlayerMapFromDisk()
  const plan = sleeperPlayerDumpPlan({
    peekedCount: memory != null ? 1 : 0,
    cacheFresh: Boolean(memory && Date.now() - memory.fetchedAt < DAY_MS),
    liveTick: Boolean(opts?.liveTick),
    inflight: inflight != null,
    lastFailAt,
    now: Date.now(),
    cooldownMs: PLAYER_DUMP_FAIL_COOLDOWN_MS
  })
  if (plan === 'peek' || plan === 'skip-cooldown') return peeked
  if (plan === 'join-inflight' && inflight) return inflight
  const run = async (): Promise<Record<string, CachedPlayer>> => {
    try {
      const raw = await getPlayersNfl()
      const players: Record<string, CachedPlayer> = {}
      for (const [id, value] of Object.entries(raw)) {
        const trimmed = trimPlayer(value)
        if (trimmed) players[id] = trimmed
      }
      memory = { fetchedAt: Date.now(), players }
      lastFailAt = null
      const dir = app.getPath('userData')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      void writeFile(cachePath(), JSON.stringify(memory), 'utf8').catch(() => undefined)
      return players
    } catch (error) {
      lastFailAt = Date.now()
      throw error
    } finally {
      inflight = null
    }
  }
  inflight = run()
  return inflight
}

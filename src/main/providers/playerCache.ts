import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getPlayersNfl, type CachedPlayer } from './sleeperClient'

type PlayerCacheFile = {
  fetchedAt: number
  players: Record<string, CachedPlayer>
}

const DAY_MS = 24 * 60 * 60 * 1000

let memory: PlayerCacheFile | null = null

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

export const getPlayerMap = async (): Promise<Record<string, CachedPlayer>> => {
  if (memory && Date.now() - memory.fetchedAt < DAY_MS) return memory.players
  const disk = readDisk()
  if (disk && Date.now() - disk.fetchedAt < DAY_MS) {
    memory = disk
    return disk.players
  }
  const raw = await getPlayersNfl()
  const players: Record<string, CachedPlayer> = {}
  for (const [id, value] of Object.entries(raw)) {
    const trimmed = trimPlayer(value)
    if (trimmed) players[id] = trimmed
  }
  memory = { fetchedAt: Date.now(), players }
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(cachePath(), JSON.stringify(memory), 'utf8')
  return players
}

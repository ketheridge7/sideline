import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { cacheFresh } from '../pollTargets'
import {
  getWeekProjections,
  toProjectionPtsMap,
  type SleeperPlayerProjection,
  type SleeperScoringKind
} from './sleeperClient'

export const SLEEPER_PROJECTION_TTL_MS = 10 * 60_000
export const SLEEPER_PROJECTION_DISK_TRUST_MS = 12 * 60 * 60_000

type ProjectionCacheFile = {
  fetchedAt: number
  season: string
  week: number
  seasonType: string
  players: Record<string, SleeperPlayerProjection>
}

let memory: ProjectionCacheFile | null = null
let inflight: Promise<{ pts: Record<string, number> | null; refreshed: boolean }> | null = null

const cachePath = (): string => join(app.getPath('userData'), 'sideline-sleeper-projections.json')

const cacheKey = (season: string, week: number, seasonType: string): string =>
  `${season}:${seasonType}:${week}`

const sameWeek = (row: ProjectionCacheFile, season: string, week: number, seasonType: string): boolean =>
  cacheKey(row.season, row.week, row.seasonType) === cacheKey(season, week, seasonType)

const readDisk = (): ProjectionCacheFile | null => {
  try {
    const parsed = JSON.parse(readFileSync(cachePath(), 'utf8')) as ProjectionCacheFile
    if (!parsed?.players || typeof parsed.fetchedAt !== 'number') return null
    if (!parsed.season || !Number.isInteger(parsed.week)) return null
    return parsed
  } catch {
    return null
  }
}

export const peekSleeperProjectionPts = (kind: SleeperScoringKind = 'ppr'): Record<string, number> | null => {
  if (!memory) return null
  const pts = toProjectionPtsMap(memory.players, kind)
  return Object.keys(pts).length > 0 ? pts : null
}

export const hydrateSleeperProjectionsFromDisk = (opts: {
  season: string
  week: number
  seasonType: string
}): Record<string, number> | null => {
  if (memory && sameWeek(memory, opts.season, opts.week, opts.seasonType)) {
    return peekSleeperProjectionPts()
  }
  const disk = readDisk()
  if (!disk || !sameWeek(disk, opts.season, opts.week, opts.seasonType)) return null
  if (!cacheFresh(disk.fetchedAt, Date.now(), SLEEPER_PROJECTION_DISK_TRUST_MS)) return null
  memory = disk
  return peekSleeperProjectionPts()
}

export const getSleeperProjectionPts = async (opts: {
  season: string
  week: number
  seasonType: string
  scoring?: SleeperScoringKind
}): Promise<{ pts: Record<string, number> | null; refreshed: boolean }> => {
  const scoring = opts.scoring ?? 'ppr'
  if (memory && sameWeek(memory, opts.season, opts.week, opts.seasonType)) {
    if (cacheFresh(memory.fetchedAt, Date.now(), SLEEPER_PROJECTION_TTL_MS)) {
      return { pts: peekSleeperProjectionPts(scoring), refreshed: false }
    }
  }
  if (inflight) return inflight
  const run = async (): Promise<{ pts: Record<string, number> | null; refreshed: boolean }> => {
    try {
      const players = await getWeekProjections(opts.season, opts.week, opts.seasonType, {
        timeoutMs: 10_000,
        retries: 0,
        priority: 'low'
      })
      memory = {
        fetchedAt: Date.now(),
        season: opts.season,
        week: opts.week,
        seasonType: opts.seasonType,
        players
      }
      const dir = app.getPath('userData')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      void writeFile(cachePath(), JSON.stringify(memory), 'utf8').catch(() => undefined)
      const pts = toProjectionPtsMap(players, scoring)
      return { pts: Object.keys(pts).length > 0 ? pts : null, refreshed: true }
    } finally {
      inflight = null
    }
  }
  inflight = run()
  return inflight
}

export const resetSleeperProjectionsCache = (): void => {
  memory = null
  inflight = null
}

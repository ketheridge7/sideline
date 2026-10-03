import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { cacheFresh } from '../pollTargets'
import {
  getWeekProjectionFile,
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
  /** Ids in the file with no pts column. Omitted on caches written before that was kept. */
  unprojected?: string[]
}

let memory: ProjectionCacheFile | null = null
let flight: {
  key: string
  gen: number
  promise: Promise<{ pts: Record<string, number> | null; refreshed: boolean }>
} | null = null
let flightGen = 0
let persistGen = 0
let persistChain: Promise<void> = Promise.resolve()

/** A later reset or save drops a save that has not started writing yet. */
const persist = (snapshot: ProjectionCacheFile): void => {
  const ticket = ++persistGen
  const body = JSON.stringify(snapshot)
  persistChain = persistChain
    .then(async () => {
      if (ticket !== persistGen) return
      const dir = app.getPath('userData')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      await writeFile(cachePath(), body, 'utf8')
    })
    .catch(() => undefined)
}

/** Resolves after any projection file write that already started. */
export const sleeperProjectionsSettled = (): Promise<void> => persistChain

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

let ptsCache: {
  players: Record<string, SleeperPlayerProjection>
  byKind: Map<SleeperScoringKind, Record<string, number> | null>
} | null = null

let unprojectedMemo: { ids: readonly string[] | undefined; set: ReadonlySet<string> } | null = null

const unprojectedSet = (ids: readonly string[] | undefined): ReadonlySet<string> => {
  if (unprojectedMemo && unprojectedMemo.ids === ids) return unprojectedMemo.set
  const set = new Set(ids ?? [])
  unprojectedMemo = { ids, set }
  return set
}

const ptsForKind = (
  players: Record<string, SleeperPlayerProjection>,
  kind: SleeperScoringKind
): Record<string, number> | null => {
  if (ptsCache?.players !== players) ptsCache = { players, byKind: new Map() }
  if (ptsCache.byKind.has(kind)) return ptsCache.byKind.get(kind) ?? null
  const pts = toProjectionPtsMap(players, kind)
  const out = Object.keys(pts).length > 0 ? pts : null
  ptsCache.byKind.set(kind, out)
  return out
}

/** Memoized per scoring kind until the weekly projection rows change. */
export const peekSleeperProjectionPts = (kind: SleeperScoringKind = 'ppr'): Record<string, number> | null => {
  if (!memory) return null
  return ptsForKind(memory.players, kind)
}

/**
 * Ids Sleeper listed this week with no fantasy-point column.
 * Null until a projection file is in memory. An older disk cache has no list,
 * so the set is empty until the next fetch.
 */
export const peekSleeperUnprojectedIds = (): ReadonlySet<string> | null => {
  if (!memory) return null
  return unprojectedSet(memory.unprojected)
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
  const key = cacheKey(opts.season, opts.week, opts.seasonType)
  if (flight?.key === key) return flight.promise
  const gen = ++flightGen
  const run = async (): Promise<{ pts: Record<string, number> | null; refreshed: boolean }> => {
    try {
      const file = await getWeekProjectionFile(opts.season, opts.week, opts.seasonType, {
        timeoutMs: 10_000,
        retries: 0,
        priority: 'low'
      })
      if (gen !== flightGen) return { pts: null, refreshed: false }
      memory = {
        fetchedAt: Date.now(),
        season: opts.season,
        week: opts.week,
        seasonType: opts.seasonType,
        players: file.players,
        unprojected: file.unprojected
      }
      persist(memory)
      return { pts: ptsForKind(file.players, scoring), refreshed: true }
    } finally {
      if (flight?.gen === gen) flight = null
    }
  }
  const promise = run()
  flight = { key, gen, promise }
  return promise
}

export const resetSleeperProjectionsCache = (): void => {
  memory = null
  flight = null
  flightGen += 1
  persistGen += 1
  ptsCache = null
  unprojectedMemo = null
}

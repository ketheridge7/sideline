import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { overlayLayoutDidMigrate } from '@shared/overlayLayout'
import { defaultSettings, hydrateSettings, type Settings } from '@shared/settings'
import { writeAtomicSync } from './atomicFile'
import { reportSettingsNotice, settingsFileNotice } from './notices'

let cache: Settings | null = null
let leagueRevision = 0

const LEAGUE_SETTING_KEYS = [
  'sleeperUsername',
  'sleeperUserId',
  'sleeperLeagueIds',
  'espnLeagueIds',
  'pinnedLeagueKeys',
  'selectedLeagueKey'
] as const satisfies readonly (keyof Settings)[]

const filePath = (): string => join(app.getPath('userData'), 'sideline-settings.json')

const sameJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left ?? null) === JSON.stringify(right ?? null)

const leagueSettingsChanged = (prev: Settings, next: Settings): boolean =>
  LEAGUE_SETTING_KEYS.some((key) => !sameJson(prev[key], next[key]))

const isEnoent = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'

const preserveCorruptSettings = (path: string): void => {
  const bak = `${path}.bak`
  try {
    if (existsSync(path)) copyFileSync(path, bak)
  } catch {
    // The original file stays in place. persist() tries the backup again before replacing it.
  }
}

const persist = (settings: Settings): void => {
  const path = filePath()
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const bak = `${path}.bak`
  if (settingsFileNotice() && existsSync(path) && !existsSync(bak)) {
    try {
      copyFileSync(path, bak)
    } catch {
      // Still write the new file. The unreadable bytes are only lost if this copy failed.
    }
  }
  writeAtomicSync(path, JSON.stringify(settings, null, 2), { fsync: true })
}

export const leagueSettingsRevision = (): number => leagueRevision

export const resetStoreForTests = (): void => {
  cache = null
  leagueRevision = 0
}

export const loadSettings = (): Settings => {
  if (cache) return cache
  const path = filePath()
  let parsed: Partial<Settings> | null = null
  try {
    const raw = readFileSync(path, 'utf8')
    const json: unknown = JSON.parse(raw)
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      throw new SyntaxError('settings json must be an object')
    }
    parsed = json as Partial<Settings>
    cache = hydrateSettings(parsed)
  } catch (error) {
    if (isEnoent(error)) {
      cache = defaultSettings()
      return cache
    }
    preserveCorruptSettings(path)
    reportSettingsNotice()
    cache = defaultSettings()
    return cache
  }
  if (parsed && overlayLayoutDidMigrate(parsed.overlayLayout)) {
    try {
      persist(cache)
    } catch {
      // Keep the parsed settings in memory if the migration write fails.
    }
  }
  return cache
}

export const saveSettings = (patch: Partial<Settings>): Settings => {
  const prev = loadSettings()
  const next = { ...prev, ...patch }
  if (leagueSettingsChanged(prev, next)) leagueRevision += 1
  cache = next
  persist(next)
  return next
}

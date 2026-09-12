import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { overlayLayoutDidMigrate } from '@shared/overlayLayout'
import { defaultSettings, hydrateSettings, type Settings } from '@shared/settings'

let cache: Settings | null = null

const filePath = (): string => join(app.getPath('userData'), 'sideline-settings.json')

const persist = (settings: Settings): void => {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(filePath(), JSON.stringify(settings, null, 2), 'utf8')
}

export const loadSettings = (): Settings => {
  if (cache) return cache
  try {
    const parsed = JSON.parse(readFileSync(filePath(), 'utf8')) as Partial<Settings>
    cache = hydrateSettings(parsed)
    if (overlayLayoutDidMigrate(parsed.overlayLayout)) persist(cache)
  } catch {
    cache = defaultSettings()
  }
  return cache
}

export const saveSettings = (patch: Partial<Settings>): Settings => {
  const next = { ...loadSettings(), ...patch }
  cache = next
  persist(next)
  return next
}

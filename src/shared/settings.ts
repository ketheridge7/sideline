import { DEFAULT_OVERLAY_PRESET, layoutFromPreset, parseOverlayLayout, type OverlayLayout } from './overlayLayout'
import {
  DEFAULT_SHORTCUTS,
  migrateLegacyLeagueShortcuts,
  parseShortcutMap,
  shortcutSettingsPatch,
  type ShortcutMap
} from './shortcuts'

export type Settings = {
  sleeperUsername: string | null
  sleeperUserId: string | null
  /** Null means legacy “all discovered”; [] means none selected. */
  sleeperLeagueIds: string[] | null
  espnLeagueIds: string[]
  pinnedLeagueKeys: string[]
  selectedLeagueKey: string | null
  overlayLayout: OverlayLayout
  overlayDisplayId: number | null
  overlayHotkey: string
  overlayEditHotkey: string
  overlayDisplayHotkey: string
  nextLeagueHotkey: string
  prevLeagueHotkey: string
  lanOverlayEnabled: boolean
  /** 16 lowercase hex chars. Null when LAN overlay is off. */
  lanOverlayToken: string | null
  /** Restored after a silent update relaunch. */
  overlayOpen: boolean
  companionBounds: CompanionBounds | null
}

export type CompanionBounds = { x: number; y: number; width: number; height: number }

const COMPANION_MIN_WIDTH = 1100
const COMPANION_MIN_HEIGHT = 700

export const parseCompanionBounds = (value: unknown): CompanionBounds | null => {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const x = row.x
  const y = row.y
  const width = row.width
  const height = row.height
  if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
    return null
  }
  if (![x, y, width, height].every((n) => Number.isFinite(n))) return null
  if (width < COMPANION_MIN_WIDTH || height < COMPANION_MIN_HEIGHT) return null
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }
}

export const companionBoundsOnScreen = (
  bounds: CompanionBounds,
  displays: ReadonlyArray<Pick<CompanionBounds, 'x' | 'y' | 'width' | 'height'>>
): boolean =>
  displays.some((display) => {
    const overlapW = Math.min(bounds.x + bounds.width, display.x + display.width) - Math.max(bounds.x, display.x)
    const overlapH = Math.min(bounds.y + bounds.height, display.y + display.height) - Math.max(bounds.y, display.y)
    return overlapW >= 80 && overlapH >= 80
  })

export const sessionPatchForRelaunch = (
  bounds: unknown,
  overlayOpen: boolean
): Pick<Settings, 'overlayOpen'> & Partial<Pick<Settings, 'companionBounds'>> => {
  const parsed = parseCompanionBounds(bounds)
  return parsed ? { overlayOpen, companionBounds: parsed } : { overlayOpen }
}

export type SettingsHotkeys = Pick<
  Settings,
  'overlayHotkey' | 'overlayEditHotkey' | 'overlayDisplayHotkey' | 'nextLeagueHotkey' | 'prevLeagueHotkey'
>

export const sanitizeLeagueIds = (ids: unknown): string[] => {
  if (!Array.isArray(ids)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of ids) {
    if (typeof value !== 'string' && typeof value !== 'number') continue
    const id = String(value).trim()
    if (!/^\d+$/.test(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export const defaultSettings = (): Settings => ({
  sleeperUsername: null,
  sleeperUserId: null,
  sleeperLeagueIds: null,
  espnLeagueIds: [],
  pinnedLeagueKeys: [],
  selectedLeagueKey: null,
  overlayLayout: layoutFromPreset(DEFAULT_OVERLAY_PRESET),
  overlayDisplayId: null,
  overlayHotkey: DEFAULT_SHORTCUTS.overlay,
  overlayEditHotkey: DEFAULT_SHORTCUTS.overlayEdit,
  overlayDisplayHotkey: DEFAULT_SHORTCUTS.overlayDisplay,
  nextLeagueHotkey: DEFAULT_SHORTCUTS.nextLeague,
  prevLeagueHotkey: DEFAULT_SHORTCUTS.prevLeague,
  lanOverlayEnabled: false,
  lanOverlayToken: null,
  overlayOpen: false,
  companionBounds: null
})

const shortcutsFromParsed = (parsed: Partial<Settings>): ShortcutMap =>
  parseShortcutMap(
    migrateLegacyLeagueShortcuts({
      overlay: parsed.overlayHotkey,
      overlayEdit: parsed.overlayEditHotkey,
      overlayDisplay: parsed.overlayDisplayHotkey,
      nextLeague: parsed.nextLeagueHotkey,
      prevLeague: parsed.prevLeagueHotkey
    }),
    DEFAULT_SHORTCUTS
  )

export const isLanOverlayToken = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{16}$/.test(value)

export const hydrateSettings = (parsed: Partial<Settings>): Settings => {
  const base = defaultSettings()
  const shortcuts = shortcutsFromParsed(parsed)
  return {
    ...base,
    ...parsed,
    sleeperUserId: typeof parsed.sleeperUserId === 'string' && parsed.sleeperUserId ? parsed.sleeperUserId : null,
    sleeperLeagueIds: Array.isArray(parsed.sleeperLeagueIds)
      ? sanitizeLeagueIds(parsed.sleeperLeagueIds)
      : null,
    espnLeagueIds: Array.isArray(parsed.espnLeagueIds) ? sanitizeLeagueIds(parsed.espnLeagueIds) : base.espnLeagueIds,
    overlayLayout: parseOverlayLayout(parsed.overlayLayout ?? base.overlayLayout),
    overlayDisplayId: typeof parsed.overlayDisplayId === 'number' ? parsed.overlayDisplayId : null,
    lanOverlayToken: isLanOverlayToken(parsed.lanOverlayToken) ? parsed.lanOverlayToken : null,
    overlayOpen: parsed.overlayOpen === true,
    companionBounds: parseCompanionBounds(parsed.companionBounds),
    ...shortcutSettingsPatch(shortcuts)
  }
}

export const settingsHotkeys = (settings: SettingsHotkeys): SettingsHotkeys => ({
  overlayHotkey: settings.overlayHotkey,
  overlayEditHotkey: settings.overlayEditHotkey,
  overlayDisplayHotkey: settings.overlayDisplayHotkey,
  nextLeagueHotkey: settings.nextLeagueHotkey,
  prevLeagueHotkey: settings.prevLeagueHotkey
})

/**
 * Accelerators to paint when a poll finishes.
 * `kickoff` is the settings object copied when that refresh started. Publishing
 * it puts a rebind that landed mid-poll back on the previous combo. `latest` wins.
 */
export const hotkeysAtPublish = (_kickoff: SettingsHotkeys, latest: SettingsHotkeys): SettingsHotkeys =>
  settingsHotkeys(latest)

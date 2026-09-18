import { DEFAULT_OVERLAY_PRESET, layoutFromPreset, parseOverlayLayout, type OverlayLayout } from './overlayLayout'
import {
  DEFAULT_SHORTCUTS,
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
  lanOverlayEnabled: false
})

const shortcutsFromParsed = (parsed: Partial<Settings>): ShortcutMap =>
  parseShortcutMap(
    {
      overlay: parsed.overlayHotkey,
      overlayEdit: parsed.overlayEditHotkey,
      overlayDisplay: parsed.overlayDisplayHotkey,
      nextLeague: parsed.nextLeagueHotkey,
      prevLeague: parsed.prevLeagueHotkey
    },
    DEFAULT_SHORTCUTS
  )

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

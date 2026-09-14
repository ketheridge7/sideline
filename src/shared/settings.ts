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

export const defaultSettings = (): Settings => ({
  sleeperUsername: null,
  sleeperUserId: null,
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

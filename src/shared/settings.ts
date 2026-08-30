import { layoutFromPreset, parseOverlayLayout, type OverlayLayout } from './overlayLayout'

export type Settings = {
  sleeperUsername: string | null
  espnLeagueIds: string[]
  pinnedLeagueKeys: string[]
  selectedLeagueKey: string | null
  overlayLayout: OverlayLayout
  overlayDisplayId: number | null
  overlayHotkey: string
  overlayEditHotkey: string
  lanOverlayEnabled: boolean
}

export const defaultSettings = (): Settings => ({
  sleeperUsername: null,
  espnLeagueIds: [],
  pinnedLeagueKeys: [],
  selectedLeagueKey: null,
  overlayLayout: layoutFromPreset('broadcast-l'),
  overlayDisplayId: null,
  overlayHotkey: 'CommandOrControl+Shift+O',
  overlayEditHotkey: 'CommandOrControl+Shift+E',
  lanOverlayEnabled: false
})

export const hydrateSettings = (parsed: Partial<Settings>): Settings => {
  const base = defaultSettings()
  return {
    ...base,
    ...parsed,
    overlayLayout: parseOverlayLayout(parsed.overlayLayout ?? base.overlayLayout),
    overlayDisplayId: typeof parsed.overlayDisplayId === 'number' ? parsed.overlayDisplayId : null
  }
}

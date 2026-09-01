import { layoutFromPreset, parseOverlayLayout, type OverlayLayout } from './overlayLayout'

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
  lanOverlayEnabled: boolean
}

export const defaultSettings = (): Settings => ({
  sleeperUsername: null,
  sleeperUserId: null,
  espnLeagueIds: [],
  pinnedLeagueKeys: [],
  selectedLeagueKey: null,
  overlayLayout: layoutFromPreset('redzone'),
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
    sleeperUserId: typeof parsed.sleeperUserId === 'string' && parsed.sleeperUserId ? parsed.sleeperUserId : null,
    overlayLayout: parseOverlayLayout(parsed.overlayLayout ?? base.overlayLayout),
    overlayDisplayId: typeof parsed.overlayDisplayId === 'number' ? parsed.overlayDisplayId : null
  }
}

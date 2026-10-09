/**
 * Google TV and the LAN overlay are shelved. The Android project, pairing,
 * and access checks stay in the tree. Flip this to true to restore the Wi-Fi
 * toggle and the all-interfaces bind.
 */
export const TV_OVERLAY_ENABLED = false

/** LAN may be on only while the shelved TV overlay is enabled. */
export const lanOverlayRequested = (requested: boolean): boolean => TV_OVERLAY_ENABLED && requested

export const bindHostForOverlay = (tvOverlayEnabled: boolean, lanEnabled: boolean): string =>
  tvOverlayEnabled && lanEnabled ? '0.0.0.0' : '127.0.0.1'

type LanSettings = {
  lanOverlayEnabled: boolean
  lanOverlayToken: string | null
}

/** Force a previously enabled Wi-Fi toggle off so a later flag flip cannot reopen the LAN. */
export const shelfLanSettings = <T extends LanSettings>(settings: T, enabled: boolean = TV_OVERLAY_ENABLED): T => {
  if (enabled) return settings
  if (!settings.lanOverlayEnabled && settings.lanOverlayToken == null) return settings
  return { ...settings, lanOverlayEnabled: false, lanOverlayToken: null }
}

/** True when a settings file still has LAN on or a token while the overlay is shelved. */
export const settingsHadShelvedLan = (raw: unknown, enabled: boolean = TV_OVERLAY_ENABLED): boolean => {
  if (enabled) return false
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const parsed = raw as { lanOverlayEnabled?: unknown; lanOverlayToken?: unknown }
  return parsed.lanOverlayEnabled === true || parsed.lanOverlayToken != null
}

import type { OverlayLayout } from '@shared/overlayLayout'
import type { ShortcutAction } from '@shared/shortcuts'
import type { AppState, CompanionBoardsPatch, CompanionHudPatch, CompanionTick, OverlayHudState, ToastPayload } from '@shared/types'

export type SidelineApi = {
  getState: () => Promise<AppState>
  onState: (cb: (state: AppState) => void) => () => void
  onTick: (cb: (tick: CompanionTick) => void) => () => void
  onBoards: (cb: (patch: CompanionBoardsPatch) => void) => () => void
  onLive: (cb: (patch: CompanionHudPatch) => void) => () => void
  onHud: (cb: (hud: OverlayHudState) => void) => () => void
  onToast: (cb: (toast: ToastPayload) => void) => () => void
  connectSleeper: (username: string) => Promise<{ ok: boolean; error?: string }>
  disconnectSleeper: () => Promise<void>
  signInEspn: () => Promise<{ ok: boolean; error?: string }>
  disconnectEspn: () => Promise<void>
  addEspnLeague: (leagueId: string) => Promise<{ ok: boolean; error?: string }>
  removeEspnLeague: (leagueId: string) => Promise<void>
  setPinned: (keys: string[]) => Promise<void>
  selectLeague: (key: string | null) => Promise<void>
  toggleOverlay: () => Promise<void>
  setOverlayEditMode: (edit: boolean) => Promise<void>
  setOverlayLayout: (layout: OverlayLayout) => Promise<void>
  setOverlayDisplay: (id: number | null) => Promise<void>
  cycleOverlayDisplay: () => Promise<void>
  cycleLeague: (delta: number) => Promise<void>
  setShortcut: (action: ShortcutAction, accelerator: string) => Promise<{ ok: boolean; error?: string }>
  resetShortcut: (action: ShortcutAction) => Promise<{ ok: boolean; error?: string }>
  setShortcutCapture: (active: boolean) => Promise<void>
  setLanOverlay: (enabled: boolean) => Promise<void>
  showCompanion: () => Promise<void>
}

declare global {
  interface Window {
    sideline?: SidelineApi
  }
}

export {}

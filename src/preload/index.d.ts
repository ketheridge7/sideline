import type { OverlayLayout } from '@shared/overlayLayout'
import type { AppState, ToastPayload } from '@shared/types'

export type SidelineApi = {
  getState: () => Promise<AppState>
  onState: (cb: (state: AppState) => void) => () => void
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
  setLanOverlay: (enabled: boolean) => Promise<void>
  showCompanion: () => Promise<void>
}

declare global {
  interface Window {
    sideline?: SidelineApi
  }
}

export {}

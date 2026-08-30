import type { BrowserWindow } from 'electron'
import type { AppState, OverlayHudState, ToastPayload } from '@shared/types'

let companion: BrowserWindow | null = null
let overlay: BrowserWindow | null = null
let overlayPort = 7333
let publishHud: ((hud: OverlayHudState) => void) | null = null
let quitting = false

export const runtime = {
  isQuitting: () => quitting,
  setQuitting: (value: boolean) => {
    quitting = value
  },
  companion: () => companion,
  setCompanion: (win: BrowserWindow | null) => {
    companion = win
  },
  overlay: () => overlay,
  setOverlay: (win: BrowserWindow | null) => {
    overlay = win
  },
  overlayPort: () => overlayPort,
  setOverlayPort: (port: number) => {
    overlayPort = port
  },
  setPublishHud: (fn: (hud: OverlayHudState) => void) => {
    publishHud = fn
  },
  pushHud: (hud: OverlayHudState) => {
    publishHud?.(hud)
  },
  sendState: (state: AppState) => {
    if (!companion?.isDestroyed()) companion?.webContents.send('sideline:state', state)
    if (!overlay?.isDestroyed()) overlay?.webContents.send('sideline:state', state)
  },
  sendToast: (toast: ToastPayload) => {
    if (!companion?.isDestroyed()) companion?.webContents.send('sideline:toast', toast)
  }
}

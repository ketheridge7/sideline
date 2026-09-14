import type { BrowserWindow } from 'electron'
import type { AppState, CompanionBoardsPatch, CompanionHudPatch, CompanionTick, OverlayHudState, ToastPayload } from '@shared/types'
import type { UpdateSnapshot } from '@shared/updater'

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
    if (!overlay?.isDestroyed()) overlay?.webContents.send('sideline:hud', hud)
  },
  sendState: (state: AppState) => {
    if (!companion?.isDestroyed()) companion?.webContents.send('sideline:state', state)
  },
  sendTick: (tick: CompanionTick) => {
    if (!companion?.isDestroyed()) companion?.webContents.send('sideline:tick', tick)
  },
  sendBoards: (patch: CompanionBoardsPatch) => {
    if (!companion?.isDestroyed()) companion?.webContents.send('sideline:boards', patch)
  },
  sendLive: (patch: CompanionHudPatch) => {
    if (!companion?.isDestroyed()) companion?.webContents.send('sideline:live', patch)
  },
  sendToast: (toast: ToastPayload) => {
    if (!companion?.isDestroyed()) companion?.webContents.send('sideline:toast', toast)
  },
  sendUpdate: (snapshot: UpdateSnapshot) => {
    if (!companion?.isDestroyed()) companion?.webContents.send('sideline:update', snapshot)
  }
}

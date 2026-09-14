import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { nextOverlayDisplayId } from '@shared/shortcuts'
import { loadSettings, saveSettings } from '../store'
import { setOverlayEditMode as setPollerEditMode } from '../poller'
import { runtime } from '../runtime'
import { loadRenderer } from './load'

let editMode = false

export const applyOverlayChrome = (win: BrowserWindow): void => {
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.setFullScreenable(false)
}

const overlayDisplay = (): Electron.Display => {
  const id = loadSettings().overlayDisplayId
  const displays = screen.getAllDisplays()
  return displays.find((row) => row.id === id) ?? screen.getPrimaryDisplay()
}

export const applyOverlayBounds = (win: BrowserWindow): void => {
  win.setBounds(overlayDisplay().bounds)
}

export const applyOverlayInput = (win: BrowserWindow): void => {
  if (editMode) {
    win.setIgnoreMouseEvents(false)
    return
  }
  win.setIgnoreMouseEvents(true, { forward: true })
}

export const overlayEditMode = (): boolean => editMode

export const setOverlayEditMode = (next: boolean): boolean => {
  editMode = next
  const win = runtime.overlay()
  if (win && !win.isDestroyed() && win.isVisible()) applyOverlayInput(win)
  setPollerEditMode(editMode)
  return editMode
}

export const createOverlayWindow = (): BrowserWindow => {
  const existing = runtime.overlay()
  if (existing && !existing.isDestroyed()) return existing

  const isMac = process.platform === 'darwin'
  const bounds = overlayDisplay().bounds

  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    show: false,
    ...(isMac ? { type: 'panel' as const } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  applyOverlayChrome(win)
  applyOverlayBounds(win)
  win.on('closed', () => {
    editMode = false
    runtime.setOverlay(null)
  })

  loadRenderer(win, 'overlay')
  runtime.setOverlay(win)
  return win
}

export const toggleOverlay = (): boolean => {
  const win = createOverlayWindow()
  applyOverlayChrome(win)
  applyOverlayBounds(win)
  if (win.isVisible()) {
    setOverlayEditMode(false)
    win.hide()
    return false
  }
  win.showInactive()
  applyOverlayInput(win)
  return true
}

export const setOverlayDisplayId = (id: number | null): void => {
  saveSettings({ overlayDisplayId: id })
  const win = runtime.overlay()
  if (win && !win.isDestroyed()) applyOverlayBounds(win)
}

export const cycleOverlayDisplay = (): { cycled: boolean; count: number } => {
  const displays = screen.getAllDisplays()
  const result = nextOverlayDisplayId(
    loadSettings().overlayDisplayId,
    displays.map((row) => row.id),
    screen.getPrimaryDisplay().id
  )
  if (!result.cycled) return { cycled: false, count: displays.length }
  setOverlayDisplayId(result.id)
  return { cycled: true, count: displays.length }
}

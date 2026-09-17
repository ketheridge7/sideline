import type { BrowserWindow } from 'electron'
import broadcastPng from '../../build/broadcast-s.png?asset'

/**
 * Invisible native caption. A truly empty string can fall back to "Electron"
 * on Windows, so the TopBar wordmark stays the only visible product name.
 */
export const NATIVE_WINDOW_TITLE = '\u200b'

export const COMPANION_TITLEBAR_OVERLAY = {
  color: '#07080A',
  symbolColor: '#F4F7F2',
  height: 52
} as const

/** Running window / tray mark. Installer ICO remains packaging stripe until regen. */
export const packagingWindowIconPath = (): string => broadcastPng

export const bindEmptyNativeTitle = (win: BrowserWindow): void => {
  win.setTitle(NATIVE_WINDOW_TITLE)
  win.on('page-title-updated', (event) => {
    event.preventDefault()
  })
}

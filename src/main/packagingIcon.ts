import type { BrowserWindow } from 'electron'
import iconIco from '../../build/icon.ico?asset'
import iconPng from '../../build/icon.png?asset'

/**
 * Invisible native caption. A truly empty string can fall back to "Electron"
 * on Windows, so the TopBar wordmark stays the only visible product name.
 */
export const NATIVE_WINDOW_TITLE = '\u200b'

export const packagingWindowIconPath = (platform: NodeJS.Platform = process.platform): string =>
  platform === 'win32' ? iconIco : iconPng

export const bindEmptyNativeTitle = (win: BrowserWindow): void => {
  win.setTitle(NATIVE_WINDOW_TITLE)
  win.on('page-title-updated', (event) => {
    event.preventDefault()
  })
}

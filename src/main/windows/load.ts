import { BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'
import { captureRequested } from '../demoMode'

export const loadRenderer = (win: BrowserWindow, page: 'companion' | 'overlay'): void => {
  const search = captureRequested(process.env) ? 'capture=1' : ''
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/${page}/index.html${search ? `?${search}` : ''}`)
    return
  }
  win.loadFile(join(__dirname, `../renderer/${page}/index.html`), search ? { search } : undefined)
}

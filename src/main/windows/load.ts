import { BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'

export const loadRenderer = (win: BrowserWindow, page: 'companion' | 'overlay'): void => {
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/${page}/index.html`)
    return
  }
  win.loadFile(join(__dirname, `../renderer/${page}/index.html`))
}

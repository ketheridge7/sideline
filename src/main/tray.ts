import { app, Menu, nativeImage, Tray } from 'electron'
import { setOverlayVisible } from './poller'
import { runtime } from './runtime'
import { createCompanionWindow } from './windows/companion'
import { toggleOverlay } from './windows/overlay'

const ICON_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==',
  'base64'
)

let tray: Tray | null = null

export const createTray = (): Tray => {
  if (tray) return tray
  tray = new Tray(nativeImage.createFromBuffer(ICON_PNG).resize({ width: 16, height: 16 }))
  tray.setToolTip('Sideline')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Show companion',
        click: () => {
          createCompanionWindow().show()
        }
      },
      {
        label: 'Toggle overlay',
        click: () => {
          setOverlayVisible(toggleOverlay())
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          runtime.setQuitting(true)
          app.quit()
        }
      }
    ])
  )
  tray.on('click', () => {
    createCompanionWindow().show()
  })
  return tray
}

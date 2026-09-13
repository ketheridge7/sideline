import { app, Menu, nativeImage, Tray } from 'electron'
import { setOverlayVisible } from './poller'
import { runtime } from './runtime'
import { createCompanionWindow } from './windows/companion'
import { toggleOverlay } from './windows/overlay'

const ICON_PNG = Buffer.from(
  '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',
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

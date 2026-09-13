import { app, Menu, nativeImage, Tray } from 'electron'
import { setOverlayVisible } from './poller'
import { runtime } from './runtime'
import { createCompanionWindow } from './windows/companion'
import { toggleOverlay } from './windows/overlay'

const ICON_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAACqUlEQVR4nO2X70tTURjHv26TTQap00ZC4jYypaK3JZaFkxBnKVqY003S1qv+gcRK+omZm80gf7DhRAplNU3TzAipzAItI8j5wvlim4bpEhEmbHe3V4brrLsu3BnEHrhvvt/nec6Hc+4959yYhwudNLbExYO12M7gbetoUYD/BiAn5wjsX6ex8t39x6fZ0IjYWEHYXuEzfovMzAx0d5khFosZ8zSVani9XlyqvcKYx3oG6q/WhR18My7oapCRsZc7gCSJBMrc44TucMxjcHAINE0T3tmyM9wByBUy8Hhkyani06g6p0OnpZuwOJ2BuLg4QqMoCsvLywAA++ws4Ut3JjP2ZPUSLi5+IzQ+nw+tpgImswVjY69x/cbtIN/hmOcOYG7OAafThdTU3UH6rZvX4PdTsHR1o/nefTYt2S0BTdNo7zARukAggL6pAS1GPUQiUeQAAKCt3YTJyY8hPXV5GUaeD0CWlhY5AIqioK6owsyMPaR/YP8+jL54hqzDhyIDAAArHg/yC4owPDwS0pdIEvHY+gjZ2VmRAQCA9fV1VGqrUXe5Hj6fn/CFQiHMpjZIJImRAdiMB60dKCgsgtu9QHjJSUnQna9mrGf1GQqFQpSWFIPP5//SfH4fenqsyDuhwtCgDXK5LKgmT5mLhjtN3AAoFHK0GPWE/nL0FZaWlqA3GAk/JWUXY09WS7C2thZST0/fAwBISIgnvI2NDcaerLdir9dLnAlmUyvevH0HVUE+UWO3k+fD1mA1A4FAAE9s/YQulUpRWlIcche09T3lDgAAGu8asOLx/FXuxPsP3AM4nS6Uq7VwudyMeePjE9BW1SAQCDDmsb4TAsDU1CccPaaEplKNk4UqyBUyxO+Ix+rqD0x//oLeXiv6+gfCDg4AMdFfsyjAvwb4CTkY6w1/E4A1AAAAAElFTkSuQmCC',
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

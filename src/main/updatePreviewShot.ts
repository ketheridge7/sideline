import { app, type BrowserWindow } from 'electron'
import { writeFileSync } from 'fs'

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const capture = async (win: BrowserWindow, file: string): Promise<void> => {
  const preview = process.env.SIDELINE_UPDATE_PREVIEW
  if (preview === 'ready' || preview === 'downloading' || preview === 'checking' || preview === 'current' || preview === 'error') {
    await win.webContents.executeJavaScript(
      `document.querySelector('[data-connect-updates]')?.scrollIntoView({block:'center'})`
    )
    await sleep(200)
  }
  const image = await win.webContents.capturePage()
  writeFileSync(file, image.toPNG())
  app.exit(0)
}

/** Dev-only. SIDELINE_UPDATE_SHOT=/path.png plus SIDELINE_UPDATE_PREVIEW writes a companion frame and exits. */
export const armUpdatePreviewShot = (getWindow: () => BrowserWindow | null): void => {
  if (app.isPackaged) return
  const file = process.env.SIDELINE_UPDATE_SHOT
  if (!file) return
  const started = Date.now()
  const tick = (): void => {
    const win = getWindow()
    if (!win || win.isDestroyed() || win.webContents.isLoading()) {
      if (Date.now() - started > 90_000) {
        console.error('[sideline] update preview shot: companion window did not paint')
        app.exit(1)
        return
      }
      setTimeout(tick, 250)
      return
    }
    setTimeout(() => {
      void capture(win, file).catch((error: unknown) => {
        console.error('[sideline] update preview shot failed', error)
        app.exit(1)
      })
    }, 600)
  }
  setTimeout(tick, 400)
}

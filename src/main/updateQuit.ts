export type QuitWindow = {
  removeAllListeners: (event: string) => void
}

export const windowClosePlan = (quitting: boolean, quittingForUpdate: boolean): 'close' | 'hide' =>
  quitting || quittingForUpdate ? 'close' : 'hide'

export const handleBeforeQuit = (deps: {
  quittingForUpdate: boolean
  setQuitting: () => void
  persistSession: () => void
  destroyTray: () => void
  shutdownOverlayServer: () => void
  releaseSingleInstanceLock: () => void
  releasePowerSave: () => void
  unregisterShortcuts: () => void
  windows: QuitWindow[]
}): void => {
  deps.setQuitting()
  deps.persistSession()
  deps.destroyTray()
  deps.shutdownOverlayServer()
  deps.releaseSingleInstanceLock()
  deps.releasePowerSave()
  deps.unregisterShortcuts()
  if (!deps.quittingForUpdate) return
  for (const win of deps.windows) win.removeAllListeners('close')
}

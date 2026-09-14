import { ipcMain } from 'electron'
import { applyOverlayLayout, applyLanOverlay, addEspnLeagueId, connectSleeper, currentState, disconnectSleeper, invalidateEspnSession, markEspnRelogin, primeEspnCookies, refresh, removeEspnLeagueId, setOverlayVisible } from './poller'
import { runtime } from './runtime'
import { setOverlayLanEnabled } from './server'
import { parseOverlayLayout } from '@shared/overlayLayout'
import { saveSettings } from './store'
import { applyShortcut, cycleHudDisplay, cycleLeague, resetShortcut, setShortcutCapture } from './shortcuts'
import { createCompanionWindow } from './windows/companion'
import { clearEspnCookies, openEspnLogin } from './windows/espnLogin'
import { checkForUpdates, getUpdateStatus, installUpdate } from './updater'
import { setOverlayDisplayId, setOverlayEditMode, toggleOverlay } from './windows/overlay'

export const registerIpc = (): void => {
  ipcMain.handle('sideline:getState', () => currentState())
  ipcMain.handle('sideline:connectSleeper', (_event, username: string) => connectSleeper(username))
  ipcMain.handle('sideline:disconnectSleeper', () => disconnectSleeper())
  ipcMain.handle('sideline:signInEspn', async () => {
    const result = await openEspnLogin()
    // Login always clears persist:espn first, so drop the in-memory session
    // whether the window finished or the user closed it.
    invalidateEspnSession()
    if (result.ok) {
      const cookies = await primeEspnCookies()
      if (!cookies) markEspnRelogin(true)
    } else {
      markEspnRelogin(true)
    }
    await refresh({ waitForBoards: true })
    return result
  })
  ipcMain.handle('sideline:disconnectEspn', async () => {
    await clearEspnCookies()
    invalidateEspnSession()
    saveSettings({ espnLeagueIds: [] })
    markEspnRelogin(false)
    await refresh({ waitForBoards: true })
  })
  ipcMain.handle('sideline:addEspnLeague', (_event, leagueId: string) => addEspnLeagueId(leagueId))
  ipcMain.handle('sideline:removeEspnLeague', (_event, leagueId: string) => removeEspnLeagueId(leagueId))
  ipcMain.handle('sideline:setPinned', async (_event, keys: string[]) => {
    saveSettings({ pinnedLeagueKeys: keys })
    await refresh({ waitForBoards: true })
  })
  ipcMain.handle('sideline:selectLeague', async (_event, key: string | null) => {
    saveSettings({ selectedLeagueKey: key })
    await refresh()
  })
  ipcMain.handle('sideline:toggleOverlay', () => {
    const visible = toggleOverlay()
    setOverlayVisible(visible)
  })
  ipcMain.handle('sideline:setOverlayEditMode', (_event, edit: boolean) => {
    setOverlayEditMode(Boolean(edit))
  })
  ipcMain.handle('sideline:setOverlayLayout', (_event, layout: unknown) => {
    applyOverlayLayout(parseOverlayLayout(layout))
  })
  ipcMain.handle('sideline:setOverlayDisplay', (_event, id: number | null) => {
    setOverlayDisplayId(id)
  })
  ipcMain.handle('sideline:cycleOverlayDisplay', () => {
    cycleHudDisplay()
  })
  ipcMain.handle('sideline:cycleLeague', (_event, delta: number) =>
    cycleLeague(Number(delta) < 0 ? -1 : 1)
  )
  ipcMain.handle('sideline:setShortcut', (_event, action: unknown, accelerator: unknown) =>
    applyShortcut(action, accelerator)
  )
  ipcMain.handle('sideline:resetShortcut', (_event, action: unknown) => resetShortcut(action))
  ipcMain.handle('sideline:setShortcutCapture', (_event, active: boolean) => {
    setShortcutCapture(Boolean(active))
  })
  ipcMain.handle('sideline:setLanOverlay', async (_event, enabled: boolean) => {
    saveSettings({ lanOverlayEnabled: Boolean(enabled) })
    const port = await setOverlayLanEnabled(Boolean(enabled))
    runtime.setOverlayPort(port)
    applyLanOverlay()
  })
  ipcMain.handle('sideline:showCompanion', () => {
    createCompanionWindow().show()
  })
  ipcMain.handle('sideline:getUpdateStatus', () => getUpdateStatus())
  ipcMain.handle('sideline:checkForUpdates', () => checkForUpdates(true))
  ipcMain.handle('sideline:installUpdate', () => installUpdate())
}

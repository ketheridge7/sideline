import { ipcMain } from 'electron'
import { applyOverlayLayout, applyLanOverlay, addEspnLeagueId, connectSleeper, currentState, disconnectSleeper, markEspnRelogin, refresh, removeEspnLeagueId, setOverlayVisible } from './poller'
import { runtime } from './runtime'
import { setOverlayLanEnabled } from './server'
import { parseOverlayLayout } from '@shared/overlayLayout'
import { saveSettings } from './store'
import { createCompanionWindow } from './windows/companion'
import { clearEspnCookies, openEspnLogin } from './windows/espnLogin'
import { setOverlayDisplayId, setOverlayEditMode, toggleOverlay } from './windows/overlay'

export const registerIpc = (): void => {
  ipcMain.handle('sideline:getState', () => currentState())
  ipcMain.handle('sideline:connectSleeper', (_event, username: string) => connectSleeper(username))
  ipcMain.handle('sideline:disconnectSleeper', () => disconnectSleeper())
  ipcMain.handle('sideline:signInEspn', async () => {
    const result = await openEspnLogin()
    if (result.ok) markEspnRelogin(false)
    await refresh()
    return result
  })
  ipcMain.handle('sideline:disconnectEspn', async () => {
    await clearEspnCookies()
    saveSettings({ espnLeagueIds: [] })
    markEspnRelogin(false)
    await refresh()
  })
  ipcMain.handle('sideline:addEspnLeague', (_event, leagueId: string) => addEspnLeagueId(leagueId))
  ipcMain.handle('sideline:removeEspnLeague', (_event, leagueId: string) => removeEspnLeagueId(leagueId))
  ipcMain.handle('sideline:setPinned', async (_event, keys: string[]) => {
    saveSettings({ pinnedLeagueKeys: keys })
    await refresh()
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
  ipcMain.handle('sideline:setLanOverlay', async (_event, enabled: boolean) => {
    saveSettings({ lanOverlayEnabled: Boolean(enabled) })
    const port = await setOverlayLanEnabled(Boolean(enabled))
    runtime.setOverlayPort(port)
    applyLanOverlay()
  })
  ipcMain.handle('sideline:showCompanion', () => {
    createCompanionWindow().show()
  })
}

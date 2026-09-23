import { app, ipcMain } from 'electron'
import { applyOverlayLayout, applyLanOverlay, addEspnLeagueId, connectSleeper, currentState, disconnectSleeper, invalidateEspnSession, listDiscoverableLeagues, markEspnRelogin, primeEspnCookies, refresh, removeEspnLeagueId, removeSleeperLeagueId, setOverlayVisible, setSelectedLeagueIds } from './poller'
import { runtime } from './runtime'
import { setOverlayLanEnabled } from './server'
import { parseOverlayLayout } from '@shared/overlayLayout'
import { parseLeagueKey, parseProvider } from '@shared/types'
import { collectBugReportRuntime, openExternalUrl } from './bugReport'
import { DEMO_LOCKED_MESSAGE, demoDevHint, demoRelaunchArgs, demoSwitchPlan } from './demoMode'
import { isReplayMode } from './providers/replay'
import { clearStartupError, reportStartupError } from './notices'
import { startupErrorMessage } from './startup'
import { loadSettings, saveSettings } from './store'
import { applyShortcut, cycleHudDisplay, cycleLeague, resetShortcut, setShortcutCapture } from './shortcuts'
import { createCompanionWindow } from './windows/companion'
import { clearEspnCookies, openEspnLogin } from './windows/espnLogin'
import { checkForUpdates, getUpdateStatus, installUpdate } from './updater'
import { setOverlayDisplayId, setOverlayEditMode, toggleOverlay } from './windows/overlay'

const demoLocked = (): { ok: false; error: string } => ({ ok: false, error: DEMO_LOCKED_MESSAGE })

const setReplayArmed = (enabled: boolean): { ok: boolean; error?: string } => {
  const plan = demoSwitchPlan({
    enabled,
    active: isReplayMode(),
    devServer: Boolean(process.env.ELECTRON_RENDERER_URL)
  })
  switch (plan) {
    case 'noop':
      return { ok: true }
    case 'dev-hint':
      return { ok: false, error: demoDevHint(enabled) }
    case 'relaunch':
      if (!enabled) delete process.env.SIDELINE_REPLAY
      app.relaunch({ args: demoRelaunchArgs(process.argv, enabled) })
      runtime.setQuitting(true)
      app.exit(0)
      return { ok: true }
    default: {
      const _never: never = plan
      return _never
    }
  }
}

export const registerIpc = (): void => {
  ipcMain.handle('sideline:getState', () => currentState())
  ipcMain.handle('sideline:setReplayArmed', (_event, enabled: unknown) => setReplayArmed(Boolean(enabled)))
  ipcMain.handle('sideline:connectSleeper', (_event, username: string) =>
    isReplayMode() ? demoLocked() : connectSleeper(username)
  )
  ipcMain.handle('sideline:disconnectSleeper', async () => {
    if (isReplayMode()) return
    await disconnectSleeper()
  })
  ipcMain.handle('sideline:signInEspn', async () => {
    if (isReplayMode()) return demoLocked()
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
    if (isReplayMode()) return
    await clearEspnCookies()
    invalidateEspnSession()
    const selected = loadSettings().selectedLeagueKey
    const parsed = selected ? parseLeagueKey(selected) : null
    saveSettings({
      espnLeagueIds: [],
      selectedLeagueKey: parsed?.provider === 'espn' ? null : selected
    })
    markEspnRelogin(false)
    await refresh({ waitForBoards: true })
  })
  ipcMain.handle('sideline:addEspnLeague', (_event, leagueId: string) =>
    isReplayMode() ? demoLocked() : addEspnLeagueId(leagueId)
  )
  ipcMain.handle('sideline:removeEspnLeague', async (_event, leagueId: string) => {
    if (isReplayMode()) return
    await removeEspnLeagueId(leagueId)
  })
  ipcMain.handle('sideline:removeSleeperLeague', async (_event, leagueId: string) => {
    if (isReplayMode()) return
    await removeSleeperLeagueId(leagueId)
  })
  ipcMain.handle('sideline:listDiscoverableLeagues', (_event, provider: unknown) => {
    const parsed = parseProvider(provider)
    if (!parsed) return { ok: false, leagues: [], selectedIds: [], error: 'Unknown provider' }
    return listDiscoverableLeagues(parsed)
  })
  ipcMain.handle('sideline:setSelectedLeagueIds', (_event, provider: unknown, ids: unknown) => {
    const parsed = parseProvider(provider)
    if (!parsed) return { ok: false, error: 'Unknown provider' }
    if (isReplayMode()) return demoLocked()
    return setSelectedLeagueIds(parsed, Array.isArray(ids) ? ids : [])
  })
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
    try {
      const port = await setOverlayLanEnabled(Boolean(enabled))
      runtime.setOverlayPort(port)
      clearStartupError('overlay-server')
    } catch (error) {
      console.error('[sideline] overlay server rebind failed', error)
      reportStartupError('overlay-server', startupErrorMessage('overlay-server', error))
    }
    applyLanOverlay()
  })
  ipcMain.handle('sideline:showCompanion', () => {
    createCompanionWindow().show()
  })
  ipcMain.handle('sideline:getUpdateStatus', () => getUpdateStatus())
  ipcMain.handle('sideline:checkForUpdates', () => checkForUpdates(true))
  ipcMain.handle('sideline:installUpdate', () => installUpdate())
  ipcMain.handle('sideline:getRuntimeInfo', () => collectBugReportRuntime())
  ipcMain.handle('sideline:openExternal', (_event, url: unknown) => openExternalUrl(url))
}

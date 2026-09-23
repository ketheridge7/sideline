import { contextBridge, ipcRenderer } from 'electron'
import type { AppState, CompanionBoardsPatch, CompanionHudPatch, CompanionTick, OverlayHudState, ToastPayload } from '@shared/types'
import type { UpdateSnapshot } from '@shared/updater'
import type { SidelineApi } from './index.d'

const api: SidelineApi = {
  getState: () => ipcRenderer.invoke('sideline:getState'),
  setDemoMode: (enabled) => ipcRenderer.invoke('sideline:setDemoMode', enabled),
  onState: (cb) => {
    const listener = (_event: unknown, state: AppState): void => cb(state)
    ipcRenderer.on('sideline:state', listener)
    return () => ipcRenderer.removeListener('sideline:state', listener)
  },
  onTick: (cb) => {
    const listener = (_event: unknown, tick: CompanionTick): void => cb(tick)
    ipcRenderer.on('sideline:tick', listener)
    return () => ipcRenderer.removeListener('sideline:tick', listener)
  },
  onBoards: (cb) => {
    const listener = (_event: unknown, patch: CompanionBoardsPatch): void => cb(patch)
    ipcRenderer.on('sideline:boards', listener)
    return () => ipcRenderer.removeListener('sideline:boards', listener)
  },
  onLive: (cb) => {
    const listener = (_event: unknown, patch: CompanionHudPatch): void => cb(patch)
    ipcRenderer.on('sideline:live', listener)
    return () => ipcRenderer.removeListener('sideline:live', listener)
  },
  onHud: (cb) => {
    const listener = (_event: unknown, hud: OverlayHudState): void => cb(hud)
    ipcRenderer.on('sideline:hud', listener)
    return () => ipcRenderer.removeListener('sideline:hud', listener)
  },
  onToast: (cb) => {
    const listener = (_event: unknown, toast: ToastPayload): void => cb(toast)
    ipcRenderer.on('sideline:toast', listener)
    return () => ipcRenderer.removeListener('sideline:toast', listener)
  },
  connectSleeper: (username) => ipcRenderer.invoke('sideline:connectSleeper', username),
  disconnectSleeper: () => ipcRenderer.invoke('sideline:disconnectSleeper'),
  signInEspn: () => ipcRenderer.invoke('sideline:signInEspn'),
  disconnectEspn: () => ipcRenderer.invoke('sideline:disconnectEspn'),
  addEspnLeague: (leagueId) => ipcRenderer.invoke('sideline:addEspnLeague', leagueId),
  removeEspnLeague: (leagueId) => ipcRenderer.invoke('sideline:removeEspnLeague', leagueId),
  removeSleeperLeague: (leagueId) => ipcRenderer.invoke('sideline:removeSleeperLeague', leagueId),
  listDiscoverableLeagues: (provider) => ipcRenderer.invoke('sideline:listDiscoverableLeagues', provider),
  setSelectedLeagueIds: (provider, ids) => ipcRenderer.invoke('sideline:setSelectedLeagueIds', provider, ids),
  setPinned: (keys) => ipcRenderer.invoke('sideline:setPinned', keys),
  selectLeague: (key) => ipcRenderer.invoke('sideline:selectLeague', key),
  toggleOverlay: () => ipcRenderer.invoke('sideline:toggleOverlay'),
  setOverlayEditMode: (edit) => ipcRenderer.invoke('sideline:setOverlayEditMode', edit),
  setOverlayLayout: (layout) => ipcRenderer.invoke('sideline:setOverlayLayout', layout),
  setOverlayDisplay: (id) => ipcRenderer.invoke('sideline:setOverlayDisplay', id),
  cycleOverlayDisplay: () => ipcRenderer.invoke('sideline:cycleOverlayDisplay'),
  cycleLeague: (delta) => ipcRenderer.invoke('sideline:cycleLeague', delta),
  setShortcut: (action, accelerator) => ipcRenderer.invoke('sideline:setShortcut', action, accelerator),
  resetShortcut: (action) => ipcRenderer.invoke('sideline:resetShortcut', action),
  setShortcutCapture: (active) => ipcRenderer.invoke('sideline:setShortcutCapture', active),
  setLanOverlay: (enabled) => ipcRenderer.invoke('sideline:setLanOverlay', enabled),
  showCompanion: () => ipcRenderer.invoke('sideline:showCompanion'),
  getUpdateStatus: () => ipcRenderer.invoke('sideline:getUpdateStatus'),
  onUpdate: (cb) => {
    const listener = (_event: unknown, snapshot: UpdateSnapshot): void => cb(snapshot)
    ipcRenderer.on('sideline:update', listener)
    return () => ipcRenderer.removeListener('sideline:update', listener)
  },
  checkForUpdates: () => ipcRenderer.invoke('sideline:checkForUpdates'),
  installUpdate: () => ipcRenderer.invoke('sideline:installUpdate'),
  getRuntimeInfo: () => ipcRenderer.invoke('sideline:getRuntimeInfo'),
  openExternal: (url) => ipcRenderer.invoke('sideline:openExternal', url)
}

contextBridge.exposeInMainWorld('sideline', api)

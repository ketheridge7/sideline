import { contextBridge, ipcRenderer } from 'electron'
import type { AppState, CompanionBoardsPatch, CompanionHudPatch, CompanionTick, OverlayHudState, ToastPayload } from '@shared/types'
import type { SidelineApi } from './index.d'

const api: SidelineApi = {
  getState: () => ipcRenderer.invoke('sideline:getState'),
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
  setPinned: (keys) => ipcRenderer.invoke('sideline:setPinned', keys),
  selectLeague: (key) => ipcRenderer.invoke('sideline:selectLeague', key),
  toggleOverlay: () => ipcRenderer.invoke('sideline:toggleOverlay'),
  setOverlayEditMode: (edit) => ipcRenderer.invoke('sideline:setOverlayEditMode', edit),
  setOverlayLayout: (layout) => ipcRenderer.invoke('sideline:setOverlayLayout', layout),
  setOverlayDisplay: (id) => ipcRenderer.invoke('sideline:setOverlayDisplay', id),
  setLanOverlay: (enabled) => ipcRenderer.invoke('sideline:setLanOverlay', enabled),
  showCompanion: () => ipcRenderer.invoke('sideline:showCompanion')
}

contextBridge.exposeInMainWorld('sideline', api)

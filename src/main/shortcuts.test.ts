import { afterEach, describe, expect, it, vi } from 'vitest'
import { rmSync } from 'fs'
import { join } from 'path'

const registered = vi.hoisted(() => ({
  register: vi.fn((_accelerator: string, _handler: () => void) => true),
  unregister: vi.fn(),
  unregisterAll: vi.fn()
}))

vi.mock('electron', () => {
  const fs = require('fs') as typeof import('fs')
  const os = require('os') as typeof import('os')
  const path = require('path') as typeof import('path')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sideline-shortcuts-'))
  return {
    app: { getPath: () => dir },
    globalShortcut: {
      register: registered.register,
      unregister: registered.unregister,
      unregisterAll: registered.unregisterAll
    },
    BrowserWindow: class {},
    screen: { getAllDisplays: () => [], getPrimaryDisplay: () => ({ id: 1, bounds: { x: 0, y: 0, width: 1, height: 1 } }) },
    session: {
      fromPartition: () => ({
        cookies: { get: async () => [] }
      })
    }
  }
})

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }))

import { app } from 'electron'
import { applyHotkeys, currentState } from './poller'
import { runtime } from './runtime'
import { applyShortcut, registerAppShortcuts, syncMinimizedLocalShortcuts } from './shortcuts'
import { loadSettings, resetStoreForTests, saveSettings } from './store'

const settingsPath = (): string => join(app.getPath('userData'), 'sideline-settings.json')

afterEach(() => {
  resetStoreForTests()
  rmSync(settingsPath(), { force: true })
  registered.register.mockReset()
  registered.register.mockImplementation(() => true)
  registered.unregister.mockReset()
  registered.unregisterAll.mockReset()
  runtime.setCompanion(null)
})

describe('applyShortcut', () => {
  it('persists a Cycle HUD display rebind and drops the previous accelerator', () => {
    registered.register.mockImplementation(() => true)
    const calls: string[] = []
    registered.unregisterAll.mockImplementation(() => {
      calls.push('unregister')
    })
    registered.register.mockImplementation((accelerator: string) => {
      calls.push(`register:${accelerator}`)
      return true
    })
    const result = applyShortcut('overlayDisplay', 'CommandOrControl+Shift+K')
    expect(result).toEqual({ ok: true })
    expect(loadSettings().overlayDisplayHotkey).toBe('CommandOrControl+Shift+K')
    expect(loadSettings().overlayHotkey).toBe('CommandOrControl+Shift+O')
    expect(calls[0]).toBe('unregister')
    expect(calls).toContain('register:CommandOrControl+Shift+K')
    expect(calls).not.toContain('register:CommandOrControl+Shift+M')
    resetStoreForTests()
    expect(loadSettings().overlayDisplayHotkey).toBe('CommandOrControl+Shift+K')
  })

  it('keeps the previous accelerator and reports it when the OS refuses the new one', () => {
    saveSettings({ overlayDisplayHotkey: 'CommandOrControl+Shift+D' })
    registered.register.mockImplementation((accelerator: string) => accelerator !== 'CommandOrControl+Shift+K')
    const result = applyShortcut('overlayDisplay', 'Ctrl+Shift+K')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Ctrl+Shift+K')
      expect(result.error).toContain('operating system')
    }
    expect(loadSettings().overlayDisplayHotkey).toBe('CommandOrControl+Shift+D')
    const registeredNow = registered.register.mock.calls.map((call) => call[0])
    expect(registeredNow.at(-1)).not.toBe('CommandOrControl+Shift+K')
    expect(registeredNow).toContain('CommandOrControl+Shift+D')
  })

  it('persists the other rebindable shortcuts on the same path', () => {
    expect(applyShortcut('overlay', 'CommandOrControl+Alt+O').ok).toBe(true)
    expect(applyShortcut('overlayEdit', 'CommandOrControl+Alt+E').ok).toBe(true)
    expect(applyShortcut('nextLeague', 'CommandOrControl+Alt+]').ok).toBe(true)
    expect(applyShortcut('prevLeague', 'CommandOrControl+Alt+[').ok).toBe(true)
    const saved = loadSettings()
    expect(saved.overlayHotkey).toBe('CommandOrControl+Alt+O')
    expect(saved.overlayEditHotkey).toBe('CommandOrControl+Alt+E')
    expect(saved.nextLeagueHotkey).toBe('CommandOrControl+Alt+]')
    expect(saved.prevLeagueHotkey).toBe('CommandOrControl+Alt+[')
    expect(saved.overlayDisplayHotkey).toBe('CommandOrControl+Shift+M')
  })
})

describe('minimized local shortcuts', () => {
  it('registers single keys while minimized and drops them on restore without focusing the window', () => {
    const focus = vi.fn()
    const show = vi.fn()
    const restore = vi.fn()
    runtime.setCompanion({
      isDestroyed: () => false,
      isMinimized: () => false,
      focus,
      show,
      restore,
      webContents: { send: vi.fn() }
    } as never)
    const handlers = new Map<string, () => void>()
    registered.register.mockImplementation((accelerator: string, handler: () => void) => {
      handlers.set(accelerator, handler)
      return true
    })
    registerAppShortcuts()
    expect(handlers.has('CommandOrControl+Shift+O')).toBe(true)
    expect(handlers.has('CommandOrControl+Shift+M')).toBe(true)
    expect(handlers.has('CommandOrControl+Shift+E')).toBe(true)
    expect(handlers.has(']')).toBe(false)
    expect(handlers.has('[')).toBe(false)
    registered.unregisterAll.mockClear()
    handlers.clear()
    syncMinimizedLocalShortcuts(true)
    expect(registered.unregisterAll).not.toHaveBeenCalled()
    expect([...handlers.keys()]).toEqual([']', '['])
    handlers.get(']')?.()
    handlers.get('[')?.()
    expect(focus).not.toHaveBeenCalled()
    expect(show).not.toHaveBeenCalled()
    expect(restore).not.toHaveBeenCalled()
    syncMinimizedLocalShortcuts(false)
    expect(registered.unregister).toHaveBeenCalledWith(']')
    expect(registered.unregister).toHaveBeenCalledWith('[')
    expect(registered.unregister).not.toHaveBeenCalledWith('CommandOrControl+Shift+O')
  })

  it('re-registers single keys after a rebind while the companion stays minimized', () => {
    runtime.setCompanion({
      isDestroyed: () => false,
      isMinimized: () => true,
      webContents: { send: vi.fn() }
    } as never)
    const result = applyShortcut('overlay', 'CommandOrControl+Alt+O')
    expect(result.ok).toBe(true)
    const accelerators = registered.register.mock.calls.map((call) => call[0])
    expect(accelerators).toContain('CommandOrControl+Alt+O')
    expect(accelerators).toContain(']')
    expect(accelerators).toContain('[')
  })
})

describe('applyHotkeys', () => {
  it('sends the new accelerator to the companion instead of comparing the state to itself', async () => {
    saveSettings({ overlayDisplayHotkey: 'CommandOrControl+Shift+K' })
    const sendState = vi.spyOn(runtime, 'sendState')
    applyHotkeys()
    await Promise.resolve()
    expect(currentState().overlayDisplayHotkey).toBe('CommandOrControl+Shift+K')
    expect(sendState).toHaveBeenCalled()
    expect(sendState.mock.calls.at(-1)?.[0]?.overlayDisplayHotkey).toBe('CommandOrControl+Shift+K')
    sendState.mockRestore()
  })
})

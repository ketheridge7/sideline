import { describe, expect, it } from 'vitest'
import {
  acceleratorFromEvent,
  actionForAccelerator,
  applyShortcutChange,
  DEFAULT_SHORTCUTS,
  formatAccelerator,
  nextLeagueKey,
  nextOverlayDisplayId,
  normalizeAccelerator,
  parseShortcutMap,
  shortcutConflict
} from './shortcuts'

describe('normalizeAccelerator', () => {
  it('normalizes Windows/Mac modifier aliases to CommandOrControl', () => {
    expect(normalizeAccelerator('Ctrl+Shift+O')).toBe('CommandOrControl+Shift+O')
    expect(normalizeAccelerator('Cmd+Shift+M')).toBe('CommandOrControl+Shift+M')
    expect(normalizeAccelerator(']')).toBe(']')
    expect(normalizeAccelerator('[')).toBe('[')
    expect(normalizeAccelerator('Shift+Control+o')).toBe('CommandOrControl+Shift+O')
    expect(normalizeAccelerator('')).toBeNull()
    expect(normalizeAccelerator('Control')).toBeNull()
    expect(normalizeAccelerator('nope')).toBeNull()
  })
})

describe('parseShortcutMap', () => {
  it('fills defaults and heals a conflicting custom accelerator', () => {
    const next = parseShortcutMap(
      {
        overlay: 'CommandOrControl+Shift+O',
        overlayDisplay: 'CommandOrControl+Shift+O',
        nextLeague: ']',
        prevLeague: '[',
        overlayEdit: 'CommandOrControl+Shift+E'
      },
      DEFAULT_SHORTCUTS
    )
    expect(next.overlay).toBe('CommandOrControl+Shift+O')
    expect(next.overlayDisplay).toBe('CommandOrControl+Shift+M')
  })
})

describe('applyShortcutChange', () => {
  it('rejects a duplicate accelerator and accepts a free one', () => {
    const clash = applyShortcutChange(DEFAULT_SHORTCUTS, 'overlayDisplay', 'CommandOrControl+Shift+O')
    expect(clash.ok).toBe(false)
    if (!clash.ok) {
      expect(clash.conflict).toBe('overlay')
      expect(clash.error).toContain('Toggle HUD')
    }
    const ok = applyShortcutChange(DEFAULT_SHORTCUTS, 'overlayDisplay', 'CommandOrControl+Shift+D')
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.shortcuts.overlayDisplay).toBe('CommandOrControl+Shift+D')
  })

  it('finds the action that owns an accelerator', () => {
    expect(actionForAccelerator(DEFAULT_SHORTCUTS, ']')).toBe('nextLeague')
    expect(shortcutConflict(DEFAULT_SHORTCUTS, 'nextLeague', ']')).toBeNull()
    expect(formatAccelerator('CommandOrControl+Shift+O')).toBe('Ctrl+Shift+O')
  })
})

describe('acceleratorFromEvent', () => {
  it('maps bracket codes and chorded letters to Electron accelerators', () => {
    expect(
      acceleratorFromEvent({
        key: ']',
        code: 'BracketRight',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false
      })
    ).toBe(']')
    expect(
      acceleratorFromEvent({
        key: 'O',
        code: 'KeyO',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: true
      })
    ).toBe('CommandOrControl+Shift+O')
    expect(
      acceleratorFromEvent({
        key: 'Escape',
        code: 'Escape',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false
      })
    ).toBeNull()
  })
})

describe('nextLeagueKey', () => {
  const leagues = [
    { provider: 'sleeper' as const, id: 'a' },
    { provider: 'espn' as const, id: 'b' },
    { provider: 'sleeper' as const, id: 'c' }
  ]

  it('cycles pinned leagues, then all leagues, and is a no-op on an empty list', () => {
    expect(
      nextLeagueKey({
        leagues,
        pinnedLeagueKeys: ['espn:b', 'sleeper:c'],
        selectedLeagueKey: 'espn:b',
        delta: 1
      })
    ).toBe('sleeper:c')
    expect(
      nextLeagueKey({
        leagues,
        pinnedLeagueKeys: ['espn:b', 'sleeper:c'],
        selectedLeagueKey: 'sleeper:c',
        delta: 1
      })
    ).toBe('espn:b')
    expect(
      nextLeagueKey({
        leagues,
        pinnedLeagueKeys: [],
        selectedLeagueKey: 'sleeper:a',
        delta: -1
      })
    ).toBe('sleeper:c')
    expect(
      nextLeagueKey({
        leagues: [],
        pinnedLeagueKeys: [],
        selectedLeagueKey: null,
        delta: 1
      })
    ).toBeNull()
  })
})

describe('nextOverlayDisplayId', () => {
  it('cycles when more than one display exists and no-ops on a single monitor', () => {
    expect(nextOverlayDisplayId(1, [1], 1)).toEqual({ id: 1, cycled: false })
    expect(nextOverlayDisplayId(null, [], 1)).toEqual({ id: null, cycled: false })
    expect(nextOverlayDisplayId(10, [10, 20, 30], 10)).toEqual({ id: 20, cycled: true })
    expect(nextOverlayDisplayId(30, [10, 20, 30], 10)).toEqual({ id: 10, cycled: true })
    expect(nextOverlayDisplayId(null, [10, 20], 10)).toEqual({ id: 20, cycled: true })
  })
})

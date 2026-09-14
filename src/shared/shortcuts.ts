import { leagueKey, type Provider } from './types'

export const SHORTCUT_ACTIONS = [
  'overlay',
  'overlayDisplay',
  'nextLeague',
  'prevLeague',
  'overlayEdit'
] as const

export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number]

export const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  overlay: 'CommandOrControl+Shift+O',
  overlayDisplay: 'CommandOrControl+Shift+M',
  nextLeague: ']',
  prevLeague: '[',
  overlayEdit: 'CommandOrControl+Shift+E'
}

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  overlay: 'Toggle HUD',
  overlayDisplay: 'Cycle HUD display',
  nextLeague: 'Next league',
  prevLeague: 'Previous league',
  overlayEdit: 'Edit HUD (overlay)'
}

export type ShortcutMap = Record<ShortcutAction, string>

const MOD_ORDER = ['CommandOrControl', 'Alt', 'AltGr', 'Shift', 'Super'] as const

const MOD_ALIASES: Record<string, (typeof MOD_ORDER)[number] | 'drop'> = {
  commandorcontrol: 'CommandOrControl',
  cmdorctrl: 'CommandOrControl',
  command: 'CommandOrControl',
  cmd: 'CommandOrControl',
  control: 'CommandOrControl',
  ctrl: 'CommandOrControl',
  meta: 'CommandOrControl',
  alt: 'Alt',
  option: 'Alt',
  altgr: 'AltGr',
  shift: 'Shift',
  super: 'Super'
}

const NAMED_KEYS = new Set([
  'Plus',
  'Space',
  'Tab',
  'Backspace',
  'Delete',
  'Insert',
  'Enter',
  'Return',
  'Up',
  'Down',
  'Left',
  'Right',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Escape',
  'Capslock',
  'Numlock',
  'Scrolllock',
  'PrintScreen'
])

const KEY_ALIASES: Record<string, string> = {
  arrowup: 'Up',
  arrowdown: 'Down',
  arrowleft: 'Left',
  arrowright: 'Right',
  esc: 'Escape',
  return: 'Enter',
  plus: 'Plus',
  spacebar: 'Space',
  ' ': 'Space'
}

const CODE_KEYS: Record<string, string> = {
  BracketLeft: '[',
  BracketRight: ']',
  Minus: '-',
  Equal: '=',
  Space: 'Space',
  Enter: 'Enter',
  Tab: 'Tab',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`',
  Plus: 'Plus'
}

export const isGlobalAccelerator = (accelerator: string): boolean => accelerator.includes('+')

export const formatAccelerator = (accelerator: string): string =>
  accelerator.replaceAll('CommandOrControl', 'Ctrl').replaceAll('Command', 'Ctrl').replaceAll('Control', 'Ctrl')

const normalizeKey = (raw: string): string | null => {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const aliased = KEY_ALIASES[trimmed.toLowerCase()]
  if (aliased) return aliased
  if (trimmed.length === 1) {
    return trimmed.toUpperCase() === trimmed.toLowerCase() ? trimmed : trimmed.toUpperCase()
  }
  if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(trimmed)) return trimmed.toUpperCase()
  for (const key of NAMED_KEYS) {
    if (key.toLowerCase() === trimmed.toLowerCase()) return key
  }
  return null
}

export const normalizeAccelerator = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null
  const parts = raw
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return null
  const key = normalizeKey(parts[parts.length - 1] ?? '')
  if (!key) return null
  if (MOD_ALIASES[key.toLowerCase()]) return null
  const mods = new Set<(typeof MOD_ORDER)[number]>()
  for (const part of parts.slice(0, -1)) {
    const mapped = MOD_ALIASES[part.toLowerCase()]
    if (!mapped || mapped === 'drop') return null
    mods.add(mapped)
  }
  const ordered = MOD_ORDER.filter((mod) => mods.has(mod))
  return [...ordered, key].join('+')
}

export const parseShortcutMap = (parsed: Partial<ShortcutMap> | undefined, fallback: ShortcutMap): ShortcutMap => {
  const next: ShortcutMap = { ...fallback }
  for (const action of SHORTCUT_ACTIONS) {
    next[action] = normalizeAccelerator(parsed?.[action]) ?? fallback[action]
  }
  return resolveShortcutConflicts(next)
}

export const resolveShortcutConflicts = (shortcuts: ShortcutMap): ShortcutMap => {
  const next: ShortcutMap = { ...shortcuts }
  const used = new Set<string>()
  for (const action of SHORTCUT_ACTIONS) {
    const acc = normalizeAccelerator(next[action])
    const key = acc?.toLowerCase() ?? ''
    if (!acc || used.has(key)) {
      const fallback = DEFAULT_SHORTCUTS[action]
      if (!used.has(fallback.toLowerCase())) {
        next[action] = fallback
        used.add(fallback.toLowerCase())
      }
      continue
    }
    next[action] = acc
    used.add(key)
  }
  return next
}

export const shortcutConflict = (shortcuts: ShortcutMap, action: ShortcutAction, accelerator: string): ShortcutAction | null => {
  const next = normalizeAccelerator(accelerator)
  if (!next) return null
  const needle = next.toLowerCase()
  for (const other of SHORTCUT_ACTIONS) {
    if (other === action) continue
    if (shortcuts[other].toLowerCase() === needle) return other
  }
  return null
}

export const applyShortcutChange = (
  shortcuts: ShortcutMap,
  action: ShortcutAction,
  accelerator: string
): { ok: true; shortcuts: ShortcutMap } | { ok: false; error: string; conflict?: ShortcutAction } => {
  const normalized = normalizeAccelerator(accelerator)
  if (!normalized) return { ok: false, error: 'Invalid shortcut' }
  const conflict = shortcutConflict(shortcuts, action, normalized)
  if (conflict) {
    return {
      ok: false,
      error: `Already used by ${SHORTCUT_LABELS[conflict]}`,
      conflict
    }
  }
  return { ok: true, shortcuts: { ...shortcuts, [action]: normalized } }
}

export const acceleratorFromEvent = (event: {
  key: string
  code: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}): string | null => {
  if (event.key === 'Escape' || event.code === 'Escape') return null
  if (['Control', 'Shift', 'Alt', 'Meta', 'Command'].includes(event.key)) return null
  let key: string | null = null
  if (event.code.startsWith('Key') && event.code.length === 4) key = event.code.slice(3)
  else if (event.code.startsWith('Digit') && event.code.length === 6) key = event.code.slice(5)
  else if (event.code.startsWith('F') && /^F\d{1,2}$/.test(event.code)) key = event.code
  else key = CODE_KEYS[event.code] ?? normalizeKey(event.key)
  if (!key) return null
  const mods: string[] = []
  if (event.ctrlKey || event.metaKey) mods.push('CommandOrControl')
  if (event.altKey) mods.push('Alt')
  if (event.shiftKey) mods.push('Shift')
  return normalizeAccelerator([...mods, key].join('+'))
}

export const actionForAccelerator = (shortcuts: ShortcutMap, accelerator: string): ShortcutAction | null => {
  const needle = normalizeAccelerator(accelerator)?.toLowerCase()
  if (!needle) return null
  for (const action of SHORTCUT_ACTIONS) {
    if (shortcuts[action].toLowerCase() === needle) return action
  }
  return null
}

export const nextLeagueKey = (opts: {
  leagues: Array<{ provider: Provider; id: string }>
  pinnedLeagueKeys: string[]
  selectedLeagueKey: string | null
  delta: number
}): string | null => {
  const pinned = opts.leagues.filter((row) => opts.pinnedLeagueKeys.includes(leagueKey(row.provider, row.id)))
  const list = pinned.length > 0 ? pinned : opts.leagues
  if (list.length === 0) return null
  const index = list.findIndex((row) => leagueKey(row.provider, row.id) === opts.selectedLeagueKey)
  const step = opts.delta < 0 ? -1 : 1
  if (index < 0) {
    const pick = step < 0 ? list[list.length - 1] : list[0]
    return leagueKey(pick.provider, pick.id)
  }
  const next = list[(index + step + list.length) % list.length]
  return leagueKey(next.provider, next.id)
}

export const nextOverlayDisplayId = (
  currentId: number | null,
  displayIds: number[],
  primaryId?: number
): { id: number | null; cycled: boolean } => {
  if (displayIds.length === 0) return { id: currentId, cycled: false }
  if (displayIds.length === 1) return { id: displayIds[0], cycled: false }
  const fallback =
    primaryId != null && displayIds.includes(primaryId) ? primaryId : displayIds[0]
  const fromId = currentId != null && displayIds.includes(currentId) ? currentId : fallback
  const from = displayIds.indexOf(fromId)
  const next = displayIds[(from + 1) % displayIds.length]
  return { id: next, cycled: true }
}

export const isShortcutAction = (value: unknown): value is ShortcutAction =>
  typeof value === 'string' && (SHORTCUT_ACTIONS as readonly string[]).includes(value)

export const shortcutMapFromSettings = (settings: {
  overlayHotkey: string
  overlayDisplayHotkey: string
  nextLeagueHotkey: string
  prevLeagueHotkey: string
  overlayEditHotkey: string
}): ShortcutMap => ({
  overlay: settings.overlayHotkey,
  overlayDisplay: settings.overlayDisplayHotkey,
  nextLeague: settings.nextLeagueHotkey,
  prevLeague: settings.prevLeagueHotkey,
  overlayEdit: settings.overlayEditHotkey
})

export const shortcutSettingsPatch = (shortcuts: ShortcutMap): {
  overlayHotkey: string
  overlayDisplayHotkey: string
  nextLeagueHotkey: string
  prevLeagueHotkey: string
  overlayEditHotkey: string
} => ({
  overlayHotkey: shortcuts.overlay,
  overlayDisplayHotkey: shortcuts.overlayDisplay,
  nextLeagueHotkey: shortcuts.nextLeague,
  prevLeagueHotkey: shortcuts.prevLeague,
  overlayEditHotkey: shortcuts.overlayEdit
})

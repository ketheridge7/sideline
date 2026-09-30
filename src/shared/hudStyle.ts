import { normalizeHex } from './color'
import {
  copyHudTextColors,
  EMPTY_HUD_TEXT_COLORS,
  parseHudTextColors,
  sameHudTextColors,
  type HudTextColors
} from './hudText'

export const HUD_BACKDROPS = ['none', 'smoke', 'glass', 'solid'] as const
export type HudBackdrop = (typeof HUD_BACKDROPS)[number]

export const HUD_EDGES = ['none', 'bar', 'outline'] as const
export type HudEdge = (typeof HUD_EDGES)[number]

export const HUD_FONTS = ['broadcast', 'stadium', 'varsity', 'studio', 'scoreboard'] as const
export type HudFont = (typeof HUD_FONTS)[number]

export const HUD_SHADOWS = ['crisp', 'soft', 'bold'] as const
export type HudShadow = (typeof HUD_SHADOWS)[number]

export const HUD_SIZES = ['auto', 'compact', 'regular', 'large'] as const
export type HudSize = (typeof HUD_SIZES)[number]

/**
 * The look of the HUD, independent of where blocks sit.
 * A theme is a `HudStyle` plus `HudTextColors`.
 */
export type HudStyle = {
  /** Plate painted behind each team frame. `none` is the frosted Sunday Tape look. */
  backdrop: HudBackdrop
  /** Plate strength, 0–100. */
  opacity: number
  /** Plate corner radius in canvas px (1280×720 reference). */
  radius: number
  tint: string
  edge: HudEdge
  accent: string
  font: HudFont
  shadow: HudShadow
}

/** What the HUD shows and how big the type runs. Not part of a theme. */
export type HudDisplay = {
  size: HudSize
  ticker: boolean
  lead: boolean
  rails: boolean
}

export type HudTheme = {
  id: string
  name: string
  style: HudStyle
  textColors: HudTextColors
}

/** Studio-only memory that rides along with the layout so it survives restarts. */
export type StudioLibrary = {
  savedThemes: HudTheme[]
  recentColors: string[]
}

export const HUD_OPACITY_RANGE = { min: 0, max: 100 } as const
export const HUD_RADIUS_RANGE = { min: 0, max: 28 } as const
export const MAX_SAVED_THEMES = 12
export const MAX_RECENT_COLORS = 10
export const MAX_THEME_NAME = 32

export const DEFAULT_HUD_STYLE: HudStyle = {
  backdrop: 'none',
  opacity: 55,
  radius: 10,
  tint: '#07080A',
  edge: 'none',
  accent: '#B6FF3B',
  font: 'broadcast',
  shadow: 'crisp'
}

export const DEFAULT_HUD_DISPLAY: HudDisplay = {
  size: 'auto',
  ticker: true,
  lead: true,
  rails: true
}

export const emptyStudioLibrary = (): StudioLibrary => ({ savedThemes: [], recentColors: [] })

export const HUD_BACKDROP_LABELS: Record<HudBackdrop, string> = {
  none: 'None',
  smoke: 'Smoke',
  glass: 'Glass',
  solid: 'Solid'
}

export const HUD_EDGE_LABELS: Record<HudEdge, string> = {
  none: 'None',
  bar: 'Rule',
  outline: 'Outline'
}

export const HUD_FONT_LABELS: Record<HudFont, string> = {
  broadcast: 'Broadcast',
  stadium: 'Stadium',
  varsity: 'Varsity',
  studio: 'Studio',
  scoreboard: 'Scoreboard'
}

export const HUD_FONT_STACKS: Record<HudFont, string> = {
  broadcast: '"Barlow Condensed", "Segoe UI Condensed", "Arial Narrow", sans-serif',
  stadium: '"Oswald", "Barlow Condensed", "Arial Narrow", sans-serif',
  varsity: '"Saira Condensed", "Barlow Condensed", "Arial Narrow", sans-serif',
  studio: '"Barlow", "Segoe UI", system-ui, sans-serif',
  scoreboard: '"JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace'
}

export const HUD_SHADOW_LABELS: Record<HudShadow, string> = {
  crisp: 'Crisp',
  soft: 'Soft',
  bold: 'Bold'
}

/** `crisp` is the original tight glyph halo. */
export const HUD_SHADOW_CSS: Record<HudShadow, string> = {
  crisp: '0 0 1px rgba(7,8,10,0.7)',
  soft: '0 1px 3px rgba(7,8,10,0.75), 0 0 1px rgba(7,8,10,0.8)',
  bold: '0 2px 6px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.95)'
}

export const HUD_SIZE_LABELS: Record<HudSize, string> = {
  auto: 'Auto',
  compact: 'Compact',
  regular: 'Regular',
  large: 'Large'
}

const theme = (
  id: string,
  name: string,
  style: Partial<HudStyle>,
  textColors: Partial<HudTextColors> = {}
): HudTheme => ({
  id,
  name,
  style: { ...DEFAULT_HUD_STYLE, ...style },
  textColors: { ...EMPTY_HUD_TEXT_COLORS, ...textColors }
})

export const DEFAULT_THEME_ID = 'sunday-tape'

export const BUILT_IN_THEMES: readonly HudTheme[] = [
  theme(DEFAULT_THEME_ID, 'Sunday Tape', {}),
  theme('glass-booth', 'Glass Booth', { backdrop: 'glass', opacity: 42, radius: 16, tint: '#0C1512', shadow: 'soft' }),
  theme(
    'primetime',
    'Primetime',
    { backdrop: 'solid', opacity: 82, radius: 4, edge: 'bar', font: 'stadium' },
    { teamScore: '#FFFFFF' }
  ),
  theme(
    'scoreboard',
    'Scoreboard',
    { backdrop: 'solid', opacity: 90, radius: 2, tint: '#0A0A0A', edge: 'outline', accent: '#FFB547', font: 'scoreboard', shadow: 'soft' },
    { all: '#FFB547', teamName: '#FFFFFF' }
  ),
  theme(
    'night-ice',
    'Night Ice',
    { backdrop: 'smoke', opacity: 72, radius: 12, tint: '#06121F', edge: 'outline', accent: '#8ECAFF', font: 'studio', shadow: 'soft' },
    { teamName: '#FFFFFF', teamScore: '#8ECAFF' }
  ),
  theme('chalk-talk', 'Chalk Talk', { font: 'varsity', shadow: 'bold' }, { all: '#FFFFFF' })
]

export const HUD_THEME_TAGLINES: Record<string, string> = {
  'sunday-tape': 'Frosted type, no panes',
  'glass-booth': 'Soft glass plates',
  primetime: 'Solid plates, lime rule',
  scoreboard: 'Amber stadium board',
  'night-ice': 'Cool smoke, ice scores',
  'chalk-talk': 'Bold white, no plates'
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const pick = <T extends string>(options: readonly T[], value: unknown, fallback: T): T =>
  typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : fallback

const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.round(Math.min(max, Math.max(min, value)))
}

export const parseHudStyle = (raw: unknown): HudStyle => {
  const rec = asRecord(raw)
  if (!rec) return { ...DEFAULT_HUD_STYLE }
  const base = DEFAULT_HUD_STYLE
  return {
    backdrop: pick(HUD_BACKDROPS, rec.backdrop, base.backdrop),
    opacity: clampInt(rec.opacity, HUD_OPACITY_RANGE.min, HUD_OPACITY_RANGE.max, base.opacity),
    radius: clampInt(rec.radius, HUD_RADIUS_RANGE.min, HUD_RADIUS_RANGE.max, base.radius),
    tint: normalizeHex(rec.tint) ?? base.tint,
    edge: pick(HUD_EDGES, rec.edge, base.edge),
    accent: normalizeHex(rec.accent) ?? base.accent,
    font: pick(HUD_FONTS, rec.font, base.font),
    shadow: pick(HUD_SHADOWS, rec.shadow, base.shadow)
  }
}

export const parseHudDisplay = (raw: unknown): HudDisplay => {
  const rec = asRecord(raw)
  if (!rec) return { ...DEFAULT_HUD_DISPLAY }
  const bool = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback)
  return {
    size: pick(HUD_SIZES, rec.size, DEFAULT_HUD_DISPLAY.size),
    ticker: bool(rec.ticker, DEFAULT_HUD_DISPLAY.ticker),
    lead: bool(rec.lead, DEFAULT_HUD_DISPLAY.lead),
    rails: bool(rec.rails, DEFAULT_HUD_DISPLAY.rails)
  }
}

export const cleanThemeName = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_THEME_NAME)
}

const THEME_ID = /^[a-z0-9-]{1,40}$/

export const parseHudTheme = (raw: unknown): HudTheme | null => {
  const rec = asRecord(raw)
  if (!rec) return null
  const name = cleanThemeName(rec.name)
  if (!name) return null
  const id = typeof rec.id === 'string' && THEME_ID.test(rec.id) ? rec.id : null
  if (!id) return null
  return { id, name, style: parseHudStyle(rec.style), textColors: parseHudTextColors(rec.textColors) }
}

export const parseStudioLibrary = (raw: unknown): StudioLibrary => {
  const rec = asRecord(raw)
  if (!rec) return emptyStudioLibrary()
  const savedThemes: HudTheme[] = []
  const seen = new Set<string>()
  if (Array.isArray(rec.savedThemes)) {
    for (const row of rec.savedThemes) {
      const parsed = parseHudTheme(row)
      if (!parsed || seen.has(parsed.id)) continue
      seen.add(parsed.id)
      savedThemes.push(parsed)
      if (savedThemes.length >= MAX_SAVED_THEMES) break
    }
  }
  const recentColors: string[] = []
  if (Array.isArray(rec.recentColors)) {
    for (const value of rec.recentColors) {
      const hex = normalizeHex(value)
      if (!hex || recentColors.includes(hex)) continue
      recentColors.push(hex)
      if (recentColors.length >= MAX_RECENT_COLORS) break
    }
  }
  return { savedThemes, recentColors }
}

export const sameHudStyle = (left: HudStyle, right: HudStyle): boolean =>
  left.backdrop === right.backdrop &&
  left.opacity === right.opacity &&
  left.radius === right.radius &&
  left.tint === right.tint &&
  left.edge === right.edge &&
  left.accent === right.accent &&
  left.font === right.font &&
  left.shadow === right.shadow

export const sameHudDisplay = (left: HudDisplay, right: HudDisplay): boolean =>
  left.size === right.size && left.ticker === right.ticker && left.lead === right.lead && left.rails === right.rails

export const sameStudioLibrary = (left: StudioLibrary, right: StudioLibrary): boolean =>
  left === right || JSON.stringify(left) === JSON.stringify(right)

/**
 * Plate-free looks ignore opacity/radius/tint, and an edge-free look ignores accent,
 * so a slider nudged under `backdrop: none` still reads as that theme.
 */
const visibleStyleMatches = (left: HudStyle, right: HudStyle): boolean => {
  if (left.backdrop !== right.backdrop || left.edge !== right.edge) return false
  if (left.font !== right.font || left.shadow !== right.shadow) return false
  if (left.backdrop !== 'none') {
    if (left.opacity !== right.opacity || left.radius !== right.radius || left.tint !== right.tint) return false
  }
  if (left.edge !== 'none' && left.accent !== right.accent) return false
  if (left.edge !== 'none' && left.backdrop === 'none' && left.radius !== right.radius) return false
  return true
}

export const themeMatches = (theme: HudTheme, style: HudStyle, textColors: HudTextColors): boolean =>
  visibleStyleMatches(theme.style, style) && sameHudTextColors(theme.textColors, textColors)

/** The built-in or saved theme the current look matches, if any. Saved themes win ties. */
export const matchingThemeId = (
  style: HudStyle,
  textColors: HudTextColors,
  saved: readonly HudTheme[] = []
): string | null => {
  const hit = [...saved, ...BUILT_IN_THEMES].find((row) => themeMatches(row, style, textColors))
  return hit?.id ?? null
}

export const pushRecentColor = (recent: readonly string[], color: string): string[] => {
  const hex = normalizeHex(color)
  if (!hex) return [...recent]
  return [hex, ...recent.filter((row) => row !== hex)].slice(0, MAX_RECENT_COLORS)
}

const slug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'theme'

/**
 * Saves the look under `name`. Same name (case-insensitive) replaces in place.
 * Newest first; the oldest drops once the library is full.
 */
export const saveThemeToLibrary = (
  library: StudioLibrary,
  name: string,
  style: HudStyle,
  textColors: HudTextColors,
  stamp: number = Date.now()
): { library: StudioLibrary; theme: HudTheme } | null => {
  const clean = cleanThemeName(name)
  if (!clean) return null
  const existing = library.savedThemes.find((row) => row.name.toLowerCase() === clean.toLowerCase())
  const id = existing?.id ?? `my-${slug(clean)}-${Math.abs(Math.trunc(stamp)).toString(36)}`.slice(0, 40)
  const next: HudTheme = { id, name: clean, style: { ...style }, textColors: copyHudTextColors(textColors) }
  const rest = library.savedThemes.filter((row) => row.id !== id)
  return {
    library: { ...library, savedThemes: [next, ...rest].slice(0, MAX_SAVED_THEMES) },
    theme: next
  }
}

export const removeSavedTheme = (library: StudioLibrary, id: string): StudioLibrary => ({
  ...library,
  savedThemes: library.savedThemes.filter((row) => row.id !== id)
})

const THEME_CODE_PREFIX = 'SL1.'

const toBase64Url = (text: string): string => {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (code: string): string | null => {
  try {
    const padded = code.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

/** A short, paste-safe string that carries one theme between machines. */
export const encodeThemeCode = (name: string, style: HudStyle, textColors: HudTextColors): string =>
  THEME_CODE_PREFIX +
  toBase64Url(JSON.stringify({ name: cleanThemeName(name) || 'Shared theme', style, textColors }))

/** Accepts a theme code or raw theme JSON. Returns a theme with an `import-` id, or null. */
export const decodeThemeCode = (input: string, stamp: number = Date.now()): HudTheme | null => {
  const trimmed = input.trim()
  if (!trimmed) return null
  let json: string | null = null
  if (trimmed.startsWith(THEME_CODE_PREFIX)) json = fromBase64Url(trimmed.slice(THEME_CODE_PREFIX.length))
  else if (trimmed.startsWith('{')) json = trimmed
  if (!json) return null
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return null
  }
  const rec = asRecord(raw)
  if (!rec || !asRecord(rec.style)) return null
  return parseHudTheme({
    ...rec,
    id: `import-${Math.abs(Math.trunc(stamp)).toString(36)}`
  })
}

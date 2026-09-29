export const HUD_TEXT_ROLES = ['playerName', 'teamName', 'teamScore', 'playerScore'] as const

export type HudTextRole = (typeof HUD_TEXT_ROLES)[number]

export type HudTextHighlight = HudTextRole | 'all'

export type HudTextColors = {
  all: string | null
  playerName: string | null
  teamName: string | null
  teamScore: string | null
  playerScore: string | null
}

export const EMPTY_HUD_TEXT_COLORS: HudTextColors = {
  all: null,
  playerName: null,
  teamName: null,
  teamScore: null,
  playerScore: null
}

export const HUD_TEXT_ROLE_LABELS: Record<HudTextRole, string> = {
  playerName: 'Player names',
  teamName: 'Team names',
  teamScore: 'Team scores',
  playerScore: 'Player scores'
}

/** Role override, then `all`, then null (Ice defaults at paint time). */
export const resolveHudTextColor = (colors: HudTextColors, role: HudTextRole): string | null =>
  colors[role] ?? colors.all

export const hudTextColorsCustom = (colors: HudTextColors): boolean =>
  colors.all != null || HUD_TEXT_ROLES.some((role) => colors[role] != null)

export const copyHudTextColors = (colors: HudTextColors): HudTextColors => ({
  all: colors.all,
  playerName: colors.playerName,
  teamName: colors.teamName,
  teamScore: colors.teamScore,
  playerScore: colors.playerScore
})

export const sameHudTextColors = (left: HudTextColors, right: HudTextColors): boolean =>
  left.all === right.all && HUD_TEXT_ROLES.every((role) => left[role] === right[role])

export const HUD_FONT_SWATCHES = [
  { id: 'ice', label: 'Ice', color: null },
  { id: 'white', label: 'White', color: '#FFFFFF' },
  { id: 'lime', label: 'Lime', color: '#B6FF3B' },
  { id: 'frost', label: 'Frost', color: '#F8FBFF' },
  { id: 'silver', label: 'Silver', color: '#E8E4DC' }
] as const

export type HudFontSwatchId = (typeof HUD_FONT_SWATCHES)[number]['id']

const HUD_FONT_COLOR = /^#[0-9A-F]{6}$/

/** #RRGGBB only. Anything else, including a missing value, is the default ink. */
export const parseHudFontColor = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const next = value.trim().toUpperCase()
  return HUD_FONT_COLOR.test(next) ? next : null
}

/** Backdrop the HUD floats on. A hint only — choices are never blocked. */
export const HUD_TEXT_BACKDROP = '#07080A'

const FAINT_HUD_CONTRAST = 2.5

const srgbChannel = (channel: number): number => {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

const relativeLuminance = (hex: string): number => {
  const parsed = parseHudFontColor(hex)
  if (!parsed) return 0
  const r = srgbChannel(parseInt(parsed.slice(1, 3), 16))
  const g = srgbChannel(parseInt(parsed.slice(3, 5), 16))
  const b = srgbChannel(parseInt(parsed.slice(5, 7), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export const hudContrastRatio = (foreground: string, background = HUD_TEXT_BACKDROP): number => {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background))
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

export const hudColorIsFaint = (color: string | null): boolean =>
  color != null && hudContrastRatio(color) < FAINT_HUD_CONTRAST

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

/**
 * Reads `textColors`, or folds the pre-split `fontColor` into `all`.
 * Junk hex values become null so that role falls through.
 */
export const parseHudTextColors = (raw: unknown, legacyFontColor?: unknown): HudTextColors => {
  const legacy = parseHudFontColor(legacyFontColor)
  const rec = asRecord(raw)
  if (!rec) return { ...EMPTY_HUD_TEXT_COLORS, all: legacy }
  const all = Object.prototype.hasOwnProperty.call(rec, 'all') ? parseHudFontColor(rec.all) : legacy
  return {
    all,
    playerName: parseHudFontColor(rec.playerName),
    teamName: parseHudFontColor(rec.teamName),
    teamScore: parseHudFontColor(rec.teamScore),
    playerScore: parseHudFontColor(rec.playerScore)
  }
}

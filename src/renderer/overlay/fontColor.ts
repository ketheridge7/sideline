import type { CSSProperties } from 'react'
import {
  HUD_TEXT_ROLES,
  hudTextColorsCustom,
  resolveHudTextColor,
  type HudTextColors,
  type HudTextRole
} from '@shared/overlayLayout'

/** Widget ink before a Studio font color is chosen. Matches the overlay as it ships today. */
export const HUD_WIDGET_INK = '#F4F6F8'

const ROLE_VAR: Record<HudTextRole, string> = {
  playerName: '--hud-player-name',
  teamName: '--hud-team-name',
  teamScore: '--hud-team-score',
  playerScore: '--hud-player-score'
}

const ROLE_CLASS: Record<HudTextRole, string> = {
  playerName: 'hud-ink-player-name',
  teamName: 'hud-ink-team-name',
  teamScore: 'hud-ink-team-score',
  playerScore: 'hud-ink-player-score'
}

/**
 * `hud-font-custom` marks a widget with any custom ink. Each role that actually resolves
 * to a color also gets its own class, so an unset role keeps its Sunday Tape color
 * instead of reading an empty variable.
 */
export const hudWidgetFontClass = (colors: HudTextColors): string => {
  if (!hudTextColorsCustom(colors)) return ''
  const roles = HUD_TEXT_ROLES.filter((role) => resolveHudTextColor(colors, role) != null).map((role) => ROLE_CLASS[role])
  return ['hud-font-custom', ...roles].join(' ')
}

/**
 * The widget itself stays on the default ice ink so position tags, the lead chip,
 * and ticker status colors do not inherit a custom swatch. Resolved role colors
 * are exposed as variables for the four text elements.
 */
export const hudWidgetFontStyle = (colors: HudTextColors): CSSProperties => {
  const style: CSSProperties = { color: HUD_WIDGET_INK }
  for (const role of HUD_TEXT_ROLES) {
    const color = resolveHudTextColor(colors, role)
    if (!color) continue
    ;(style as Record<string, string>)[ROLE_VAR[role]] = color
  }
  return style
}

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

export const hudWidgetFontClass = (colors: HudTextColors): string =>
  hudTextColorsCustom(colors) ? 'hud-font-custom' : ''

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

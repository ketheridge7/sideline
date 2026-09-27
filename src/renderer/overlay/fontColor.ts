import type { CSSProperties } from 'react'

/** Widget ink before a Studio font color is chosen. Matches the overlay as it ships today. */
export const HUD_WIDGET_INK = '#F4F6F8'

export const hudWidgetFontClass = (fontColor: string | null): string => (fontColor ? 'hud-font-custom' : '')

export const hudWidgetFontStyle = (fontColor: string | null): CSSProperties => {
  if (!fontColor) return { color: HUD_WIDGET_INK }
  return { color: fontColor, '--hud-font': fontColor } as CSSProperties
}

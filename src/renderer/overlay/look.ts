import type { CSSProperties } from 'react'
import { hexToRgba } from '@shared/color'
import { HUD_FONT_STACKS, HUD_SHADOW_CSS, type HudStyle } from '@shared/hudStyle'

/** Canvas px at the 1280-wide reference, in container-width units so plates scale with the screen. */
const cqw = (px: number): string => `${((px / 1280) * 100).toFixed(4)}cqw`

const EDGE_PX = 4

const plateFill = (style: HudStyle): string | undefined => {
  const alpha = style.opacity / 100
  switch (style.backdrop) {
    case 'none':
      return undefined
    case 'smoke':
      return `linear-gradient(180deg, ${hexToRgba(style.tint, alpha * 0.55)} 0%, ${hexToRgba(style.tint, alpha)} 22%, ${hexToRgba(style.tint, alpha)} 78%, ${hexToRgba(style.tint, alpha * 0.55)} 100%)`
    case 'glass':
      return `linear-gradient(155deg, rgba(255,255,255,${(0.05 + alpha * 0.12).toFixed(3)}) 0%, rgba(255,255,255,${(alpha * 0.04).toFixed(3)}) 38%, ${hexToRgba(style.tint, alpha)} 100%)`
    case 'solid':
      return hexToRgba(style.tint, alpha)
    default: {
      const _never: never = style.backdrop
      return _never
    }
  }
}

const plateShadows = (style: HudStyle, side: 'left' | 'right'): string[] => {
  const shadows: string[] = []
  if (style.backdrop === 'glass') {
    shadows.push('inset 0 0 0 1px rgba(255,255,255,0.14)', 'inset 0 1px 0 rgba(255,255,255,0.22)')
  }
  switch (style.edge) {
    case 'none':
      break
    case 'bar':
      shadows.push(`inset ${side === 'left' ? '' : '-'}${cqw(EDGE_PX)} 0 0 ${style.accent}`)
      break
    case 'outline':
      shadows.push(`inset 0 0 0 1px ${hexToRgba(style.accent, 0.75)}`)
      break
    default: {
      const _never: never = style.edge
      void _never
    }
  }
  return shadows
}

/** Paint for one team plate. `side` is where the plate sits on screen, so a rule faces the bezel. */
export const hudPlateStyle = (style: HudStyle, side: 'left' | 'right'): CSSProperties | null => {
  const background = plateFill(style)
  const shadows = plateShadows(style, side)
  if (!background && shadows.length === 0) return null
  return {
    background,
    boxShadow: shadows.length > 0 ? shadows.join(', ') : undefined,
    borderRadius: cqw(style.radius)
  }
}

/** CSS variables on the canvas root. Widgets and the ticker read them. */
export const hudCanvasVars = (style: HudStyle): CSSProperties => {
  const vars: Record<string, string> = { '--hud-font': HUD_FONT_STACKS[style.font] }
  if (style.backdrop !== 'none') {
    vars['--hud-ticker-bg'] = hexToRgba(style.tint, Math.max(0.55, style.opacity / 100))
  }
  return vars as CSSProperties
}

export const hudTextShadow = (style: HudStyle): string => HUD_SHADOW_CSS[style.shadow]

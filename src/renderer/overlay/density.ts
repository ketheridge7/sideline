import type { OverlayDensity } from '@shared/overlayLayout'
import type { OverlaySurface } from './subscribe'

export type Density = Exclude<OverlayDensity, 'inherit'>

/** Tight glyph halo for grass/sky contrast — not a panel-shaped blob. */
export const HUD_TEXT_SHADOW = '0 0 1px rgba(7,8,10,0.7)'

export const resolveDensity = (surface: OverlaySurface, density: OverlayDensity): Density => {
  if (surface === 'tv') return 'large'
  if (density === 'inherit') return 'regular'
  return density
}

export const smokeFill = (_surface: OverlaySurface, opacity: number): number => opacity

export const hudWidgetFill = (fill: number): string => {
  if (fill <= 0.02) return 'transparent'
  const edge = (fill * 0.18).toFixed(3)
  const mid = fill.toFixed(3)
  return `linear-gradient(180deg, rgba(7,8,10,${edge}) 0%, rgba(7,8,10,${mid}) 16%, rgba(7,8,10,${mid}) 84%, rgba(7,8,10,${edge}) 100%)`
}

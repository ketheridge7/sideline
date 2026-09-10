import type { OverlayDensity } from '@shared/overlayLayout'
import type { OverlaySurface } from './subscribe'

export type Density = Exclude<OverlayDensity, 'inherit'>

export const HUD_TEXT_SHADOW =
  '0 1px 3px rgba(7,8,10,0.95), 0 0 12px rgba(7,8,10,0.88), 0 0 2px #07080A'

export const resolveDensity = (surface: OverlaySurface, density: OverlayDensity): Density => {
  if (surface === 'tv') return 'large'
  if (density === 'inherit') return 'regular'
  return density
}

export const smokeFill = (surface: OverlaySurface, opacity: number): number =>
  surface === 'tv' ? Math.max(opacity, 0.08) : opacity

export const hudWidgetFill = (fill: number): string => {
  if (fill <= 0.02) return 'transparent'
  const edge = (fill * 0.18).toFixed(3)
  const mid = fill.toFixed(3)
  return `linear-gradient(180deg, rgba(7,8,10,${edge}) 0%, rgba(7,8,10,${mid}) 16%, rgba(7,8,10,${mid}) 84%, rgba(7,8,10,${edge}) 100%)`
}

import type { OverlayDensity } from '@shared/overlayLayout'
import type { OverlaySurface } from './subscribe'

export type Density = Exclude<OverlayDensity, 'inherit'>

export const resolveDensity = (surface: OverlaySurface, density: OverlayDensity): Density => {
  if (surface === 'tv') return 'large'
  if (density === 'inherit') return 'regular'
  return density
}

export const smokeFill = (surface: OverlaySurface, opacity: number): number =>
  surface === 'tv' ? Math.max(opacity, 0.4) : opacity

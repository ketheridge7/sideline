import { describe, expect, it } from 'vitest'
import {
  canvasInsetPct,
  eventsPathFromSearch,
  isTvOverlay,
  overlayAllowsEdit,
  overlayPresetFromSearch,
  overlaySurface
} from './subscribe'

describe('eventsPathFromSearch', () => {
  it('forwards the LAN token onto the SSE URL', () => {
    expect(eventsPathFromSearch('?k=deadbeef&tv=1')).toBe('/events?k=deadbeef')
  })

  it('uses a bare events path when no token is present', () => {
    expect(eventsPathFromSearch('')).toBe('/events')
    expect(eventsPathFromSearch('?tv=1')).toBe('/events')
  })
})

describe('overlaySurface', () => {
  it('detects tv, obs, and desktop', () => {
    expect(overlaySurface('?tv=1')).toBe('tv')
    expect(overlaySurface('?k=abc&tv=1')).toBe('tv')
    expect(overlaySurface('?surface=obs')).toBe('obs')
    expect(overlaySurface('?k=abc')).toBe('desktop')
  })

  it('never allows edit on TV, OBS, or LAN (no preload)', () => {
    expect(overlayAllowsEdit('?tv=1', true)).toBe(false)
    expect(overlayAllowsEdit('?surface=obs', true)).toBe(false)
    expect(overlayAllowsEdit('', false)).toBe(false)
    expect(overlayAllowsEdit('', true)).toBe(true)
  })

  it('ignores ?edit=1 on TV, OBS, and LAN', () => {
    expect(overlayAllowsEdit('?edit=1', false)).toBe(false)
    expect(overlayAllowsEdit('?tv=1&edit=1', true)).toBe(false)
    expect(overlayAllowsEdit('?surface=obs&edit=1', true)).toBe(false)
  })

  it('insets the TV canvas by 4 percent', () => {
    expect(canvasInsetPct('tv')).toBe(4)
    expect(canvasInsetPct('obs')).toBe(0)
    expect(canvasInsetPct('desktop')).toBe(0)
  })
})

describe('overlayPresetFromSearch', () => {
  it('freezes a Studio preset only when the query names one', () => {
    expect(overlayPresetFromSearch('?preset=3')).toBe('3')
    expect(overlayPresetFromSearch('?k=abc&preset=3')).toBe('3')
    expect(overlayPresetFromSearch('?preset=1')).toBe('1')
    expect(overlayPresetFromSearch('')).toBeNull()
    expect(overlayPresetFromSearch('?preset=9')).toBeNull()
    expect(overlayPresetFromSearch('?preset=corners')).toBeNull()
  })
})

describe('isTvOverlay', () => {
  it('detects the tv=1 query flag', () => {
    expect(isTvOverlay('?tv=1')).toBe(true)
    expect(isTvOverlay('?k=abc&tv=1')).toBe(true)
    expect(isTvOverlay('?k=abc')).toBe(false)
  })
})

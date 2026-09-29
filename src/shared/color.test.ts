import { describe, expect, it } from 'vitest'
import { hexToHsv, hexToRgb, hexToRgba, hsvToHex, normalizeHex } from './color'

describe('normalizeHex', () => {
  it('accepts short and long hex with or without #', () => {
    expect(normalizeHex('#b6ff3b')).toBe('#B6FF3B')
    expect(normalizeHex('fff')).toBe('#FFFFFF')
    expect(normalizeHex('  #0a0  ')).toBe('#00AA00')
  })

  it('rejects anything else', () => {
    for (const bad of ['', '#12', '#12345', '#GGGGGG', 'red', 12, null, undefined]) {
      expect(normalizeHex(bad)).toBeNull()
    }
  })
})

describe('hsv round trip', () => {
  it('converts brand colors both ways', () => {
    for (const hex of ['#B6FF3B', '#07080A', '#FFFFFF', '#000000', '#FF0000', '#8ECAFF', '#FFB547']) {
      const hsv = hexToHsv(hex)
      expect(hsv).not.toBeNull()
      if (hsv) expect(hsvToHex(hsv)).toBe(hex)
    }
  })

  it('reads hue, saturation, and value', () => {
    expect(hexToHsv('#FF0000')).toEqual({ h: 0, s: 1, v: 1 })
    expect(hexToHsv('#000000')).toEqual({ h: 0, s: 0, v: 0 })
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe('#00FF00')
    expect(hsvToHex({ h: 360, s: 1, v: 1 })).toBe('#FF0000')
  })
})

describe('rgb helpers', () => {
  it('splits channels and builds rgba', () => {
    expect(hexToRgb('#B6FF3B')).toEqual({ r: 182, g: 255, b: 59 })
    expect(hexToRgb('nope')).toBeNull()
    expect(hexToRgba('#FFFFFF', 0.5)).toBe('rgba(255,255,255,0.500)')
    expect(hexToRgba('#FFFFFF', 4)).toBe('rgba(255,255,255,1.000)')
  })

  it('falls back to the HUD ink backdrop for bad input', () => {
    expect(hexToRgba('nope', 1)).toBe(hexToRgba('#07080A', 1))
  })
})

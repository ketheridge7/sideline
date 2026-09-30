export type Hsv = { h: number; s: number; v: number }

const HEX6 = /^#?([0-9a-f]{6})$/i
const HEX3 = /^#?([0-9a-f]{3})$/i

const clamp01 = (value: number): number => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))

/** Accepts `#RGB`, `RGB`, `#RRGGBB`, or `RRGGBB` (any case). Returns `#RRGGBB` or null. */
export const normalizeHex = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  const six = raw.match(HEX6)
  if (six) return `#${six[1].toUpperCase()}`
  const three = raw.match(HEX3)
  if (three) {
    const [r, g, b] = three[1].toUpperCase().split('')
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return null
}

const toByte = (unit: number): string =>
  Math.round(clamp01(unit) * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase()

export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const parsed = normalizeHex(hex)
  if (!parsed) return null
  return {
    r: parseInt(parsed.slice(1, 3), 16),
    g: parseInt(parsed.slice(3, 5), 16),
    b: parseInt(parsed.slice(5, 7), 16)
  }
}

/** Hue in degrees [0, 360), saturation and value in [0, 1]. */
export const hexToHsv = (hex: string): Hsv | null => {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

export const hsvToHex = ({ h, s, v }: Hsv): string => {
  const hue = ((Number.isFinite(h) ? h : 0) % 360 + 360) % 360
  const sat = clamp01(s)
  const val = clamp01(v)
  const c = val * sat
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = val - c
  let r = 0
  let g = 0
  let b = 0
  if (hue < 60) [r, g, b] = [c, x, 0]
  else if (hue < 120) [r, g, b] = [x, c, 0]
  else if (hue < 180) [r, g, b] = [0, c, x]
  else if (hue < 240) [r, g, b] = [0, x, c]
  else if (hue < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return `#${toByte(r + m)}${toByte(g + m)}${toByte(b + m)}`
}

/** `rgba()` for a hex color at the given alpha. Falls back to near-black. */
export const hexToRgba = (hex: string, alpha: number): string => {
  const rgb = hexToRgb(hex) ?? { r: 7, g: 8, b: 10 }
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${clamp01(alpha).toFixed(3)})`
}

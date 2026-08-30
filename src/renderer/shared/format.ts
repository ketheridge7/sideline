export const formatScore = (value: number): string => {
  if (!Number.isFinite(value)) return '—'
  return value.toFixed(1)
}

export const formatDelta = (value: number): string => {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value).toFixed(1)
  if (value > 0) return `+${abs}`
  if (value < 0) return `-${abs}`
  return '0.0'
}

export const overlayName = (name: string): string => {
  if (/D\/ST|DST|\bDEF\b/i.test(name)) return name
  const parts = name.trim().split(/\s+/)
  if (parts.length <= 1) return name
  return parts[parts.length - 1]
}

import type { JSX } from 'react'
import { sparklinePoints } from '@shared/display'

export const Sparkline = ({
  values,
  positive
}: {
  values: number[]
  positive: boolean
}): JSX.Element | null => {
  const points = sparklinePoints(values, 48, 16)
  if (!points) return null
  return (
    <svg viewBox="0 0 48 16" className="h-4 w-12 shrink-0" aria-hidden="true">
      <polyline
        fill="none"
        stroke={positive ? '#A6E6A0' : '#FF4D4D'}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  )
}

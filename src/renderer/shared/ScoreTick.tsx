import { useEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
import {
  SCORE_TICK_DELTA_MS,
  SCORE_TICK_SETTLE_MS,
  scoreTickChange,
  scoreTickLabel
} from '@shared/scoreTick'
import { formatScore } from './format'

const LIME = '#B6FF3B'
const SETTLE_MS = SCORE_TICK_SETTLE_MS - SCORE_TICK_DELTA_MS

export const ScoreTick = ({
  value,
  restColor,
  className,
  style,
  align = 'left'
}: {
  value: number | null | undefined
  restColor: string
  className?: string
  style?: CSSProperties
  align?: 'left' | 'right'
}): JSX.Element => {
  const prev = useRef<number | null>(null)
  const [delta, setDelta] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'delta' | 'settle'>('idle')

  useEffect(() => {
    const last = prev.current
    if (typeof value !== 'number') return
    if (last == null) {
      prev.current = value
      return
    }
    const change = scoreTickChange(last, value)
    prev.current = value
    if (!change) return
    if (!change.celebrate) {
      setPhase('idle')
      return
    }
    setDelta(change.delta)
    setPhase('delta')
    const settle = window.setTimeout(() => setPhase('settle'), SCORE_TICK_DELTA_MS)
    const done = window.setTimeout(() => setPhase('idle'), SCORE_TICK_SETTLE_MS)
    return () => {
      window.clearTimeout(settle)
      window.clearTimeout(done)
    }
  }, [value])

  if (value == null || !Number.isFinite(value)) {
    return <span className={className}>—</span>
  }

  const showDelta = phase === 'delta'
  const justify = align === 'right' ? 'justify-end' : 'justify-start'
  const color = phase === 'delta' ? LIME : restColor
  const colorTransition = phase === 'settle' ? `color ${SETTLE_MS}ms linear` : 'color 0s'

  return (
    <span
      className={`score-tick ${className ?? ''}`.trim()}
      style={{
        ...style,
        color,
        transition: `${colorTransition}, opacity 200ms ease`
      }}
      data-score-tick={phase}
    >
      <span className="invisible tabular-nums">{formatScore(value)}</span>
      <span className={`score-tick-slot ${justify}`} style={{ opacity: showDelta ? 1 : 0 }}>
        {scoreTickLabel('delta', value, delta)}
      </span>
      <span className={`score-tick-slot ${justify}`} style={{ opacity: showDelta ? 0 : 1 }}>
        {formatScore(value)}
      </span>
    </span>
  )
}

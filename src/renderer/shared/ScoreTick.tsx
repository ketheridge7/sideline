import { useEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
import {
  SCORE_TICK_DELTA_MS,
  SCORE_TICK_SETTLE_MS,
  scoreTickChange,
  scoreTickLabel,
  type ScoreTickKind,
  type ScoreTickPhase
} from '@shared/scoreTick'
import { formatScore } from './format'

const LIME = '#B6FF3B'
const AIR = '#FF4D4D'
const SETTLE_MS = SCORE_TICK_SETTLE_MS - SCORE_TICK_DELTA_MS

export const useScoreTick = (
  value: number | null | undefined
): { phase: ScoreTickPhase; delta: number; kind: ScoreTickKind | null } => {
  const prev = useRef<number | null>(null)
  const [delta, setDelta] = useState(0)
  const [kind, setKind] = useState<ScoreTickKind | null>(null)
  const [phase, setPhase] = useState<ScoreTickPhase>('idle')

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
    setDelta(change.delta)
    setKind(change.kind)
    setPhase('delta')
    const settle = window.setTimeout(() => setPhase('settle'), SCORE_TICK_DELTA_MS)
    const done = window.setTimeout(() => {
      setPhase('idle')
      setKind(null)
    }, SCORE_TICK_SETTLE_MS)
    return () => {
      window.clearTimeout(settle)
      window.clearTimeout(done)
    }
  }, [value])

  return { phase, delta, kind }
}

export const LastTickMark = ({ value }: { value: number | null | undefined }): JSX.Element | null => {
  const { kind, phase } = useScoreTick(value)
  if (!kind || phase === 'idle') return null
  return (
    <span
      className={`shrink-0 text-[9px] leading-none ${kind === 'down' ? 'text-air' : 'text-lime'}`}
      data-last-tick={kind}
      aria-hidden="true"
    >
      {kind === 'down' ? '▼' : '▲'}
    </span>
  )
}

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
  align?: 'left' | 'right' | 'center'
}): JSX.Element => {
  const { phase, delta, kind } = useScoreTick(value)

  if (value == null || !Number.isFinite(value)) {
    return <span className={className}>—</span>
  }

  const showDelta = phase === 'delta'
  const justify =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
  const flashColor = kind === 'down' ? AIR : LIME
  const color = phase === 'delta' ? flashColor : restColor
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
      data-score-tick-kind={kind ?? undefined}
    >
      <span className="invisible tabular-nums score-tick-sizer">{formatScore(value)}</span>
      <span className={`score-tick-slot ${justify}`} style={{ opacity: showDelta ? 1 : 0 }}>
        {scoreTickLabel('delta', value, delta)}
      </span>
      <span className={`score-tick-slot ${justify}`} style={{ opacity: showDelta ? 0 : 1 }}>
        {formatScore(value)}
      </span>
    </span>
  )
}

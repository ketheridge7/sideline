import { useEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
import {
  SCORE_TICK_SETTLE_MS,
  scoreTickChange,
  scoreTickLabel,
  scoreTickLimeT,
  scoreTickPhase
} from '@shared/scoreTick'
import { formatScore } from './format'

const LIME = '#B6FF3B'

const parseHex = (hex: string): [number, number, number] => {
  const raw = hex.replace('#', '')
  return [parseInt(raw.slice(0, 2), 16), parseInt(raw.slice(2, 4), 16), parseInt(raw.slice(4, 6), 16)]
}

const mixHex = (from: string, to: string, t: number): string => {
  const a = parseHex(from)
  const b = parseHex(to)
  const m = a.map((channel, index) => Math.round(channel + (b[index] - channel) * t))
  return `rgb(${m[0]}, ${m[1]}, ${m[2]})`
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
  align?: 'left' | 'right'
}): JSX.Element => {
  const prev = useRef<number | null>(null)
  const [flash, setFlash] = useState<{ delta: number; started: number } | null>(null)
  const [now, setNow] = useState(0)

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
      setFlash(null)
      return
    }
    setFlash({ delta: change.delta, started: performance.now() })
  }, [value])

  useEffect(() => {
    if (!flash) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setFlash(null)
      return
    }
    let frame = 0
    const loop = (stamp: number): void => {
      if (stamp - flash.started >= SCORE_TICK_SETTLE_MS) {
        setFlash(null)
        return
      }
      setNow(stamp)
      frame = window.requestAnimationFrame(loop)
    }
    frame = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(frame)
  }, [flash])

  if (value == null || !Number.isFinite(value)) {
    return <span className={className}>—</span>
  }

  const elapsed = flash ? now - flash.started : 0
  const phase = scoreTickPhase(elapsed, Boolean(flash))
  const limeT = scoreTickLimeT(elapsed, Boolean(flash))
  const color = limeT > 0 ? mixHex(restColor, LIME, limeT) : restColor
  const showDelta = phase === 'delta'
  const justify = align === 'right' ? 'justify-end' : 'justify-start'

  return (
    <span
      className={`score-tick ${className ?? ''}`.trim()}
      style={{ ...style, color }}
      data-score-tick={phase}
    >
      <span className="invisible tabular-nums">{formatScore(value)}</span>
      <span className={`score-tick-slot ${justify}`} style={{ opacity: showDelta ? 1 : 0 }}>
        {scoreTickLabel('delta', value, flash?.delta ?? 0)}
      </span>
      <span className={`score-tick-slot ${justify}`} style={{ opacity: showDelta ? 0 : 1 }}>
        {formatScore(value)}
      </span>
    </span>
  )
}

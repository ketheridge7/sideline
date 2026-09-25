import type { JSX } from 'react'
import { formatDelta } from './format'
import { ScoreTick } from './ScoreTick'

export const HUD_FROST = '#F8FBFF'
export const HUD_FROST_DIM = '#E8E4DC'

export type HudTone = 'you' | 'them'
export type HudSurface = 'overlay' | 'board'

const toneClass = (tone: HudTone): string => (tone === 'you' ? 'text-lime' : 'text-them')

export const HudTeamName = ({
  name,
  tone,
  surface,
  muted
}: {
  name: string
  tone: HudTone
  surface: HudSurface
  muted?: boolean
}): JSX.Element => {
  const side = tone === 'you' ? 'mine' : 'opp'
  const color = muted ? 'text-muted' : toneClass(tone)
  if (surface === 'overlay') {
    return (
      <div
        className={`hud-type-name ${color}`}
        style={tone === 'them' && !muted ? { color: HUD_FROST_DIM } : undefined}
        data-hud="team-name"
        data-hud-side={side}
      >
        <span>{name}</span>
      </div>
    )
  }
  return (
    <div
      className={`truncate text-center font-cond text-4xl font-extrabold uppercase tracking-[0.06em] ${color}`}
      data-hud="team-name"
      data-hud-side={side}
    >
      {name}
    </div>
  )
}

export const HudTeamScore = ({
  value,
  tone,
  surface
}: {
  value: number
  tone: HudTone
  surface: HudSurface
}): JSX.Element => {
  const restColor = HUD_FROST
  const className =
    surface === 'overlay'
      ? 'hud-type-score w-full'
      : 'mt-1 font-cond text-7xl font-extrabold leading-none'
  return (
    <span className="contents" data-hud="team-score" data-hud-side={tone === 'you' ? 'mine' : 'opp'}>
      <ScoreTick value={value} restColor={restColor} align="center" className={className} />
    </span>
  )
}

export const LeadChip = ({
  delta,
  surface
}: {
  delta: number
  surface: HudSurface
}): JSX.Element => {
  const leading = delta > 0
  const trailing = delta < 0
  const deltaClass = leading ? 'text-lime' : trailing ? 'text-air' : 'text-muted'
  const sizeClass =
    surface === 'overlay'
      ? 'hud-type-delta flex h-full items-end tabular-nums'
      : 'text-center font-cond font-extrabold uppercase tracking-[0.14em] tabular-nums text-sm'
  return (
    <div className={`${sizeClass} ${deltaClass}`} data-hud="lead-chip">
      {formatDelta(delta)}
    </div>
  )
}

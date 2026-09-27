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
  muted,
  fontColor = null
}: {
  name: string
  tone: HudTone
  surface: HudSurface
  muted?: boolean
  fontColor?: string | null
}): JSX.Element => {
  const side = tone === 'you' ? 'mine' : 'opp'
  const color = muted ? 'text-muted' : toneClass(tone)
  if (surface === 'overlay') {
    const ink = fontColor ?? (tone === 'them' && !muted ? HUD_FROST_DIM : null)
    return (
      <div
        className={`hud-type-name ${color}`}
        style={ink ? { color: ink } : undefined}
        data-hud="team-name"
        data-hud-side={side}
        data-text-role="teamName"
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
  surface,
  fontColor = null
}: {
  value: number
  tone: HudTone
  surface: HudSurface
  fontColor?: string | null
}): JSX.Element => {
  const restColor = fontColor ?? HUD_FROST
  const className =
    surface === 'overlay'
      ? 'hud-type-score w-full'
      : 'mt-1 font-cond text-7xl font-extrabold leading-none'
  return (
    <span
      className={surface === 'overlay' ? 'block h-full w-full' : 'contents'}
      data-hud="team-score"
      data-hud-side={tone === 'you' ? 'mine' : 'opp'}
      data-text-role={surface === 'overlay' ? 'teamScore' : undefined}
    >
      <ScoreTick value={value} restColor={restColor} align="center" className={className} />
    </span>
  )
}

export const LeadChip = ({
  delta,
  surface,
  plate = false
}: {
  delta: number
  surface: HudSurface
  /** Dark plate + outline. The chip ink stays the semantic lead color. */
  plate?: boolean
}): JSX.Element => {
  const leading = delta > 0
  const trailing = delta < 0
  const deltaClass = leading ? 'text-lime' : trailing ? 'text-air' : 'text-muted'
  const sizeClass =
    surface === 'overlay'
      ? 'hud-type-delta flex h-full items-end tabular-nums'
      : 'text-center font-cond font-extrabold uppercase tracking-[0.14em] tabular-nums text-sm'
  const label = formatDelta(delta)
  const emphasized = surface === 'overlay' && plate
  return (
    <div className={`${sizeClass} ${deltaClass}`} data-hud="lead-chip">
      {emphasized ? <span className="hud-delta-chip">{label}</span> : label}
    </div>
  )
}

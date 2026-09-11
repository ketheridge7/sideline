import { type JSX } from 'react'
import type { OverlayDensity, OverlayWidgetId } from '@shared/overlayLayout'
import type { OverlayHudState, Player, TapeEvent } from '@shared/types'
import { hudLeadMargin, visibleInjury, type HudLeadTone } from '@shared/display'
import { overlayName } from '../shared/format'
import { HudCrawler, ToastChip } from '../shared/HudCrawler'
import { ScoreTick } from '../shared/ScoreTick'
import { resolveDensity, type Density } from './density'
import type { OverlaySurface } from './subscribe'

const FROST = '#F8FBFF'
const FROST_DIM = '#E4EAF1'

const RailColumn = ({
  players,
  field,
  align,
  restColor
}: {
  players: Player[]
  field: 'pos' | 'name' | 'nfl' | 'pts'
  align: 'left' | 'right'
  restColor: string
}): JSX.Element => {
  const rows = Math.max(players.length, 1)
  return (
    <div className="hud-rail flex h-full min-h-0 min-w-0 flex-col">
      {Array.from({ length: rows }, (_, index) => {
        const player = players[index]
        const textAlign = align === 'right' ? 'text-right' : 'text-left'
        const injury = field === 'name' ? visibleInjury(player?.status) : null
        let body: JSX.Element | string = '—'
        let typeClass = 'hud-type-player'
        if (field === 'pos') {
          typeClass = 'hud-type-pos'
          body = player?.position || '—'
        } else if (field === 'name') {
          typeClass = 'hud-type-player'
          body = player ? overlayName(player.name) : '—'
        } else if (field === 'nfl') {
          typeClass = 'hud-type-pos'
          body = player?.nflTeam || '—'
        } else if (field === 'pts') {
          typeClass = 'hud-type-pts'
          body = player ? (
            <ScoreTick
              value={player.points}
              restColor={restColor}
              align={align}
              className="hud-type-pts"
            />
          ) : (
            '—'
          )
        } else {
          const _never: never = field
          body = _never
        }
        return (
          <div
            key={player?.playerId ?? `${field}-${index}`}
            className={`hud-rail-row flex flex-1 items-center ${textAlign}`}
          >
            {typeof body === 'string' ? (
              <span className={`w-full truncate ${typeClass}`}>
                {body}
                {injury ? <span className="ml-1 text-air">{injury}</span> : null}
              </span>
            ) : (
              body
            )}
          </div>
        )
      })}
    </div>
  )
}

const marginToneClass = (tone: HudLeadTone): string => {
  switch (tone) {
    case 'lead':
      return 'hud-margin-lead'
    case 'trail':
      return 'hud-margin-trail'
    case 'tie':
      return 'hud-margin-tie'
    default: {
      const _never: never = tone
      return _never
    }
  }
}

const TeamName = ({
  name,
  tone
}: {
  name: string
  tone: 'you' | 'them'
}): JSX.Element => (
  <div
    className={`hud-type-name flex h-full w-full items-end justify-center text-center ${
      tone === 'you' ? 'text-you' : 'text-them'
    }`}
    data-hud="team-name"
    data-hud-side={tone === 'you' ? 'mine' : 'opp'}
  >
    <span className="min-w-0 truncate">{name}</span>
  </div>
)

const LeadMargin = ({
  delta,
  side
}: {
  delta: number
  side: 'mine' | 'opp'
}): JSX.Element => {
  const margin = hudLeadMargin(delta, side)
  return (
    <div
      className={`hud-type-margin ${marginToneClass(margin.tone)}`}
      data-hud="lead-margin"
      data-hud-tone={margin.tone}
    >
      {margin.label}
    </div>
  )
}

const TeamScore = ({
  value,
  restColor,
  delta,
  side
}: {
  value: number
  restColor: string
  delta: number
  side: 'mine' | 'opp'
}): JSX.Element => (
  <div className="hud-score-stack" data-hud="team-score" data-hud-side={side}>
    <ScoreTick value={value} restColor={restColor} align="center" className="hud-type-score" />
    <LeadMargin delta={delta} side={side} />
  </div>
)

const BenchList = ({
  players,
  density,
  align
}: {
  players: Player[]
  density: Density
  align: 'left' | 'right'
}): JSX.Element => (
  <div className={`flex h-full flex-col justify-end gap-0.5 ${align === 'right' ? 'items-end' : ''}`}>
    {players.slice(0, 8).map((player) => (
      <div
        key={player.playerId}
        className={`truncate font-cond uppercase text-muted ${density === 'large' ? 'text-sm' : 'text-[11px]'}`}
      >
        {overlayName(player.name)}
      </div>
    ))}
  </div>
)

export const OverlayWidgetView = ({
  id,
  hud,
  surface,
  density,
  showCrawler
}: {
  id: OverlayWidgetId
  hud: OverlayHudState
  surface: OverlaySurface
  density: OverlayDensity
  showCrawler: boolean
}): JSX.Element => {
  const resolved = resolveDensity(surface, density)
  switch (id) {
    case 'meta.league':
      return (
        <div className="flex h-full items-center truncate font-medium uppercase tracking-[0.18em] text-[11px] text-muted">
          {hud.leagueName}
        </div>
      )
    case 'meta.week':
      return (
        <div className="flex h-full items-center font-medium uppercase tracking-[0.18em] text-[11px] text-muted">
          {hud.week != null ? `WK ${hud.week}` : '—'}
        </div>
      )
    case 'meta.live':
      if (!hud.pollingLive && !hud.replay) return <></>
      return (
        <div className="flex h-full items-center">
          <span className="live-dot inline-block h-1 w-1 bg-lime" aria-label={hud.replay ? 'Replay' : 'Live'} />
        </div>
      )
    case 'team.mine.name':
      return <TeamName name={hud.myName} tone="you" />
    case 'team.opp.name':
      return <TeamName name={hud.oppName} tone="them" />
    case 'score.mine':
      return (
        <TeamScore value={hud.myPoints} restColor={FROST} delta={hud.delta} side="mine" />
      )
    case 'score.opp':
      return (
        <TeamScore value={hud.oppPoints} restColor={FROST_DIM} delta={hud.delta} side="opp" />
      )
    case 'score.delta': {
      const margin = hudLeadMargin(hud.delta, 'mine')
      return (
        <div
          className={`hud-score-stack ${marginToneClass(margin.tone)}`}
          data-hud="lead-margin-solo"
        >
          <span className="hud-type-margin">{margin.label}</span>
        </div>
      )
    }
    case 'col.mine.pos':
      return <RailColumn players={hud.myStarters} field="pos" align="left" restColor={FROST} />
    case 'col.mine.name':
      return <RailColumn players={hud.myStarters} field="name" align="left" restColor={FROST} />
    case 'col.mine.nfl':
      return <RailColumn players={hud.myStarters} field="nfl" align="left" restColor={FROST} />
    case 'col.mine.pts':
      return <RailColumn players={hud.myStarters} field="pts" align="right" restColor={FROST} />
    case 'col.opp.pos':
      return <RailColumn players={hud.oppStarters} field="pos" align="left" restColor={FROST_DIM} />
    case 'col.opp.name':
      return <RailColumn players={hud.oppStarters} field="name" align="left" restColor={FROST_DIM} />
    case 'col.opp.nfl':
      return <RailColumn players={hud.oppStarters} field="nfl" align="left" restColor={FROST_DIM} />
    case 'col.opp.pts':
      return <RailColumn players={hud.oppStarters} field="pts" align="right" restColor={FROST_DIM} />
    case 'bench.mine':
      return <BenchList players={hud.myBench} density={resolved} align="left" />
    case 'bench.opp':
      return <BenchList players={hud.oppBench} density={resolved} align="right" />
    case 'toast.slot': {
      const events: TapeEvent[] =
        hud.tape.length > 0
          ? hud.tape
          : hud.toast
            ? [
                {
                  id: hud.toast.id,
                  at: Date.now(),
                  kind: 'status',
                  player: hud.toast.title,
                  detail: hud.toast.body
                }
              ]
            : []
      return showCrawler ? <HudCrawler events={events} /> : <ToastChip events={events} />
    }
    default: {
      const _never: never = id
      return _never
    }
  }
}

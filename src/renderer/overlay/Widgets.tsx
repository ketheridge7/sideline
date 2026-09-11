import { type JSX } from 'react'
import type { OverlayDensity, OverlayWidgetId } from '@shared/overlayLayout'
import type { OverlayHudState, Player, TapeEvent } from '@shared/types'
import { formatDelta, overlayName } from '../shared/format'
import { HudCrawler, ToastChip } from '../shared/HudCrawler'
import { HudRail } from '../shared/LineupRow'
import { ScoreTick } from '../shared/ScoreTick'
import { resolveDensity, type Density } from './density'
import type { OverlaySurface } from './subscribe'

const FROST = '#F8FBFF'
const FROST_DIM = '#E8E4DC'

const TeamName = ({
  name,
  tone
}: {
  name: string
  tone: 'you' | 'them'
}): JSX.Element => (
  <div
    className={`hud-type-name ${tone === 'you' ? 'text-you' : 'text-them'}`}
    data-hud="team-name"
    data-hud-side={tone === 'you' ? 'mine' : 'opp'}
  >
    <span>{name}</span>
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
        <ScoreTick value={hud.myPoints} restColor={FROST} align="center" className="hud-type-score w-full" />
      )
    case 'score.opp':
      return (
        <ScoreTick
          value={hud.oppPoints}
          restColor={FROST_DIM}
          align="center"
          className="hud-type-score w-full"
        />
      )
    case 'score.delta': {
      const leading = hud.delta > 0
      const trailing = hud.delta < 0
      const deltaClass = leading ? 'text-you' : trailing ? 'text-air' : 'text-muted'
      return (
        <div className={`hud-type-delta flex h-full items-end tabular-nums ${deltaClass}`}>
          {formatDelta(hud.delta)}
        </div>
      )
    }
    case 'col.mine.name':
      return <HudRail players={hud.myStarters} you />
    case 'col.opp.name':
      return <HudRail players={hud.oppStarters} />
    case 'col.mine.pos':
    case 'col.mine.nfl':
    case 'col.mine.pts':
    case 'col.opp.pos':
    case 'col.opp.nfl':
    case 'col.opp.pts':
      return <></>
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

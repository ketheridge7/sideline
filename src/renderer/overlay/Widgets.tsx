import { type JSX } from 'react'
import type { OverlayDensity, OverlayWidgetId } from '@shared/overlayLayout'
import type { OverlayHudState, Player, TapeEvent } from '@shared/types'
import { overlayName } from '../shared/format'
import { HudTeamName, HudTeamScore, LeadChip } from '../shared/HudChrome'
import { HudCrawler, ToastChip } from '../shared/HudCrawler'
import { HudRail } from '../shared/LineupRow'
import { NflTicker } from '../companion/NflTicker'
import { resolveDensity, type Density } from './density'
import type { OverlaySurface } from './subscribe'

const BenchList = ({
  players,
  density,
  align,
  fontColor
}: {
  players: Player[]
  density: Density
  align: 'left' | 'right'
  fontColor: string | null
}): JSX.Element => (
  <div className={`flex h-full flex-col justify-end gap-0.5 ${align === 'right' ? 'items-end' : ''}`}>
    {players.slice(0, 8).map((player) => (
      <div
        key={player.playerId}
        className={`truncate font-cond uppercase text-muted ${density === 'large' ? 'text-sm' : 'text-[11px]'}`}
        style={fontColor ? { color: fontColor } : undefined}
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
  showCrawler,
  fontColor = null
}: {
  id: OverlayWidgetId
  hud: OverlayHudState
  surface: OverlaySurface
  density: OverlayDensity
  showCrawler: boolean
  fontColor?: string | null
}): JSX.Element => {
  const resolved = resolveDensity(surface, density)
  const ink = fontColor ?? null
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
      return <></>
    case 'team.mine.name':
      return <HudTeamName name={hud.myName} tone="you" surface="overlay" fontColor={ink} />
    case 'team.opp.name':
      return <HudTeamName name={hud.oppName} tone="them" surface="overlay" fontColor={ink} />
    case 'score.mine':
      return (
        <HudTeamScore
          key={`${hud.leagueName}:${hud.myName}`}
          value={hud.myPoints}
          tone="you"
          surface="overlay"
          fontColor={ink}
        />
      )
    case 'score.opp':
      return (
        <HudTeamScore
          key={`${hud.leagueName}:${hud.oppName}`}
          value={hud.oppPoints}
          tone="them"
          surface="overlay"
          fontColor={ink}
        />
      )
    case 'score.delta':
      return <LeadChip delta={hud.delta} surface="overlay" fontColor={ink} />
    case 'col.mine.name':
      return <HudRail players={hud.myStarters} you fontColor={ink} />
    case 'col.opp.name':
      return <HudRail players={hud.oppStarters} fontColor={ink} />
    case 'col.mine.pos':
    case 'col.mine.nfl':
    case 'col.mine.pts':
    case 'col.opp.pos':
    case 'col.opp.nfl':
    case 'col.opp.pts':
      return <></>
    case 'bench.mine':
      return <BenchList players={hud.myBench} density={resolved} align="left" fontColor={ink} />
    case 'bench.opp':
      return <BenchList players={hud.oppBench} density={resolved} align="right" fontColor={ink} />
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
    case 'ticker.nfl':
      return <NflTicker games={hud.nflTicker} variant="overlay" />
    default: {
      const _never: never = id
      return _never
    }
  }
}

import { type JSX } from 'react'
import {
  EMPTY_HUD_TEXT_COLORS,
  hudTextColorsCustom,
  resolveHudTextColor,
  type HudTextColors,
  type OverlayDensity,
  type OverlayWidgetId
} from '@shared/overlayLayout'
import type { OverlayHudState, Player, TapeEvent } from '@shared/types'
import { overlayName } from '../shared/format'
import { HUD_FROST, HudTeamName, HudTeamScore, LeadChip } from '../shared/HudChrome'
import { HudCrawler, ToastChip } from '../shared/HudCrawler'
import { HudRail } from '../shared/LineupRow'
import { PlayerGameProvider, useShownPlayerPoints } from '../shared/playerGame'
import { ScoreTick } from '../shared/ScoreTick'
import { NflTicker } from '../companion/NflTicker'
import { resolveDensity, type Density } from './density'
import type { OverlaySurface } from './subscribe'

const BenchScore = ({
  player,
  align,
  playerScoreColor
}: {
  player: Player
  align: 'left' | 'right'
  playerScoreColor: string | null
}): JSX.Element => {
  const shownPoints = useShownPlayerPoints(player.nflTeam, player.points)
  return (
    <span className="shrink-0" data-text-role="playerScore" data-lineup-col="pts">
      <ScoreTick
        value={shownPoints}
        restColor={playerScoreColor ?? HUD_FROST}
        align={align === 'right' ? 'left' : 'right'}
        className="font-cond text-[1em] font-bold"
      />
    </span>
  )
}

const BenchList = ({
  players,
  density,
  align,
  playerNameColor,
  playerScoreColor
}: {
  players: Player[]
  density: Density
  align: 'left' | 'right'
  playerNameColor: string | null
  playerScoreColor: string | null
}): JSX.Element => (
  <div className={`flex h-full flex-col justify-end gap-0.5 ${align === 'right' ? 'items-end' : ''}`}>
    {players.slice(0, 8).map((player) => (
      <div
        key={player.playerId}
        className={`flex w-full min-w-0 items-baseline gap-2 font-cond uppercase text-muted ${
          align === 'right' ? 'flex-row-reverse' : ''
        } ${density === 'large' ? 'text-sm' : 'text-[11px]'}`}
      >
        <span
          className="min-w-0 truncate"
          data-text-role="playerName"
          style={playerNameColor ? { color: playerNameColor } : undefined}
        >
          {overlayName(player.name)}
        </span>
        <BenchScore player={player} align={align} playerScoreColor={playerScoreColor} />
      </div>
    ))}
  </div>
)

const OverlayWidgetBody = ({
  id,
  hud,
  surface,
  density,
  showCrawler,
  textColors = EMPTY_HUD_TEXT_COLORS
}: {
  id: OverlayWidgetId
  hud: OverlayHudState
  surface: OverlaySurface
  density: OverlayDensity
  showCrawler: boolean
  textColors?: HudTextColors
}): JSX.Element => {
  const resolved = resolveDensity(surface, density)
  const playerName = resolveHudTextColor(textColors, 'playerName')
  const teamName = resolveHudTextColor(textColors, 'teamName')
  const teamScore = resolveHudTextColor(textColors, 'teamScore')
  const playerScore = resolveHudTextColor(textColors, 'playerScore')
  const plate = hudTextColorsCustom(textColors)
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
      return <HudTeamName name={hud.myName} tone="you" surface="overlay" fontColor={teamName} />
    case 'team.opp.name':
      return <HudTeamName name={hud.oppName} tone="them" surface="overlay" fontColor={teamName} />
    case 'score.mine':
      return (
        <HudTeamScore
          key={`${hud.leagueName}:${hud.myName}`}
          value={hud.myPoints}
          tone="you"
          surface="overlay"
          fontColor={teamScore}
        />
      )
    case 'score.opp':
      return (
        <HudTeamScore
          key={`${hud.leagueName}:${hud.oppName}`}
          value={hud.oppPoints}
          tone="them"
          surface="overlay"
          fontColor={teamScore}
        />
      )
    case 'score.delta':
      return <LeadChip delta={hud.delta} surface="overlay" plate={plate} />
    case 'col.mine.name':
      return (
        <HudRail
          players={hud.myStarters}
          you
          playerNameColor={playerName}
          playerScoreColor={playerScore}
        />
      )
    case 'col.opp.name':
      return (
        <HudRail players={hud.oppStarters} playerNameColor={playerName} playerScoreColor={playerScore} />
      )
    case 'col.mine.pos':
    case 'col.mine.nfl':
    case 'col.mine.pts':
    case 'col.opp.pos':
    case 'col.opp.nfl':
    case 'col.opp.pts':
      return <></>
    case 'bench.mine':
      return (
        <BenchList
          players={hud.myBench}
          density={resolved}
          align="left"
          playerNameColor={playerName}
          playerScoreColor={playerScore}
        />
      )
    case 'bench.opp':
      return (
        <BenchList
          players={hud.oppBench}
          density={resolved}
          align="right"
          playerNameColor={playerName}
          playerScoreColor={playerScore}
        />
      )
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

export const OverlayWidgetView = ({
  id,
  hud,
  surface,
  density,
  showCrawler,
  textColors = EMPTY_HUD_TEXT_COLORS
}: {
  id: OverlayWidgetId
  hud: OverlayHudState
  surface: OverlaySurface
  density: OverlayDensity
  showCrawler: boolean
  textColors?: HudTextColors
}): JSX.Element => (
  <PlayerGameProvider games={hud.nflTicker} slate={hud.nflSlate}>
    <OverlayWidgetBody
      id={id}
      hud={hud}
      surface={surface}
      density={density}
      showCrawler={showCrawler}
      textColors={textColors}
    />
  </PlayerGameProvider>
)

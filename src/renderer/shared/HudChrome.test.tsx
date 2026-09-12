import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { emptyAppState, toOverlayHud, type Matchup, type Player } from '@shared/types'
import { OverlayWidgetView } from '../overlay/Widgets'
import { HudScoreboard } from './HudScoreboard'
import { BoardRails, HudRail } from './LineupRow'

const player = (row: Partial<Player> & Pick<Player, 'playerId' | 'name' | 'position'>): Player => ({
  nflTeam: 'SF',
  ...row
})

const matchup: Matchup = {
  myTeam: { id: 'a', name: 'Gibbs Me Head', owner: 'Me', record: '1-0' },
  oppTeam: { id: 'b', name: 'The Other Guys', owner: 'You', record: '0-1' },
  myPoints: 142.8,
  oppPoints: 131.2,
  starters: [
    player({ playerId: 'cmc', name: 'Christian McCaffrey', position: 'RB', points: 11.9 })
  ],
  bench: [],
  oppStarters: [player({ playerId: 'mevis', name: 'Jake Mevis', position: 'K', points: 1.0 })],
  oppBench: []
}

const hud = toOverlayHud({
  ...emptyAppState(),
  matchup,
  selectedLeagueKey: 'sleeper:1',
  leagues: [{ id: '1', name: 'Homies', provider: 'sleeper', season: '2026', week: 1 }]
})

describe('HudChrome parity', () => {
  it('paints SCOREBOARD and overlay names, scores, lead chip, and rails from the same tokens', () => {
    const board = renderToStaticMarkup(<HudScoreboard matchup={matchup} />)
    const youName = renderToStaticMarkup(
      <OverlayWidgetView id="team.mine.name" hud={hud} surface="desktop" density="regular" showCrawler={false} />
    )
    const themName = renderToStaticMarkup(
      <OverlayWidgetView id="team.opp.name" hud={hud} surface="desktop" density="regular" showCrawler={false} />
    )
    const youScore = renderToStaticMarkup(
      <OverlayWidgetView id="score.mine" hud={hud} surface="desktop" density="regular" showCrawler={false} />
    )
    const lead = renderToStaticMarkup(
      <OverlayWidgetView id="score.delta" hud={hud} surface="desktop" density="regular" showCrawler={false} />
    )
    const overlayRail = renderToStaticMarkup(
      <OverlayWidgetView id="col.mine.name" hud={hud} surface="desktop" density="regular" showCrawler={false} />
    )
    const boardRails = renderToStaticMarkup(
      <BoardRails mine={matchup.starters} opp={matchup.oppStarters} />
    )
    const overlayHudRail = renderToStaticMarkup(<HudRail you players={matchup.starters} />)

    expect(board).toContain('data-hud="team-name"')
    expect(board).toContain('data-hud-side="mine"')
    expect(board).toContain('text-you')
    expect(board).toContain('text-them')
    expect(board).toContain('data-hud="lead-chip"')
    expect(board).toContain('+11.6')
    expect(board).toContain('text-center')
    expect(youName).toContain('text-you')
    expect(youName).toContain('data-hud="team-name"')
    expect(themName).toContain('text-them')
    expect(youScore).toContain('data-hud="team-score"')
    expect(lead).toContain('data-hud="lead-chip"')
    expect(lead).toContain('+11.6')
    expect(lead).toContain('text-you')

    for (const html of [overlayRail, overlayHudRail, boardRails]) {
      expect(html).toContain('data-hud-rail="mine"')
      expect(html.indexOf('data-lineup-col="pos"')).toBeLessThan(html.indexOf('data-lineup-col="name"'))
      expect(html.indexOf('data-lineup-col="name"')).toBeLessThan(html.indexOf('data-lineup-col="pts"'))
      expect(html).toContain('11.9')
    }
    expect(boardRails).toContain('data-hud-rail="opp"')
    expect(boardRails).toContain('1.0')
  })
})

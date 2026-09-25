import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { emptyAppState, toOverlayHud, type Matchup, type Player } from '@shared/types'
import { OverlayWidgetView } from '../overlay/Widgets'
import { HudBench } from './HudBench'
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
    const themScore = renderToStaticMarkup(
      <OverlayWidgetView id="score.opp" hud={hud} surface="desktop" density="regular" showCrawler={false} />
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
    expect(board).toContain('text-lime')
    expect(board).toContain('text-them')
    expect(board).toContain('data-hud="lead-chip"')
    expect(board).toContain('+11.6')
    expect(board).toContain('text-center')
    expect(youName).toContain('text-lime')
    expect(youName).not.toContain('text-you')
    expect(youName).toContain('data-hud="team-name"')
    expect(themName).toContain('text-them')
    expect(themName).not.toContain('text-lime')
    expect(youScore).toContain('data-hud="team-score"')
    expect(youScore).toContain('#F8FBFF')
    expect(themScore).toContain('data-hud-side="opp"')
    expect(themScore).toContain('#F8FBFF')
    expect(themScore).not.toContain('#E8E4DC')
    expect(board).toContain('#F8FBFF')
    expect(board).not.toContain('#E8E4DC')
    expect(lead).toContain('data-hud="lead-chip"')
    expect(lead).toContain('+11.6')
    expect(lead).toContain('text-lime')

    for (const html of [overlayRail, overlayHudRail, boardRails]) {
      expect(html).toContain('data-hud-rail="mine"')
      expect(html.indexOf('data-lineup-col="pos"')).toBeLessThan(html.indexOf('data-lineup-col="name"'))
      expect(html.indexOf('data-lineup-col="name"')).toBeLessThan(html.indexOf('data-lineup-col="pts"'))
      expect(html).toContain('11.9')
    }
    expect(boardRails).toContain('data-hud-rail="opp"')
    expect(boardRails).toContain('1.0')
    expect(boardRails.match(/>Starters<\/h2>/g)?.length).toBe(2)
    expect(boardRails).toContain('text-lime">Starters</h2>')
    expect(boardRails).toContain('text-them">Starters</h2>')
    expect(boardRails).not.toContain('text-you">Starters</h2>')
    expect(boardRails).not.toContain('>You</h2>')
    expect(boardRails).not.toContain('>Them</h2>')
    expect(overlayHudRail).not.toContain('>Starters</h2>')
    expect(overlayHudRail).not.toContain('>You</h2>')
    expect(overlayHudRail).not.toContain('>Them</h2>')
  })

  it('labels SCOREBOARD chance-to-win from the provider win% field, not score-share', () => {
    const published: Matchup = {
      ...matchup,
      myPoints: 0,
      oppPoints: 0,
      myWinPct: 0.99,
      oppWinPct: 0.01
    }
    const html = renderToStaticMarkup(<HudScoreboard matchup={published} />)
    expect(html).toContain('Chance to win')
    expect(html).toContain('data-hud="win-pct"')
    expect(html).toContain('99% Win')
    expect(html).toContain('1% Win')
    expect(html).not.toContain('Win% pending')
    expect(html).toContain('text-lime">Chance to win')
    expect(html).toContain('data-hud-win-pct-fill="mine"')
    expect(html).toContain('bg-lime')
    expect(html).toContain('data-hud-win-pct-fill="opp"')
    expect(html).toContain('bg-them/50')
    expect(html).toMatch(/data-hud-side="mine"[^>]*text-lime|text-lime"[^>]*data-hud-side="mine"/)
    expect(html).toMatch(/data-hud-side="opp"[^>]*text-muted|text-muted"[^>]*data-hud-side="opp"/)
    const pending = renderToStaticMarkup(<HudScoreboard matchup={matchup} />)
    expect(pending).toContain('Win% pending')
    expect(pending).toContain('data-hud-win-pct="pending"')
    const fromProj = renderToStaticMarkup(
      <HudScoreboard
        matchup={{ ...matchup, myPoints: 0, oppPoints: 0, myProjectedPoints: 140, oppProjectedPoints: 80 }}
      />
    )
    expect(fromProj).toContain('Win% pending')
    expect(fromProj).toContain('Chance to win')
    expect(fromProj).not.toContain('Est. win%')
    const estimated = renderToStaticMarkup(
      <HudScoreboard
        matchup={{
          ...matchup,
          myPoints: 0,
          oppPoints: 0,
          myProjectedPoints: 140,
          oppProjectedPoints: 80,
          winPctSource: 'estimated'
        }}
      />
    )
    expect(estimated).toContain('Est. win%')
    expect(estimated).toContain('text-lime">Est. win%')
    expect(estimated).toContain('Est.')
    expect(estimated).not.toContain('Chance to win')
    expect(estimated).not.toContain('Win% pending')
    const estPending = renderToStaticMarkup(
      <HudScoreboard matchup={{ ...matchup, winPctSource: 'estimated' }} />
    )
    expect(estPending).toContain('Est. win% pending')
    expect(estPending).toContain('text-lime">Est. win%')
    expect(estPending).not.toContain('Chance to win')
  })

  it('paints you-side Bench lime and leaves opponent Bench silver', () => {
    const mine = renderToStaticMarkup(
      <HudBench
        label="Bench"
        players={[player({ playerId: 'bn', name: 'George Kittle', position: 'TE', points: 4.2 })]}
      />
    )
    const opp = renderToStaticMarkup(
      <HudBench
        label="Bench"
        mirror
        players={[player({ playerId: 'obn', name: 'Nico Collins', position: 'WR', points: 3.1 })]}
      />
    )
    const emptyMine = renderToStaticMarkup(<HudBench label="Bench" players={[]} />)
    const emptyOpp = renderToStaticMarkup(<HudBench label="Bench" players={[]} mirror />)
    expect(mine).toContain('text-lime')
    expect(mine).toContain('Bench')
    expect(mine).not.toContain('text-you')
    expect(opp).toContain('text-them')
    expect(opp).toContain('Bench')
    expect(opp).not.toContain('text-lime')
    expect(emptyMine).toContain('text-lime')
    expect(emptyOpp).toContain('text-them')
    expect(emptyOpp).not.toContain('text-lime')
  })

  it('paints a positive lead chip with the same lime as the team name', () => {
    const board = renderToStaticMarkup(<HudScoreboard matchup={matchup} />)
    expect(board).toContain('data-hud="lead-chip"')
    expect(board).toContain('+11.6')
    expect(board).toMatch(/text-lime[^"]*"[^>]*data-hud="lead-chip"|data-hud="lead-chip"[^>]*text-lime/)
    expect(board).not.toMatch(/data-hud="lead-chip"[^>]*text-you/)
    const trailing = renderToStaticMarkup(
      <HudScoreboard matchup={{ ...matchup, myPoints: 90, oppPoints: 110 }} />
    )
    expect(trailing).toMatch(/data-hud="lead-chip"[^>]*text-air|text-air[^"]*"[^>]*data-hud="lead-chip"/)
  })
})

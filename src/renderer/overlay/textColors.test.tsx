import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EMPTY_HUD_TEXT_COLORS, type HudTextColors } from '@shared/overlayLayout'
import { emptyAppState, toOverlayHud, type Matchup, type Player } from '@shared/types'
import type { OverlaySurface } from './subscribe'
import { OverlayWidgetView } from './Widgets'

const player = (row: Partial<Player> & Pick<Player, 'playerId' | 'name' | 'position'>): Player => ({
  nflTeam: 'SF',
  ...row
})

const matchup: Matchup = {
  myTeam: { id: 'a', name: 'Ice Box', owner: 'Me', record: '1-0' },
  oppTeam: { id: 'b', name: 'The Other Guys', owner: 'You', record: '0-1' },
  myPoints: 98.4,
  oppPoints: 91.2,
  starters: [
    player({ playerId: 'cmc', name: 'Christian McCaffrey', position: 'RB', points: 18.4, status: 'Questionable' })
  ],
  bench: [player({ playerId: 'kittle', name: 'George Kittle', position: 'TE', points: 4.2 })],
  oppStarters: [player({ playerId: 'mevis', name: 'Jake Mevis', position: 'K', points: 1 })],
  oppBench: []
}

const hud = toOverlayHud({
  ...emptyAppState(),
  matchup,
  selectedLeagueKey: 'sleeper:1',
  leagues: [{ id: '1', name: 'Homies', provider: 'sleeper', season: '2026', week: 1 }],
  nflTicker: [{ id: 'g1', away: 'KC', awayScore: 14, home: 'SF', homeScore: 10, clock: 'Final', final: true }]
})

const colors: HudTextColors = {
  all: '#FFFFFF',
  playerName: '#B6FF3B',
  teamName: '#E8E4DC',
  teamScore: '#8ECAFF',
  playerScore: '#F8FBFF'
}

const paint = (id: Parameters<typeof OverlayWidgetView>[0]['id'], surface: OverlaySurface, textColors: HudTextColors): string =>
  renderToStaticMarkup(
    <OverlayWidgetView id={id} hud={hud} surface={surface} density="inherit" showCrawler={false} textColors={textColors} />
  )

const col = (html: string, field: 'pos' | 'name' | 'pts'): string =>
  html.match(new RegExp(`data-lineup-col="${field}"[\\s\\S]*?</span>`))?.[0] ?? ''

describe('overlay text colors', () => {
  it('falls back to Sunday Tape defaults when every color is Ice', () => {
    for (const surface of ['desktop', 'tv'] as const) {
      const youName = paint('team.mine.name', surface, EMPTY_HUD_TEXT_COLORS)
      const themName = paint('team.opp.name', surface, EMPTY_HUD_TEXT_COLORS)
      const score = paint('score.mine', surface, EMPTY_HUD_TEXT_COLORS)
      const rail = paint('col.mine.name', surface, EMPTY_HUD_TEXT_COLORS)
      const lead = paint('score.delta', surface, EMPTY_HUD_TEXT_COLORS)
      expect(youName).toContain('text-lime')
      expect(youName).not.toContain('style="color:')
      expect(themName).toContain('#E8E4DC')
      expect(score).toContain('#F8FBFF')
      expect(col(rail, 'name')).not.toContain('style="color:')
      expect(col(rail, 'pts')).toContain('#F8FBFF')
      expect(col(rail, 'pos')).not.toContain('style=')
      expect(lead).toContain('text-lime')
      expect(lead).not.toContain('hud-delta-chip')
    }
  })

  it('applies each role on the HUD and the TV overlay, and leaves chip, injury, and position alone', () => {
    for (const surface of ['desktop', 'tv'] as const) {
      const youName = paint('team.mine.name', surface, colors)
      const themName = paint('team.opp.name', surface, colors)
      const score = paint('score.mine', surface, colors)
      const rail = paint('col.mine.name', surface, colors)
      const bench = paint('bench.mine', surface, colors)
      const lead = paint('score.delta', surface, colors)
      const ticker = paint('ticker.nfl', surface, colors)

      expect(youName).toContain('data-text-role="teamName"')
      expect(youName).toContain('style="color:#E8E4DC"')
      expect(themName).toContain('style="color:#E8E4DC"')
      expect(score).toContain('data-text-role="teamScore"')
      expect(score).toContain('color:#8ECAFF')
      expect(col(rail, 'name')).toContain('data-text-role="playerName"')
      expect(col(rail, 'name')).toContain('color:#B6FF3B')
      expect(col(rail, 'name')).toContain('text-air')
      expect(col(rail, 'pts')).toContain('data-text-role="playerScore"')
      expect(col(rail, 'pts')).toContain('color:#F8FBFF')
      expect(col(rail, 'pos')).not.toContain('#B6FF3B')
      expect(col(rail, 'pos')).not.toContain('#FFFFFF')
      expect(col(rail, 'pos')).not.toContain('style=')
      expect(bench).toContain('Kittle')
      expect(bench).toContain('color:#B6FF3B')
      expect(bench).toContain('color:#F8FBFF')
      expect(bench).toContain('4.2')
      expect(lead).toContain('text-lime')
      expect(lead).toContain('hud-delta-chip')
      expect(lead).not.toContain('#B6FF3B')
      expect(lead).not.toContain('#8ECAFF')
      expect(lead).not.toContain('#E8E4DC')
      expect(ticker).toContain('text-air')
      expect(ticker).not.toContain('#B6FF3B')
      expect(ticker).not.toContain('#8ECAFF')
    }
  })

  it('uses all for a role that has no override', () => {
    const inherited: HudTextColors = {
      ...EMPTY_HUD_TEXT_COLORS,
      all: '#FFFFFF',
      teamName: '#B6FF3B'
    }
    const rail = paint('col.mine.name', 'desktop', inherited)
    const name = paint('team.mine.name', 'tv', inherited)
    expect(col(rail, 'name')).toContain('color:#FFFFFF')
    expect(col(rail, 'pts')).toContain('color:#FFFFFF')
    expect(name).toContain('color:#B6FF3B')
    expect(paint('score.delta', 'tv', inherited)).toContain('hud-delta-chip')
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { emptyAppState, toOverlayHud, type NflTickerGame, type Player } from '@shared/types'
import { OverlayWidgetView } from '../overlay/Widgets'
import { HudTeamScore } from './HudChrome'
import { HudBench } from './HudBench'
import { BoardRails, HudRail, LineupRow } from './LineupRow'
import { PlayerGameProvider } from './playerGame'

const player = (row: Partial<Player> & Pick<Player, 'playerId' | 'name' | 'position'>): Player => ({
  nflTeam: 'SF',
  ...row
})

const col = (html: string, field: 'pos' | 'name' | 'pts'): string => {
  const match = html.match(new RegExp(`data-lineup-col="${field}"[\\s\\S]*?</span>`))
  return match?.[0] ?? ''
}

describe('LineupRow', () => {
  it('locks POS | NAME | PTS as a three-column grid for live points and dashes', () => {
    const scored = renderToStaticMarkup(
      <LineupRow
        player={player({ playerId: 'cmc', name: 'Christian McCaffrey', position: 'RB', points: 11.9 })}
        you
      />
    )
    const kicker = renderToStaticMarkup(
      <LineupRow player={player({ playerId: 'mevis', name: 'Jake Mevis', position: 'K', points: 1.0 })} you />
    )
    const dash = renderToStaticMarkup(
      <LineupRow player={player({ playerId: 'herbert', name: 'Justin Herbert', position: 'QB' })} you />
    )
    const css = readFileSync(resolve(__dirname, '../styles.css'), 'utf8')
    expect(css).toContain('grid-template-columns: 3.25em minmax(0, 1fr) 3.75em')
    expect(css).toMatch(/\.hud-rail-row \{[^}]*grid-template-columns: calc\(var\(--hud-pos[^)]*\) \* 2\.6\) minmax\(0, 1fr\) calc\(var\(--hud-pts[^)]*\) \* 2\.4\)/)
    for (const html of [scored, kicker, dash]) {
      expect(html).toContain('lineup-row')
      expect(html.indexOf('data-lineup-col="pos"')).toBeLessThan(html.indexOf('data-lineup-col="name"'))
      expect(html.indexOf('data-lineup-col="name"')).toBeLessThan(html.indexOf('data-lineup-col="pts"'))
      expect(col(html, 'pos')).not.toMatch(/11\.9|1\.0|—/)
    }
    expect(col(scored, 'pos')).toContain('RB')
    expect(col(scored, 'name')).toContain('Christian McCaffrey')
    expect(col(scored, 'pts')).toContain('11.9')
    expect(col(scored, 'pos')).not.toContain('11.9')
    expect(col(kicker, 'pos')).toContain('K')
    expect(col(kicker, 'pts')).toContain('1.0')
    expect(col(kicker, 'pos')).not.toContain('1.0')
    expect(col(kicker, 'name')).not.toContain('1.0')
    expect(col(dash, 'pos')).toContain('QB')
    expect(col(dash, 'pts')).toContain('—')
    expect(col(dash, 'pos')).not.toContain('—')
  })

  it('does not paint a ? placeholder in the POS column', () => {
    const html = renderToStaticMarkup(
      <LineupRow player={player({ playerId: '4034', name: 'George Kittle', position: '?' })} you />
    )
    expect(col(html, 'pos')).toContain('—')
    expect(col(html, 'pos')).not.toContain('?')
    expect(col(html, 'name')).toContain('George Kittle')
  })

  it('keeps the same POS | NAME | PTS order on the opponent rail', () => {
    const html = renderToStaticMarkup(
      <LineupRow player={player({ playerId: 'dart', name: 'Drake Maye', position: 'QB', points: 0 })} />
    )
    expect(html.indexOf('data-lineup-col="pos"')).toBeLessThan(html.indexOf('data-lineup-col="pts"'))
    expect(col(html, 'pos')).toContain('QB')
    expect(col(html, 'pts')).toContain('0.0')
  })
})

const kickedOff: NflTickerGame[] = [
  { id: 'dal-nyg', away: 'DAL', awayScore: 28, home: 'NYG', homeScore: 14, clock: 'FINAL', final: true },
  { id: 'buf-mia', away: 'BUF', awayScore: 24, home: 'MIA', homeScore: 17, clock: '2ND 4:03' }
]

const weekSlate = ['DAL', 'NYG', 'BUF', 'MIA', 'GB', 'CHI']

const withGames = (node: ReactElement): string =>
  renderToStaticMarkup(
    <PlayerGameProvider games={kickedOff} slate={weekSlate}>
      {node}
    </PlayerGameProvider>
  )

describe('player points before kickoff', () => {
  it('dashes a stored 0 until that NFL game starts, then shows 0.0', () => {
    const waiting = withGames(
      <LineupRow player={player({ playerId: 'love', name: 'Jordan Love', position: 'QB', nflTeam: 'GB', points: 0 })} you />
    )
    const started = withGames(
      <LineupRow
        player={player({ playerId: 'aubrey', name: 'Brandon Aubrey', position: 'K', nflTeam: 'DAL', points: 0 })}
        you
      />
    )
    const live = withGames(
      <LineupRow
        player={player({ playerId: 'achane', name: "De'Von Achane", position: 'RB', nflTeam: 'MIA', points: 0 })}
        you
      />
    )
    expect(col(waiting, 'pts')).toContain('—')
    expect(col(waiting, 'pts')).not.toContain('0.0')
    expect(col(started, 'pts')).toContain('0.0')
    expect(col(live, 'pts')).toContain('0.0')
  })

  it('shows 0.0 after kickoff when the provider has not posted an actual yet', () => {
    const html = withGames(
      <LineupRow player={player({ playerId: 'london', name: 'Drake London', position: 'WR', nflTeam: 'MIA' })} />
    )
    expect(col(html, 'pts')).toContain('0.0')
  })

  it('keeps a bye dash and a Thursday final score', () => {
    const bye = withGames(
      <LineupRow player={player({ playerId: 'bye', name: 'Bye Back', position: 'RB', nflTeam: 'LV' })} you />
    )
    const thursday = withGames(
      <LineupRow
        player={player({ playerId: 'dak', name: 'Dak Prescott', position: 'QB', nflTeam: 'DAL', points: 18.8 })}
        you
      />
    )
    expect(col(bye, 'pts')).toContain('—')
    expect(col(thursday, 'pts')).toContain('18.8')
  })

  it('leaves the team total numeric while a not-started starter and bench player dash', () => {
    const html = withGames(
      <>
        <HudTeamScore value={54.02} tone="you" surface="board" />
        <BoardRails
          mine={[player({ playerId: 'love', name: 'Jordan Love', position: 'QB', nflTeam: 'GB', points: 0 })]}
          opp={[player({ playerId: 'dak', name: 'Dak Prescott', position: 'QB', nflTeam: 'DAL', points: 18.8 })]}
          mineBench={[player({ playerId: 'swift', name: "D'Andre Swift", position: 'RB', nflTeam: 'CHI', points: 5.4 })]}
          oppBench={[player({ playerId: 'bye', name: 'Bye Back', position: 'RB', nflTeam: 'LV', points: 0 })]}
        />
        <LineupRow
          player={player({ playerId: 'swift', name: 'Andre Swift', position: 'RB', nflTeam: 'CHI', points: 5.4 })}
          you
          fixed
        />
        <LineupRow
          player={player({ playerId: 'bye', name: 'Bye Back', position: 'RB', nflTeam: 'LV', points: 0 })}
          fixed
        />
      </>
    )
    const pts = (name: string): string => {
      const chunk = html.split('data-lineup-row=').find((row) => row.includes(name))
      expect(chunk, name).toBeTruthy()
      return chunk?.match(/data-lineup-col="pts"[\s\S]*?<\/span>/)?.[0] ?? ''
    }
    expect(html).toContain('data-hud="team-score"')
    expect(html).toContain('54.0')
    expect(html).toContain('data-bench-foot="mine"')
    expect(pts('Jordan Love')).toContain('—')
    expect(pts('Jordan Love')).not.toContain('0.0')
    expect(pts('Andre Swift')).toContain('—')
    expect(pts('Andre Swift')).not.toContain('5.4')
    expect(pts('Dak Prescott')).toContain('18.8')
    expect(pts('Bye Back')).toContain('0.0')
  })

  it('dashes overlay and TV starter and bench chips from the same scoreboard', () => {
    const hud = toOverlayHud({
      ...emptyAppState(),
      nflTicker: kickedOff,
      nflSlate: weekSlate,
      selectedLeagueKey: 'sleeper:1',
      leagues: [{ id: '1', name: 'Friday Night Gridiron', provider: 'sleeper', season: '2026', week: 3 }],
      matchup: {
        myTeam: { id: 'a', name: 'Ice Box', owner: 'Maya', record: '2-0' },
        oppTeam: { id: 'b', name: 'Hash Marks', owner: 'Owen', record: '1-1' },
        myPoints: 98.4,
        oppPoints: 91.2,
        starters: [player({ playerId: 'love', name: 'Jordan Love', position: 'QB', nflTeam: 'GB', points: 0 })],
        bench: [player({ playerId: 'jeudy', name: 'Jerry Jeudy', position: 'WR', nflTeam: 'CHI', points: 0 })],
        oppStarters: [player({ playerId: 'aubrey', name: 'Brandon Aubrey', position: 'K', nflTeam: 'DAL', points: 0 })],
        oppBench: []
      }
    })
    const starters = renderToStaticMarkup(
      <OverlayWidgetView id="col.mine.name" hud={hud} surface="tv" density="inherit" showCrawler={false} />
    )
    const bench = renderToStaticMarkup(
      <OverlayWidgetView id="bench.mine" hud={hud} surface="tv" density="inherit" showCrawler={false} />
    )
    const total = renderToStaticMarkup(
      <OverlayWidgetView id="score.mine" hud={hud} surface="tv" density="inherit" showCrawler={false} />
    )
    expect(col(starters, 'pts')).toContain('—')
    expect(col(starters, 'pts')).not.toContain('0.0')
    expect(bench).toContain('—')
    expect(bench).not.toContain('0.0')
    expect(total).toContain('98.4')
    const chips = withGames(
      <HudBench
        label="Bench"
        players={[player({ playerId: 'jeudy', name: 'Jerry Jeudy', position: 'WR', nflTeam: 'CHI', points: 0 })]}
      />
    )
    expect(chips).toContain('tabular-nums">—')
    expect(chips).not.toContain('tabular-nums">0.0')
  })
})

describe('HudRail', () => {
  it('renders compact overlay rows with points confined to the pts column', () => {
    const html = renderToStaticMarkup(
      <HudRail
        you
        players={[
          player({ playerId: 'cmc', name: 'Christian McCaffrey', position: 'RB', points: 11.9 }),
          player({ playerId: 'mevis', name: 'Jake Mevis', position: 'K', points: 1 }),
          player({ playerId: 'herbert', name: 'Justin Herbert', position: 'QB' })
        ]}
      />
    )
    expect(html).toContain('data-hud-rail="mine"')
    expect(html.match(/data-lineup-row="mine"/g)?.length).toBe(3)
    expect(col(html, 'pts')).toContain('11.9')
    expect(html).toContain('McCaffrey')
    expect(html).toContain('Mevis')
    expect(html).not.toMatch(/data-lineup-col="pos"[^>]*>([^<]*1\.0)/)
  })
})

describe('BoardRails', () => {
  it('labels both roster columns Starters with lime you-side chrome', () => {
    const html = renderToStaticMarkup(
      <BoardRails
        mine={[player({ playerId: 'cmc', name: 'Christian McCaffrey', position: 'RB', points: 11.9 })]}
        opp={[player({ playerId: 'mevis', name: 'Jake Mevis', position: 'K', points: 1.0 })]}
      />
    )
    expect(html).toContain('data-hud-rail="mine"')
    expect(html).toContain('data-hud-rail="opp"')
    expect(html.indexOf('data-lineup-col="pos"')).toBeLessThan(html.indexOf('data-lineup-col="pts"'))
    expect(html).toContain('Christian McCaffrey')
    expect(html).toContain('11.9')
    expect(html).toContain('Jake Mevis')
    expect(html).toContain('1.0')
    expect(html.match(/>Starters<\/h2>/g)?.length).toBe(2)
    expect(html).toContain('text-lime">Starters</h2>')
    expect(html).toContain('text-them">Starters</h2>')
    expect(html).not.toContain('text-you">Starters</h2>')
    expect(html).not.toContain('>You</h2>')
    expect(html).not.toContain('>Them</h2>')
    expect(html).toContain('data-bench-foot="mine"')
    expect(html).toContain('data-bench-foot="opp"')
    expect(html).toContain('Empty')
    expect(html).not.toContain('overflow-x-auto')
  })

  it('left-aligns the left STARTERS header even when that rail is not lime', () => {
    const html = renderToStaticMarkup(
      <BoardRails
        emphasizeMine={false}
        oppMissing
        mine={[player({ playerId: 'jones', name: 'Aaron Jones', position: 'RB', points: 21.4 })]}
        opp={[]}
      />
    )
    const headers = [...html.matchAll(/<h2 class="([^"]*)">Starters<\/h2>/g)].map((match) => match[1])
    expect(headers).toEqual([
      'mb-2 shrink-0 font-cond text-xs font-bold uppercase tracking-[0.18em] text-them',
      'mb-2 shrink-0 text-right font-cond text-xs font-bold uppercase tracking-[0.18em] text-them'
    ])
    expect(html.indexOf('data-lineup-col="pos"')).toBeLessThan(html.indexOf('data-lineup-col="name"'))
    expect(html.indexOf('data-lineup-col="name"')).toBeLessThan(html.indexOf('data-lineup-col="pts"'))
    expect(html).toContain('Aaron Jones')
    expect(html).toContain('data-bench-foot="opp"')
  })
})

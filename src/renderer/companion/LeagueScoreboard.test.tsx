import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { LeagueBoardSnapshot, Matchup } from '@shared/types'
import { applyLeagueScanKey, leagueScanForSnapshot, leagueScanKeyBlocked, LeagueScoreboard } from './LeagueScoreboard'

const pairing = (name: string, opp: string | null): Matchup => ({
  myTeam: { id: name, name, owner: name, record: '1-0' },
  oppTeam: opp ? { id: opp, name: opp, owner: opp, record: '0-1' } : null,
  myPoints: 12,
  oppPoints: opp ? 9 : 0,
  myProjectedPoints: 20,
  oppProjectedPoints: opp ? 18 : undefined,
  myWinPct: opp ? 0.6 : undefined,
  oppWinPct: opp ? 0.4 : undefined,
  winPctSource: 'official',
  starters: [{ playerId: '1', name: 'Quarterback', position: 'QB', nflTeam: 'KC', points: 12 }],
  bench: [],
  oppStarters: opp ? [{ playerId: '2', name: 'Runner', position: 'RB', nflTeam: 'DAL', points: 9 }] : [],
  oppBench: []
})

const board = (): LeagueBoardSnapshot => ({
  leagueKey: 'sleeper:1',
  leagueName: 'Friday Night Gridiron',
  provider: 'sleeper',
  week: 3,
  status: 'ready',
  pollingLive: true,
  updatedAt: 1,
  pairs: [
    { id: 'mine', mine: true, matchup: pairing('Ice Box', 'Hash Marks'), left: 4, oppLeft: 5 },
    { id: 'other', mine: false, matchup: pairing('Last Call', 'Sober Sundays'), left: 2, oppLeft: 0 },
    { id: 'bye', mine: false, matchup: pairing('Practice Squad', null), left: 0, oppLeft: 0 }
  ]
})

describe('applyLeagueScanKey', () => {
  it('moves, opens, and steps back without leaving the league view until a second Escape', () => {
    const list = { view: 'list' as const, index: 0 }
    const down = applyLeagueScanKey(list, 'ArrowDown', 3)
    expect(down).toEqual({ view: 'list', index: 1 })
    const opened = applyLeagueScanKey(down === 'mine' ? list : down, 'Enter', 3)
    expect(opened).toEqual({ view: 'detail', index: 1 })
    expect(applyLeagueScanKey(opened === 'mine' ? list : opened, 'ArrowDown', 3)).toEqual({
      view: 'detail',
      index: 1
    })
    const back = applyLeagueScanKey(opened === 'mine' ? list : opened, 'Escape', 3)
    expect(back).toEqual({ view: 'list', index: 1 })
    expect(applyLeagueScanKey(back === 'mine' ? list : back, 'Escape', 3)).toBe('mine')
  })

  it('returns to the list when the league or week changes', () => {
    const detail = { view: 'detail' as const, index: 2 }
    expect(leagueScanForSnapshot(detail, 'sleeper:1:3', 'sleeper:9:3', 4)).toEqual({ view: 'list', index: 0 })
    expect(leagueScanForSnapshot(detail, 'sleeper:1:3', 'sleeper:1:4', 4)).toEqual({ view: 'list', index: 0 })
    expect(leagueScanForSnapshot(detail, 'sleeper:1:3', 'sleeper:1:3', 4)).toEqual(detail)
    expect(leagueScanForSnapshot(detail, 'sleeper:1:3', 'sleeper:1:3', 2)).toEqual({ view: 'detail', index: 1 })
  })

  it('ignores arrows while a shortcut or the HUD studio already owns the key', () => {
    const event = {
      defaultPrevented: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      target: null
    }
    expect(leagueScanKeyBlocked(event)).toBe(false)
    expect(leagueScanKeyBlocked({ ...event, defaultPrevented: true })).toBe(true)
    expect(leagueScanKeyBlocked({ ...event, metaKey: true })).toBe(true)
    expect(leagueScanKeyBlocked({ ...event, ctrlKey: true })).toBe(true)
    expect(leagueScanKeyBlocked({ ...event, altKey: true })).toBe(true)
  })
})

describe('LeagueScoreboard', () => {
  it('renders every pairing, a bye, players left, and a live mark', () => {
    const html = renderToStaticMarkup(<LeagueScoreboard board={board()} onMine={() => undefined} />)
    expect(html).toContain('data-league-board="list"')
    expect(html).toContain('Ice Box')
    expect(html).toContain('Hash Marks')
    expect(html).toContain('data-league-bye="true"')
    expect(html).toContain('bg-card')
    expect(html).toContain('w-[5.5ch]')
    expect(html).toContain('text-right')
    expect(html).toContain('BYE')
    expect(html).toContain('4 left')
    expect(html).toContain('data-live-dot="true"')
    expect(html).toContain('The overlay stays on yours.')
  })

  it('dashes a bye detail instead of scoring the missing side as 0.0', () => {
    const html = renderToStaticMarkup(
      <LeagueScoreboard board={board()} onMine={() => undefined} initialScan={{ view: 'detail', index: 2 }} />
    )
    expect(html).toContain('data-hud-score="bye"')
    expect(html).toContain('—')
    expect(html).toContain('BYE')
    expect(html).toContain('>12.0<')
    expect(html).not.toContain('>0.0<')
    expect(html).not.toContain('Win% pending')
  })

  it('opens a pairing with All matchups and no read-only label', () => {
    const html = renderToStaticMarkup(
      <LeagueScoreboard board={board()} onMine={() => undefined} initialScan={{ view: 'detail', index: 1 }} />
    )
    expect(html).toContain('All matchups')
    expect(html).toContain('Last Call')
    expect(html).not.toContain('Read only')
    expect(html).not.toContain('READ ONLY')
  })

  it('shows a loading skeleton and keeps the last names when a later snapshot errors', () => {
    const loading = renderToStaticMarkup(<LeagueScoreboard board={null} onMine={() => undefined} />)
    expect(loading).toContain('data-league-status="loading"')
    const failed: LeagueBoardSnapshot = { ...board(), status: 'error', error: 'League scores are paused after a rate limit. Your matchup is unchanged.' }
    const html = renderToStaticMarkup(<LeagueScoreboard board={failed} onMine={() => undefined} />)
    expect(html).toContain('Ice Box')
    expect(html).toContain('data-league-status="error"')
    expect(html).toContain('paused after a rate limit')
  })

  it('labels a Sleeper estimate and leaves an official ESPN bar unlabeled in the list', () => {
    const estimated = board()
    const first = estimated.pairs[0]
    if (!first) throw new Error('missing pair')
    estimated.pairs[0] = {
      ...first,
      matchup: { ...first.matchup, winPctSource: 'estimated' }
    }
    const html = renderToStaticMarkup(<LeagueScoreboard board={estimated} onMine={() => undefined} />)
    expect(html).toContain('Est. win%')
    expect(html).toContain('data-hud-win-pct-source="estimated"')
    const official = renderToStaticMarkup(<LeagueScoreboard board={board()} onMine={() => undefined} />)
    expect(official).not.toContain('Est. win%')
  })

  it('keeps a third club on the row with an Est. win% bar', () => {
    const snapshot = board()
    const group = snapshot.pairs[1]
    if (!group) throw new Error('missing pair')
    snapshot.pairs[1] = {
      ...group,
      matchup: { ...group.matchup, winPctSource: 'estimated' },
      pod: [{ team: { id: 'median', name: 'League Median', owner: 'Median', record: '—' }, points: 81.5 }]
    }
    const html = renderToStaticMarkup(<LeagueScoreboard board={snapshot} onMine={() => undefined} />)
    const row = html.split('data-league-pair="other"')[1]?.split('data-league-pair=')[0] ?? ''
    expect(row).toContain('data-league-pod="true"')
    expect(row).toContain('League Median')
    expect(row).toContain('Group')
    expect(row).toContain('data-hud-win-pct-fill="mine"')
    expect(row).not.toContain('>BYE<')
    const detail = renderToStaticMarkup(
      <LeagueScoreboard board={snapshot} onMine={() => undefined} initialScan={{ view: 'detail', index: 1 }} />
    )
    expect(detail).toContain('data-league-pod="true"')
    expect(detail).toContain('Also in this matchup')
    expect(detail).toContain('League Median')
  })
})

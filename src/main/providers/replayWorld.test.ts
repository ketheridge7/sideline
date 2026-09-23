import { describe, expect, it } from 'vitest'
import { leagueKey, type Matchup, type Player } from '@shared/types'
import { matchupChanceToWin, tapePlayerLabel } from '@shared/display'
import { overlayName } from '../../renderer/shared/format'
import {
  FEATURED_LEAGUE_KEY,
  REPLAY_SEASON,
  REPLAY_WEEK,
  replayBoardExtra,
  replayGameStatus,
  replayMatchupFor,
  replayRosteredPlayers,
  replayScript,
  replaySeedTape,
  replayTickerGames,
  replayTransactionsFor,
  replayWorldLeagues
} from './replayWorld'

const REAL_NAME = /ketheridge|gibbs me head|dawg pound|gucci gang|\bkevin\b/i
const PLACEHOLDER_NAME = /^fng|^player\s*\d|^test\s*user|^roster\s*\d|^\d+$|^[a-z0-9]+(-[a-z0-9]+)+$/i

const everyone = (matchup: Matchup): Player[] => [
  ...matchup.starters,
  ...matchup.bench,
  ...matchup.oppStarters,
  ...matchup.oppBench
]

/** Spec §1.1 MY LEAGUES rows: [league, you, them]. */
const PINNED_LEAGUES: [string, number, number][] = [
  ['Friday Night Gridiron', 98.4, 91.2],
  ['Fourth & Drunken', 84.1, 102.6],
  ['Sunday Lights', 71.0, 68.4],
  ['Waiver Wire Warriors', 55.2, 49.8],
  ['Gridiron Gurus', 112.3, 88.0],
  ['Basement Bowl', 40.1, 61.7]
]

describe('replayWorld (Sunday-real spec)', () => {
  const weekLeagues = replayWorldLeagues(REPLAY_WEEK)
  const featured = weekLeagues.find((row) => leagueKey(row.provider, row.id) === FEATURED_LEAGUE_KEY)!
  const at = (tick: number) => weekLeagues.map((league) => ({ league, matchup: replayMatchupFor(league, tick)! }))

  it('pins Friday Night Gridiron: Maya Ice Box 98.4 vs Owen Hash Marks 91.2, Week 3, Est. win% ~62/38', () => {
    expect(featured.name).toBe('Friday Night Gridiron')
    expect(featured.provider).toBe('sleeper')
    expect(featured.week).toBe(3)
    expect(featured.season).toBe(REPLAY_SEASON)
    const matchup = replayMatchupFor(featured, 0)!
    expect(matchup.myTeam).toMatchObject({ name: 'Ice Box', owner: 'Maya', record: '2-0' })
    expect(matchup.oppTeam).toMatchObject({ name: 'Hash Marks', owner: 'Owen', record: '1-1' })
    expect(matchup.myPoints).toBe(98.4)
    expect(matchup.oppPoints).toBe(91.2)
    expect(matchup.winPctSource).toBe('estimated')
    const chance = matchupChanceToWin(matchup)!
    expect(Math.round(chance.mine * 100)).toBe(62)
  })

  it('carries the spec §1.2 lineups with LAST / LAST NFL display and no fixture prefix', () => {
    const matchup = replayMatchupFor(featured, 0)!
    const rail = (rows: Player[]) => rows.map((row) => [row.position, overlayName(row.name).toUpperCase(), row.points])
    expect(rail(matchup.starters)).toEqual([
      ['QB', 'FIELDS', 18.4],
      ['RB', 'GIBBS', 16.2],
      ['RB', 'MONTGOMERY', 9.1],
      ['WR', 'ST. BROWN', 14.6],
      ['WR', 'HILL', 8.3],
      ['TE', 'KELCE', 7.4],
      ['FLEX', 'COLLINS', 11.8],
      ['K', 'AUBREY', 6.0],
      ['DEF', 'STEELERS', 6.6]
    ])
    expect(rail(matchup.oppStarters)).toEqual([
      ['QB', 'ALLEN', 21.1],
      ['RB', 'BARKLEY', 15.4],
      ['RB', 'CONNER', 5.8],
      ['WR', 'BROWN', 14.2],
      ['WR', 'LONDON', 6.9],
      ['TE', 'KITTLE', 4.2],
      ['FLEX', 'WADDLE', 8.1],
      ['K', 'BASS', 5.0],
      ['DEF', 'RAVENS', 10.5]
    ])
    const tape = (rows: Player[]) => rows.map((row) => tapePlayerLabel(row).toUpperCase())
    expect(tape(matchup.starters)).toContain('FIELDS PIT')
    expect(tape(matchup.starters)).toContain('GIBBS DET')
    expect(tape(matchup.oppStarters)).toContain('ALLEN BUF')
    expect(matchup.bench.length).toBeGreaterThanOrEqual(5)
    expect(matchup.oppBench.length).toBeGreaterThanOrEqual(5)
  })

  it('lists the six fake friend-group leagues at their spec §1.1 scores (Sleeper ×4, ESPN ×2)', () => {
    expect(at(0).map(({ league, matchup }) => [league.name, matchup.myPoints, matchup.oppPoints])).toEqual(PINNED_LEAGUES)
    expect(weekLeagues.filter((row) => row.provider === 'sleeper')).toHaveLength(4)
    expect(weekLeagues.filter((row) => row.provider === 'espn')).toHaveLength(2)
    expect(weekLeagues.every((row) => !/^\d+$/.test(row.id))).toBe(true)
  })

  it('keeps every chance-to-win contestable-to-lopsided but never a lock on the pinned frame', () => {
    for (const { league, matchup } of at(0)) {
      expect(matchup.winPctSource).toBe(league.provider === 'espn' ? 'official' : 'estimated')
      const chance = matchupChanceToWin(matchup)!
      expect(chance.mine).toBeGreaterThan(0.2)
      expect(chance.mine).toBeLessThan(0.92)
      expect(matchup.myProjectedPoints!).toBeGreaterThan(matchup.myPoints)
      expect(matchup.oppProjectedPoints!).toBeGreaterThan(matchup.oppPoints)
      expect(matchup.myTeam.record).not.toBe('0-0')
    }
  })

  it('never shows FNG slugs, PlayerN placeholders, raw ids, or real Kevin leagues', () => {
    const frame = at(0)
    for (const { matchup } of frame) {
      for (const player of everyone(matchup)) {
        expect(player.name).not.toMatch(PLACEHOLDER_NAME)
        expect(player.name).not.toBe(player.playerId)
        expect(overlayName(player.name)).not.toMatch(/fng|player\d/i)
      }
    }
    const blob = JSON.stringify(
      frame.map(({ league, matchup }) => [league.name, matchup.myTeam, matchup.oppTeam, everyone(matchup).map((row) => row.name)])
    )
    expect(blob).not.toMatch(/fng-|player1/i)
    expect(blob).not.toMatch(REAL_NAME)
    expect(JSON.stringify(replaySeedTape())).not.toMatch(REAL_NAME)
  })

  it('rosters each NFL player once per league and shows him at the same points everywhere', () => {
    const seen = new Map<string, number>()
    for (const { matchup } of at(0)) {
      const names = everyone(matchup).map((row) => row.name)
      expect(new Set(names).size).toBe(names.length)
      expect(new Set(everyone(matchup).map((row) => row.playerId.split('-')[0])).size).toBe(1)
      for (const player of everyone(matchup)) {
        const prev = seen.get(player.name)
        if (prev != null) expect(player.points).toBe(prev)
        seen.set(player.name, player.points ?? 0)
      }
    }
  })

  it('keeps yet-to-play players at 0 and leaves several featured starters still grinding', () => {
    for (const { matchup } of at(0)) {
      for (const player of everyone(matchup)) {
        if (replayGameStatus(player.nflTeam, 0) === 'pre') expect(player.points).toBe(0)
      }
    }
    const featuredStarters = [...replayMatchupFor(featured, 0)!.starters, ...replayMatchupFor(featured, 0)!.oppStarters]
    expect(featuredStarters.filter((row) => replayGameStatus(row.nflTeam, 0) === 'live').length).toBeGreaterThanOrEqual(8)
  })

  it('plays the spec §1.4 ticker strip first: live and final mixed', () => {
    const strip = replayTickerGames(0).map((row) => `${row.away} ${row.awayScore} ${row.home} ${row.homeScore} ${row.clock}`)
    expect(strip.slice(0, 5)).toEqual([
      'DET 21 KC 20 3RD 8:14',
      'DAL 28 NYG 14 FINAL',
      'BUF 24 MIA 17 2ND 4:03',
      'PHI 14 ATL 10 1ST 2:11',
      'PIT 17 LAC 14 HALFTIME'
    ])
    const ticker = replayTickerGames(0)
    expect(ticker.filter((row) => row.final)).toHaveLength(1)
    expect(ticker.length).toBeGreaterThanOrEqual(8)
  })

  it('seeds the spec §1.3 THIS MATCHUP tape newest first, including one injury', () => {
    const tape = replaySeedTape(1_000_000_000_000).filter((row) => row.leagueKey === FEATURED_LEAGUE_KEY)
    expect(tape.map((row) => [row.player.toUpperCase(), row.detail, row.kind === 'injury' ? 'INJ' : row.delta])).toEqual([
      ['GIBBS DET', 'TD', 6.2],
      ['HILL MIA', 'FUM', -2],
      ['ALLEN BUF', 'PASS TD', 4],
      ['ST. BROWN DET', 'REC', 1.8],
      ['DOWDLE DAL', 'LEFT GAME (ANKLE)', 'INJ'],
      ['RAVENS BAL', 'INT', 2],
      ['FIELDS PIT', 'RUSH', 1.4]
    ])
    const all = replaySeedTape(1_000_000_000_000)
    expect(new Set(all.map((row) => row.leagueKey).filter(Boolean)).size).toBe(6)
    expect(all.some((row) => row.kind === 'add' && /waiver/i.test(row.detail))).toBe(true)
    expect(all.some((row) => row.kind === 'trade')).toBe(true)
    expect(all.some((row) => row.kind === 'add' && row.leagueKey?.startsWith('espn:'))).toBe(false)
    expect(new Set(all.map((row) => row.id)).size).toBe(all.length)
    expect(all.every((row, index) => index === 0 || all[index - 1].at >= row.at)).toBe(true)
    const labels = new Set(
      replayRosteredPlayers().map((row) => tapePlayerLabel({ playerId: row.id, name: row.name, position: '', nflTeam: row.nflTeam }))
    )
    for (const row of all) {
      if (row.kind === 'score' || row.kind === 'injury') expect(labels.has(row.player)).toBe(true)
    }
  })

  it('ticks the featured board from the pinned frame, then stays bounded over a long session', () => {
    expect(replayScript().length).toBeGreaterThanOrEqual(16)
    const base = replayMatchupFor(featured, 0)!
    const up = replayMatchupFor(featured, 1)!
    expect(up.starters.find((row) => row.name === 'Jahmyr Gibbs')?.tickDelta).toBe(1.1)
    expect(up.myPoints).toBeCloseTo(base.myPoints + 1.1)
    for (const tick of [100, 300, 600, 1200, 5000]) {
      for (const { matchup } of at(tick)) {
        for (const total of [matchup.myPoints, matchup.oppPoints, matchup.myProjectedPoints!, matchup.oppProjectedPoints!]) {
          expect(total).toBeGreaterThan(35)
          expect(total).toBeLessThan(170)
        }
        expect(matchup.myProjectedPoints!).toBeGreaterThanOrEqual(matchup.myPoints)
      }
    }
    expect(replayMatchupFor(featured, 5000)!.myPoints).toBe(replayMatchupFor(featured, 6000)!.myPoints)
  })

  it('advances the slate: halftime resumes, early games go final, and the late window kicks off', () => {
    expect(replayGameStatus('PIT', 0)).toBe('half')
    expect(replayGameStatus('PIT', 60)).toBe('live')
    expect(replayGameStatus('DET', 0)).toBe('live')
    expect(replayGameStatus('DET', 400)).toBe('final')
    expect(replayGameStatus('TB', 0)).toBe('pre')
    expect(replayGameStatus('TB', 400)).toBe('live')
    expect(replayGameStatus('GB', 5000)).toBe('pre')
    expect(replayTickerGames(0).some((row) => row.home === 'TB')).toBe(false)
    expect(replayTickerGames(400).some((row) => row.home === 'TB')).toBe(true)
  })

  it('draws a lead sparkline that ends on the current lead', () => {
    for (const tick of [0, 12]) {
      const extra = replayBoardExtra(featured, tick)
      const matchup = replayMatchupFor(featured, tick)!
      expect(extra.leadSpark.length).toBeGreaterThan(2)
      expect(extra.leadSpark[extra.leadSpark.length - 1]).toBeCloseTo(matchup.myPoints - matchup.oppPoints)
      expect(extra.size).toBe(12)
    }
  })

  it('replays waiver transactions for Sleeper only, not ESPN', () => {
    const sleeper = weekLeagues.find((row) => row.id === 'fourth-drunken')!
    const espn = weekLeagues.find((row) => row.provider === 'espn')!
    expect(replayTransactionsFor(sleeper, 1)).toHaveLength(1)
    expect(replayTransactionsFor(sleeper, 1)[0]?.type).toBe('add')
    expect(replayTransactionsFor(espn, 1)).toEqual([])
  })
})

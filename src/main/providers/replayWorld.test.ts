import { describe, expect, it } from 'vitest'
import { leagueKey, type Matchup, type Player } from '@shared/types'
import { matchupChanceToWin, tapePlayerLabel } from '@shared/display'
import {
  FEATURED_LEAGUE_KEY,
  REPLAY_FEATURED_KEYS,
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

describe('replayWorld', () => {
  const weekLeagues = replayWorldLeagues(REPLAY_WEEK)
  const featured = weekLeagues.find((row) => leagueKey(row.provider, row.id) === FEATURED_LEAGUE_KEY)!
  const at = (tick: number) => weekLeagues.map((league) => ({ league, matchup: replayMatchupFor(league, tick)! }))

  it('ships six mixed Sleeper/ESPN boards with one featured Sleeper and one featured ESPN matchup', () => {
    expect(weekLeagues).toHaveLength(6)
    expect(weekLeagues.filter((row) => row.provider === 'sleeper').length).toBeGreaterThanOrEqual(3)
    expect(weekLeagues.filter((row) => row.provider === 'espn').length).toBeGreaterThanOrEqual(2)
    expect(weekLeagues.every((row) => row.season === REPLAY_SEASON && row.week === REPLAY_WEEK)).toBe(true)
    expect(REPLAY_FEATURED_KEYS).toEqual(['sleeper:cul-de-sac', 'espn:break-room'])
    expect(featured.name).toBe('Cul-de-Sac League')
    const matchup = replayMatchupFor(featured, 0)!
    expect(matchup.myTeam).toMatchObject({ name: 'Ice Box', owner: 'Maya' })
    expect(matchup.oppTeam).toMatchObject({ name: 'Hash Marks', owner: 'Owen' })
    expect(matchup.starters.map((row) => row.position)).toEqual(['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF'])
    const espn = replayMatchupFor(weekLeagues.find((row) => row.id === 'break-room')!, 0)!
    expect(espn.myTeam.name).toBe('Two-Minute Drill')
    expect(espn.oppTeam?.name).toBe('Monday Morning QBs')
  })

  it('carries full benches on every board (6+ each side on the featured pair)', () => {
    for (const { league, matchup } of at(0)) {
      const key = leagueKey(league.provider, league.id)
      const min = REPLAY_FEATURED_KEYS.includes(key) ? 6 : 5
      expect(matchup.bench.length).toBeGreaterThanOrEqual(min)
      expect(matchup.oppBench.length).toBeGreaterThanOrEqual(min)
    }
  })

  it('uses believable player names — never FNG slugs, placeholders, or raw ids', () => {
    for (const { matchup } of at(0)) {
      for (const player of everyone(matchup)) {
        expect(player.name).not.toMatch(PLACEHOLDER_NAME)
        expect(player.name).not.toBe(player.playerId)
        if (player.position === 'DEF') expect(player.name).toMatch(/ D\/ST$/)
        else expect(player.name.split(' ').length).toBeGreaterThanOrEqual(2)
      }
    }
    expect(JSON.stringify(at(0))).not.toMatch(/fng/i)
  })

  it('rosters each NFL player once per league, with non-numeric ids scoped to the board', () => {
    for (const { league, matchup } of at(0)) {
      const names = everyone(matchup).map((row) => row.name)
      expect(new Set(names).size).toBe(names.length)
      const prefixes = new Set(everyone(matchup).map((player) => player.playerId.split('-')[0]))
      expect(prefixes.size).toBe(1)
      expect(everyone(matchup).every((player) => !/^\d+$/.test(player.playerId))).toBe(true)
      expect(/^\d+$/.test(league.id)).toBe(false)
    }
  })

  it('keeps fake league/team/owner names off live Kevin leagues', () => {
    const blob = at(0)
      .flatMap(({ league, matchup }) => [
        league.id,
        league.name,
        matchup.myTeam.name,
        matchup.myTeam.owner,
        matchup.oppTeam?.name,
        matchup.oppTeam?.owner
      ])
      .join(' | ')
    expect(blob).not.toMatch(REAL_NAME)
    expect(JSON.stringify(replaySeedTape())).not.toMatch(REAL_NAME)
  })

  it('opens mid-slate: totals 40–90, projections 90–145, and a sane chance-to-win on every board', () => {
    for (const { league, matchup } of at(0)) {
      for (const side of [
        { live: matchup.myPoints, projected: matchup.myProjectedPoints! },
        { live: matchup.oppPoints, projected: matchup.oppProjectedPoints! }
      ]) {
        expect(side.live).toBeGreaterThanOrEqual(40)
        expect(side.live).toBeLessThanOrEqual(90)
        expect(side.projected).toBeGreaterThanOrEqual(90)
        expect(side.projected).toBeLessThanOrEqual(145)
        expect(side.projected).toBeGreaterThan(side.live)
      }
      expect(matchup.winPctSource).toBe(league.provider === 'espn' ? 'official' : 'estimated')
      const chance = matchupChanceToWin(matchup)
      expect(chance).not.toBeNull()
      expect(chance!.mine).toBeGreaterThan(0.1)
      expect(chance!.mine).toBeLessThan(0.9)
      expect(/^[0-2]-[0-2]$/.test(matchup.myTeam.record)).toBe(true)
      expect(matchup.myTeam.record).not.toBe('0-0')
    }
    const featuredChance = matchupChanceToWin(replayMatchupFor(featured, 0)!)!
    expect(featuredChance.mine).toBeGreaterThan(0.3)
    expect(featuredChance.mine).toBeLessThan(0.7)
  })

  it('keeps yet-to-play players at 0 and finished players off the projection', () => {
    for (const { matchup } of at(0)) {
      for (const player of everyone(matchup)) {
        if (replayGameStatus(player.nflTeam, 0) === 'pre') expect(player.points).toBe(0)
      }
      expect(matchup.starters.some((row) => replayGameStatus(row.nflTeam, 0) === 'pre')).toBe(true)
      expect(matchup.starters.some((row) => (row.points ?? 0) > 0)).toBe(true)
    }
  })

  it('shows one player at the same points on every board that rosters him', () => {
    const seen = new Map<string, number>()
    for (const { matchup } of at(40)) {
      for (const player of everyone(matchup)) {
        const prev = seen.get(player.name)
        if (prev != null) expect(player.points).toBe(prev)
        seen.set(player.name, player.points ?? 0)
      }
    }
  })

  it('ticks a featured starter up then an opponent down so the overlay can flash both tags', () => {
    const script = replayScript()
    expect(script.length).toBeGreaterThanOrEqual(20)
    const base = replayMatchupFor(featured, 0)!
    const up = replayMatchupFor(featured, 1)!
    const bijan0 = base.starters.find((row) => row.name === 'Bijan Robinson')!
    const bijan1 = up.starters.find((row) => row.name === 'Bijan Robinson')!
    expect(bijan1.tickDelta).toBe(6.6)
    expect(bijan1.lastPlay).toBe('RUSH TD')
    expect((bijan1.points ?? 0) - (bijan0.points ?? 0)).toBeCloseTo(6.6)
    expect(up.myPoints - base.myPoints).toBeCloseTo(6.6)

    const down = replayMatchupFor(featured, 2)!
    const chase = down.oppStarters.find((row) => row.name === "Ja'Marr Chase")!
    expect(chase.tickDelta).toBe(-2)
    expect(chase.lastPlay).toBe('FUM')
    expect(down.oppPoints).toBeLessThan(base.oppPoints)
    expect(down.starters.find((row) => row.name === 'Bijan Robinson')?.tickDelta).toBeUndefined()

    const hurt = replayMatchupFor(featured, 5)!.oppStarters.find((row) => row.name === 'Drake London')!
    expect(hurt.status).toBe('OUT')
    expect(replayMatchupFor(featured, 5)!.oppProjectedPoints!).toBeLessThan(replayMatchupFor(featured, 4)!.oppProjectedPoints!)
  })

  it('stays bounded over a long demo session: no runaway totals, projections stay realistic', () => {
    for (const tick of [100, 300, 600, 1200, 5000]) {
      for (const { matchup } of at(tick)) {
        for (const total of [matchup.myPoints, matchup.oppPoints, matchup.myProjectedPoints!, matchup.oppProjectedPoints!]) {
          expect(total).toBeGreaterThan(40)
          expect(total).toBeLessThan(165)
        }
        expect(matchup.myProjectedPoints!).toBeGreaterThanOrEqual(matchup.myPoints)
      }
    }
    const late = replayMatchupFor(featured, 5000)!
    expect(late.myPoints).toBe(replayMatchupFor(featured, 6000)!.myPoints)
  })

  it('advances the slate: halftime resumes, the 1:00 window goes final, and 4:25 kicks off', () => {
    expect(replayGameStatus('PHI', 0)).toBe('half')
    expect(replayGameStatus('PHI', 60)).toBe('live')
    expect(replayGameStatus('ATL', 0)).toBe('live')
    expect(replayGameStatus('ATL', 400)).toBe('final')
    expect(replayGameStatus('DET', 0)).toBe('pre')
    expect(replayGameStatus('DET', 500)).toBe('live')
    expect(replayGameStatus('BAL', 5000)).toBe('pre')
    const opening = replayTickerGames(0)
    expect(opening.some((game) => game.final)).toBe(true)
    expect(opening.some((game) => !game.final)).toBe(true)
    expect(opening.some((game) => game.home === 'DET' || game.away === 'DET')).toBe(false)
    expect(replayTickerGames(500).some((game) => game.away === 'DET')).toBe(true)
    const atl0 = opening.find((game) => game.away === 'ATL')!
    const atl1 = replayTickerGames(1).find((game) => game.away === 'ATL')!
    expect(atl1.awayScore - atl0.awayScore).toBe(7)
  })

  it('seeds a Sunday tape across all six boards with +pts, -pts, INJ, a Sleeper waiver, and a trade', () => {
    const tape = replaySeedTape(1_000_000_000_000)
    expect(tape.length).toBeGreaterThanOrEqual(16)
    expect(tape.filter((row) => row.leagueKey === FEATURED_LEAGUE_KEY).length).toBeGreaterThanOrEqual(6)
    expect(new Set(tape.map((row) => row.leagueKey).filter(Boolean)).size).toBe(6)
    expect(tape.some((row) => row.kind === 'score' && (row.delta ?? 0) > 0)).toBe(true)
    expect(tape.some((row) => row.kind === 'score' && (row.delta ?? 0) < 0)).toBe(true)
    expect(tape.some((row) => row.kind === 'injury')).toBe(true)
    expect(tape.some((row) => row.kind === 'add' && /waiver/i.test(row.detail))).toBe(true)
    expect(tape.some((row) => row.kind === 'trade')).toBe(true)
    expect(tape.some((row) => row.kind === 'add' && row.leagueKey?.startsWith('espn:'))).toBe(false)
    expect(new Set(tape.map((row) => row.id)).size).toBe(tape.length)
    expect(tape.every((row, index) => index === 0 || tape[index - 1].at >= row.at)).toBe(true)
    expect(tape.every((row) => row.at <= 1_000_000_000_000)).toBe(true)
    const labels = new Set(
      replayRosteredPlayers().map((row) =>
        tapePlayerLabel({ playerId: row.id, name: row.name, position: '', nflTeam: row.nflTeam })
      )
    )
    for (const row of tape) {
      if (row.kind === 'score' || row.kind === 'injury') expect(labels.has(row.player)).toBe(true)
    }
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
    const sleeper = weekLeagues.find((row) => row.id === 'fourth-and-long')!
    const espn = weekLeagues.find((row) => row.provider === 'espn')!
    expect(replayTransactionsFor(sleeper, 1)).toHaveLength(1)
    expect(replayTransactionsFor(sleeper, 1)[0]?.type).toBe('add')
    expect(replayTransactionsFor(espn, 1)).toEqual([])
  })
})

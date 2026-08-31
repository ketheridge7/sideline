import { describe, expect, it } from 'vitest'
import { leagueKey } from '@shared/types'
import {
  FEATURED_LEAGUE_KEY,
  replayBoardExtra,
  replayMatchupFor,
  replayScoreBeats,
  replaySeedTape,
  replayTickerGames,
  replayWorldLeagues
} from './replayWorld'

describe('replayWorld', () => {
  const weekLeagues = replayWorldLeagues(1)
  const featured = weekLeagues.find((row) => leagueKey(row.provider, row.id) === FEATURED_LEAGUE_KEY)

  it('ships six mixed Sleeper/ESPN boards with a featured Friday Night matchup', () => {
    expect(weekLeagues).toHaveLength(6)
    expect(weekLeagues.filter((row) => row.provider === 'sleeper').length).toBeGreaterThanOrEqual(3)
    expect(weekLeagues.filter((row) => row.provider === 'espn').length).toBeGreaterThanOrEqual(2)
    expect(featured?.name).toBe('Friday Night Gridiron')
    const matchup = replayMatchupFor(featured!, 0)
    expect(matchup?.myTeam.name).toBe('Gibbs Me Head')
    expect(matchup?.oppTeam?.name).toBe('The Other Guys')
    expect(matchup?.myPoints).toBe(142.8)
    expect(matchup?.oppPoints).toBe(131.2)
    expect(matchup?.starters.map((row) => row.position)).toEqual([
      'QB',
      'RB',
      'RB',
      'WR',
      'WR',
      'TE',
      'FLEX',
      'K',
      'DEF'
    ])
    expect(matchup?.bench.length).toBeGreaterThan(0)
    const leads = weekLeagues.map((league) => {
      const row = replayMatchupFor(league, 0)
      return Math.round(((row?.myPoints ?? 0) - (row?.oppPoints ?? 0)) * 10) / 10
    })
    expect(leads.some((lead) => lead > 0)).toBe(true)
    expect(leads.some((lead) => lead < 0)).toBe(true)
  })

  it('ticks a featured starter up then down so overlay can flash both tags', () => {
    const beats = replayScoreBeats()
    expect(beats.some((beat) => beat.delta > 0)).toBe(true)
    expect(beats.some((beat) => beat.delta < 0)).toBe(true)
    const up = replayMatchupFor(featured!, 1)
    const gibbs0 = replayMatchupFor(featured!, 0)?.starters.find((row) => row.playerId === 'fng-gibbs')
    const gibbs1 = up?.starters.find((row) => row.playerId === 'fng-gibbs')
    expect(gibbs1?.tickDelta).toBe(6.2)
    expect(gibbs1?.lastPlay).toBe('TD')
    expect((gibbs1?.points ?? 0) - (gibbs0?.points ?? 0)).toBeCloseTo(6.2)
    expect((up?.myPoints ?? 0) - 142.8).toBeCloseTo(6.2)

    const down = replayMatchupFor(featured!, 2)
    const hill = down?.oppStarters.find((row) => row.playerId === 'fng-hill')
    expect(hill?.tickDelta).toBe(-2.0)
    expect(hill?.lastPlay).toBe('FUM')
    expect(down?.oppPoints).toBeLessThan(131.2)
  })

  it('seeds a mixed tape with +pts, -pts, INJ, and a waiver, plus a scripted NFL ticker', () => {
    const tape = replaySeedTape()
    expect(tape[0]?.id).toBe('seed-gibbs-td')
    expect(tape.some((row) => row.kind === 'score' && (row.delta ?? 0) > 0)).toBe(true)
    expect(tape.some((row) => row.kind === 'score' && (row.delta ?? 0) < 0)).toBe(true)
    expect(tape.some((row) => row.kind === 'injury')).toBe(true)
    expect(tape.some((row) => row.kind === 'add' && /waiver/i.test(row.detail))).toBe(true)
    const extra = replayBoardExtra(featured!, 0)
    expect(extra.lastScorers.length).toBe(3)
    expect(extra.lastScorers.some((chip) => (chip.delta ?? 0) < 0)).toBe(true)
    expect(extra.leadSpark?.length).toBeGreaterThan(2)
    const ticker = replayTickerGames()
    expect(ticker.length).toBeGreaterThanOrEqual(4)
    expect(ticker.some((game) => game.final)).toBe(true)
    expect(ticker.some((game) => !game.final)).toBe(true)
  })
})

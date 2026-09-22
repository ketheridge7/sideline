import { describe, expect, it } from 'vitest'
import { leagueKey } from '@shared/types'
import { matchupChanceToWin } from '@shared/display'
import {
  FEATURED_LEAGUE_KEY,
  REPLAY_SEASON,
  REPLAY_WEEK,
  replayBoardExtra,
  replayMatchupFor,
  replayScoreBeats,
  replaySeedTape,
  replayTickerGames,
  replayTransactionsFor,
  replayWorldLeagues
} from './replayWorld'

const REAL_NAME = /ketheridge|gibbs me head|dawg pound|gucci gang|\bkevin\b/i

describe('replayWorld', () => {
  const weekLeagues = replayWorldLeagues(REPLAY_WEEK)
  const featured = weekLeagues.find((row) => leagueKey(row.provider, row.id) === FEATURED_LEAGUE_KEY)

  it('ships six mixed Sleeper/ESPN boards with a featured Friday Night matchup', () => {
    expect(weekLeagues).toHaveLength(6)
    expect(weekLeagues.filter((row) => row.provider === 'sleeper').length).toBeGreaterThanOrEqual(3)
    expect(weekLeagues.filter((row) => row.provider === 'espn').length).toBeGreaterThanOrEqual(2)
    expect(weekLeagues.every((row) => row.season === REPLAY_SEASON && row.week === REPLAY_WEEK)).toBe(true)
    expect(featured?.name).toBe('Friday Night Gridiron')
    const matchup = replayMatchupFor(featured!, 0)
    expect(matchup?.myTeam.name).toBe('Ice Box')
    expect(matchup?.myTeam.owner).toBe('Maya')
    expect(matchup?.oppTeam?.name).toBe('Hash Marks')
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

  it('keeps fake league/team/owner names and slug ids off live Kevin leagues', () => {
    const blob = weekLeagues
      .flatMap((league) => {
        const matchup = replayMatchupFor(league, 0)
        return [
          league.id,
          league.name,
          matchup?.myTeam.name,
          matchup?.myTeam.owner,
          matchup?.oppTeam?.name,
          matchup?.oppTeam?.owner
        ]
      })
      .join(' | ')
    expect(blob).not.toMatch(REAL_NAME)
    expect(weekLeagues.every((row) => !/^\d+$/.test(row.id))).toBe(true)
    expect(weekLeagues.some((row) => row.provider === 'espn' && row.id === 'gridiron-gurus')).toBe(true)
    expect(weekLeagues.some((row) => row.provider === 'espn' && row.id === 'basement-bowl')).toBe(true)
  })

  it('paints mid-game totals, starter points, and a chance-to-win bar on every board', () => {
    for (const league of weekLeagues) {
      const matchup = replayMatchupFor(league, 0)
      expect(matchup).toBeTruthy()
      expect(matchup!.myPoints).toBeGreaterThan(90)
      expect(matchup!.oppPoints).toBeGreaterThan(90)
      expect(matchup!.starters.every((row) => (row.points ?? 0) > 0)).toBe(true)
      expect(matchup!.oppStarters.every((row) => (row.points ?? 0) > 0)).toBe(true)
      expect(matchup!.myProjectedPoints).toBeGreaterThan(matchup!.myPoints)
      expect(matchup!.oppProjectedPoints).toBeGreaterThan(matchup!.oppPoints)
      expect(matchup!.winPctSource).toBe(league.provider === 'espn' ? 'official' : 'estimated')
      expect(matchupChanceToWin(matchup!)).not.toBeNull()
      expect(/^[0-2]-[0-2]$/.test(matchup!.myTeam.record)).toBe(true)
      expect(matchup!.myTeam.record).not.toBe('0-0')
    }
  })

  it('ticks a featured starter up then down so overlay can flash both tags', () => {
    const beats = replayScoreBeats()
    expect(beats.length).toBeGreaterThanOrEqual(16)
    expect(new Set(beats.map((beat) => leagueKey(beat.provider, beat.leagueId))).size).toBe(6)
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

  it('seeds a mixed Sunday tape with +pts, -pts, INJ, waiver, and a trade, plus a scripted NFL ticker', () => {
    const tape = replaySeedTape()
    expect(tape.length).toBeGreaterThanOrEqual(16)
    expect(tape[0]?.id).toBe('seed-gibbs-td')
    expect(tape.filter((row) => row.leagueKey === FEATURED_LEAGUE_KEY).length).toBeGreaterThanOrEqual(6)
    expect(new Set(tape.map((row) => row.leagueKey).filter(Boolean)).size).toBe(6)
    expect(tape.some((row) => row.kind === 'score' && (row.delta ?? 0) > 0)).toBe(true)
    expect(tape.some((row) => row.kind === 'score' && (row.delta ?? 0) < 0)).toBe(true)
    expect(tape.some((row) => row.kind === 'injury')).toBe(true)
    expect(tape.some((row) => row.kind === 'add' && /waiver/i.test(row.detail))).toBe(true)
    expect(tape.some((row) => row.kind === 'trade')).toBe(true)
    expect(tape.some((row) => row.kind === 'add' && row.leagueKey?.startsWith('espn:'))).toBe(false)
    expect(JSON.stringify(tape)).not.toMatch(REAL_NAME)
    const extra = replayBoardExtra(featured!, 0)
    expect(extra.lastScorers.length).toBe(3)
    expect(extra.lastScorers.some((chip) => (chip.delta ?? 0) < 0)).toBe(true)
    expect(extra.leadSpark?.length).toBeGreaterThan(2)
    const ticker = replayTickerGames()
    expect(ticker.length).toBeGreaterThanOrEqual(8)
    expect(ticker.some((game) => game.final)).toBe(true)
    expect(ticker.some((game) => !game.final)).toBe(true)
  })

  it('keeps a distinct myTeam and starter ids on every mixed Sleeper/ESPN board', () => {
    const rows = weekLeagues.map((league) => {
      const matchup = replayMatchupFor(league, 0)
      return {
        key: leagueKey(league.provider, league.id),
        teamId: matchup?.myTeam.id,
        starterIds: (matchup?.starters ?? []).map((row) => row.playerId)
      }
    })
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length)
    expect(new Set(rows.map((row) => row.teamId)).size).toBe(rows.length)
    const sleeper = rows.find((row) => row.key.startsWith('sleeper:'))
    const espn = rows.find((row) => row.key.startsWith('espn:'))
    expect(sleeper?.starterIds[0]).toBeTruthy()
    expect(espn?.starterIds[0]).toBeTruthy()
    expect(sleeper?.starterIds[0]).not.toBe(espn?.starterIds[0])
    expect(sleeper?.starterIds.some((id) => espn?.starterIds.includes(id))).toBe(false)
  })

  it('replays waiver transactions for Sleeper only, not ESPN', () => {
    const sleeper = weekLeagues.find((row) => row.id === 'fourth-drunken')
    const espn = weekLeagues.find((row) => row.provider === 'espn')
    expect(replayTransactionsFor(sleeper!, 1)).toHaveLength(1)
    expect(replayTransactionsFor(sleeper!, 1)[0]?.type).toBe('add')
    expect(replayTransactionsFor(espn!, 1)).toEqual([])
  })
})

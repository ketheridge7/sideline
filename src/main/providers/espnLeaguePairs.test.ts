import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import type { NflTickerGame } from '@shared/types'
import { toEspnLeaguePairs, toEspnMatchup } from './espnAdapter'

const payload = JSON.parse(readFileSync(join(process.cwd(), 'fixtures/espn-league-week.json'), 'utf8')) as unknown

const ticker: NflTickerGame[] = [
  { id: 'dal-nyg', away: 'DAL', awayScore: 28, home: 'NYG', homeScore: 14, clock: 'FINAL', final: true }
]

const cookies = { espn_s2: 's2', SWID: '{AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA}' }

describe('toEspnLeaguePairs', () => {
  it('lists every game in the week plus the unpaired bye', () => {
    const pairs = toEspnLeaguePairs({ payload, displayWeek: 1, myTeamId: 1, ticker })
    expect(pairs.map((pair) => pair.id)).toEqual(['1-2', '3-4', '5-6', 'bye-7'])
    expect(pairs.filter((pair) => pair.mine).map((pair) => pair.matchup.myTeam.name)).toEqual(['Alpha'])
    const mine = pairs[0]
    expect(mine?.matchup.oppTeam?.name).toBe('Bravo')
    expect(mine?.matchup.myPoints).toBe(88.4)
    expect(mine?.matchup.myWinPct).toBe(0.62)
    expect(mine?.matchup.winPctSource).toBe('official')
    expect(mine?.left).toBe(0)
    expect(mine?.oppLeft).toBe(1)
    const bye = pairs.find((pair) => pair.id === 'bye-7')
    expect(bye?.matchup.oppTeam).toBeNull()
    expect(bye?.matchup.myTeam.name).toBe('Golf')
  })

  it('leaves the single-matchup parser on the signed-in game', () => {
    const mine = toEspnMatchup({ payload, cookies, displayWeek: 1, myTeamId: 1 })
    expect(mine?.myTeam.id).toBe('1')
    expect(mine?.oppTeam?.id).toBe('2')
    expect(mine?.oppTeam?.name).toBe('Bravo')
    const pairs = toEspnLeaguePairs({ payload, displayWeek: 1, myTeamId: 1 })
    expect(pairs.filter((pair) => pair.matchup.myTeam.id === '1')).toHaveLength(1)
  })

  it('keeps week-1 points in week 2 of a two-week playoff round and ignores the NFL week as the period', () => {
    const playoff = JSON.parse(readFileSync(join(process.cwd(), 'fixtures/espn-playoff-two-week.json'), 'utf8')) as unknown
    expect(toEspnLeaguePairs({ payload: playoff, displayWeek: 16, myTeamId: 1 })).toEqual([])
    const pairs = toEspnLeaguePairs({
      payload: playoff,
      displayWeek: 16,
      myTeamId: 1,
      matchupPeriod: { matchupPeriodId: 15, scoringPeriodIds: [15, 16] }
    })
    expect(pairs.map((pair) => pair.matchup.myTeam.name)).toEqual(['Sideline Squad'])
    expect(pairs[0]?.matchup.myPoints).toBe(121.5)
    expect(pairs[0]?.matchup.oppPoints).toBe(98.25)
    expect(pairs[0]?.matchup.winPctSource).not.toBe('estimated')
    expect(pairs[0]?.mine).toBe(true)
  })

  it('collapses two schedule rows for the same clubs onto the current NFL week', () => {
    const row = (scoringPeriodId: number, points: number) => ({
      matchupPeriodId: 15,
      scoringPeriodId,
      home: { teamId: 1, totalPointsLive: points },
      away: { teamId: 2, totalPointsLive: points - 1 }
    })
    const pairs = toEspnLeaguePairs({
      payload: {
        scoringPeriodId: 16,
        teams: [
          { id: 1, name: 'Alpha' },
          { id: 2, name: 'Bravo' }
        ],
        schedule: [row(15, 10), row(16, 40)]
      },
      displayWeek: 16,
      myTeamId: 1,
      matchupPeriod: { matchupPeriodId: 15, scoringPeriodIds: [15, 16] }
    })
    expect(pairs).toHaveLength(1)
    expect(pairs[0]?.id).toBe('1-2')
    expect(pairs[0]?.matchup.myPoints).toBe(40)
  })

  it('keeps a negative total and does not count an IR slot or a bye-week NFL team as still to play', () => {
    const body = JSON.parse(JSON.stringify(payload)) as {
      schedule: Array<{ home: { rosterForCurrentScoringPeriod?: { entries: unknown[] }; totalPointsLive: number } }>
    }
    const home = body.schedule[0]?.home
    if (!home) throw new Error('fixture missing home')
    home.totalPointsLive = -3.5
    home.rosterForCurrentScoringPeriod?.entries.push({
      lineupSlotId: 21,
      playerId: 99,
      playerPoolEntry: { player: { fullName: 'IR Back', defaultPositionId: 2, proTeamId: 12 } }
    })
    const pairs = toEspnLeaguePairs({
      payload: body,
      displayWeek: 1,
      myTeamId: 1,
      ticker,
      slate: ['DAL', 'NYG']
    })
    const mine = pairs.find((pair) => pair.mine)
    expect(mine?.matchup.myPoints).toBe(-3.5)
    expect(mine?.matchup.starters.map((player) => player.name)).toEqual(['Alpha QB'])
    expect(mine?.left).toBe(0)
    expect(mine?.oppLeft).toBe(0)
  })
})

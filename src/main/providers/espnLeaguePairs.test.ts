import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import type { NflTickerGame } from '@shared/types'
import { mergeEspnTeams, toEspnLeaguePairs, toEspnMatchup } from './espnAdapter'

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

  it('counts starters still to play from mRoster when mMatchupScore rows have no pro team', () => {
    const slot = (lineupSlotId: number, name: string, proTeamId: number) => ({
      lineupSlotId,
      playerId: proTeamId * 10 + lineupSlotId,
      playerPoolEntry: { player: { fullName: name, defaultPositionId: 1, proTeamId } }
    })
    const statsOnly = (lineupSlotId: number) => ({
      lineupSlotId,
      playerPoolEntry: { player: { stats: [{ statSourceId: 1, statSplitTypeId: 1, appliedTotal: 4 }] } }
    })
    const body = {
      scoringPeriodId: 1,
      teams: [
        {
          id: 1,
          name: 'Alpha',
          roster: {
            entries: [
              slot(0, 'Alpha QB', 6),
              slot(20, 'Alpha Bench', 12),
              slot(21, 'Alpha IR', 12)
            ]
          }
        },
        {
          id: 2,
          name: 'Bravo',
          roster: {
            entries: [slot(0, 'Bravo QB', 12), slot(2, 'Bravo RB', 6), slot(20, 'Bravo Bench', 22)]
          }
        }
      ],
      schedule: [
        {
          matchupPeriodId: 1,
          home: {
            teamId: 1,
            totalPointsLive: 10,
            rosterForCurrentScoringPeriod: { entries: [statsOnly(0), statsOnly(20)] }
          },
          away: {
            teamId: 2,
            totalPointsLive: 8,
            rosterForCurrentScoringPeriod: { entries: [statsOnly(0), statsOnly(2)] }
          }
        }
      ]
    }
    const pairs = toEspnLeaguePairs({ payload: body, displayWeek: 1, myTeamId: 1, ticker })
    const mine = pairs.find((pair) => pair.mine)
    expect(mine?.matchup.starters.map((player) => player.nflTeam)).toEqual(['DAL'])
    expect(mine?.matchup.oppStarters.map((player) => player.nflTeam)).toEqual(['KC', 'DAL'])
    expect(mine?.left).toBe(0)
    expect(mine?.oppLeft).toBe(1)
    const hud = toEspnMatchup({ payload: body, cookies, displayWeek: 1, myTeamId: 1 })
    expect(hud?.starters).toEqual([])
    expect(hud?.oppStarters).toEqual([])
  })

  it('counts a stats-only starter slot when that row already has a pro team', () => {
    const pairs = toEspnLeaguePairs({
      payload: {
        scoringPeriodId: 1,
        teams: [
          { id: 1, name: 'Alpha' },
          { id: 2, name: 'Bravo' }
        ],
        schedule: [
          {
            matchupPeriodId: 1,
            home: {
              teamId: 1,
              totalPointsLive: 0,
              rosterForCurrentScoringPeriod: {
                entries: [
                  { lineupSlotId: 0, playerPoolEntry: { player: { proTeamId: 12 } } },
                  { lineupSlotId: 21, playerPoolEntry: { player: { proTeamId: 6 } } }
                ]
              }
            },
            away: {
              teamId: 2,
              totalPointsLive: 0,
              rosterForCurrentScoringPeriod: {
                entries: [{ lineupSlotId: 2, playerPoolEntry: { player: { proTeamId: 6 } } }]
              }
            }
          }
        ]
      },
      displayWeek: 1,
      myTeamId: 1,
      ticker
    })
    const mine = pairs.find((pair) => pair.mine)
    expect(mine?.matchup.starters).toHaveLength(1)
    expect(mine?.left).toBe(1)
    expect(mine?.oppLeft).toBe(0)
  })

  it('uses mTeam names when mRoster teams are only id and roster', () => {
    const captured = JSON.parse(readFileSync(join(process.cwd(), 'fixtures/espn-roster-team-names.json'), 'utf8')) as {
      rosterOnly: unknown
      withTeamView: unknown
    }
    const period = { matchupPeriodId: 4, scoringPeriodIds: [4] }
    const bare = toEspnLeaguePairs({ payload: captured.rosterOnly, displayWeek: 4, myTeamId: 1, matchupPeriod: period })
    const bareNames = bare.flatMap((pair) => [pair.matchup.myTeam.name, pair.matchup.oppTeam?.name])
    expect(bareNames).toContain('Team 5')
    expect(bareNames).toContain('Team 6')
    expect(bareNames).not.toContain('5')
    expect(bareNames).not.toContain('6')

    const named = toEspnLeaguePairs({
      payload: captured.withTeamView,
      displayWeek: 4,
      myTeamId: 1,
      matchupPeriod: period
    })
    const juggernaut = named.find((pair) => pair.id === '5-6')
    expect(juggernaut?.matchup.myTeam.name).toBe('The Juggernaut')
    expect(juggernaut?.matchup.oppTeam?.name).toBe('Tortured Tight Ends Department')
    expect(juggernaut?.matchup.myPoints).toBe(40.16)
    expect(juggernaut?.matchup.oppPoints).toBe(48.72)
    const mine = named.find((pair) => pair.mine)
    expect(mine?.matchup.myTeam.name).toBe('Mr. T(ony)')
    expect(mine?.matchup.oppTeam?.name).toBe('Big Boy Toys')
    expect(named.flatMap((pair) => [pair.matchup.myTeam.name, pair.matchup.oppTeam?.name ?? ''])).not.toEqual(
      expect.arrayContaining(['Team 5', 'Team 11', '11'])
    )

    const identity = (captured.withTeamView as { teams: Record<string, unknown>[] }).teams.map((team) => {
      const { roster: _roster, ...row } = team
      return row
    })
    const merged = toEspnLeaguePairs({
      payload: mergeEspnTeams(captured.rosterOnly, identity),
      displayWeek: 4,
      myTeamId: 1,
      matchupPeriod: period
    })
    const mergedGame = merged.find((pair) => pair.id === '5-6')
    expect(mergedGame?.matchup.myTeam.name).toBe('The Juggernaut')
    expect(mergedGame?.matchup.oppTeam?.name).toBe('Tortured Tight Ends Department')
    const mergedTeams = (mergeEspnTeams(captured.rosterOnly, identity) as { teams: Record<string, unknown>[] }).teams
    expect(mergedTeams.find((team) => team.id === 5)?.roster).toEqual(
      (captured.rosterOnly as { teams: Record<string, unknown>[] }).teams[0]?.roster
    )
  })

  it('falls back to abbrev, then the owner, before a raw team id', () => {
    const period = { matchupPeriodId: 4, scoringPeriodIds: [4] }
    const schedule = [
      {
        matchupPeriodId: 4,
        home: { teamId: 11, totalPointsLive: 10 },
        away: { teamId: 6, totalPointsLive: 8 }
      }
    ]
    const abbrev = toEspnLeaguePairs({
      payload: {
        scoringPeriodId: 4,
        teams: [
          { id: 11, name: 11, abbrev: '361' },
          { id: 6, abbrev: 'SAD', primaryOwner: '{176868CA-FA85-46A2-A868-CAFA8576A2A4}' }
        ],
        members: [{ id: '{176868CA-FA85-46A2-A868-CAFA8576A2A4}', displayName: 'drake iz yoda' }],
        schedule
      },
      displayWeek: 4,
      myTeamId: 11,
      matchupPeriod: period
    })
    expect(abbrev[0]?.matchup.myTeam.name).toBe('361')
    expect(abbrev[0]?.matchup.oppTeam?.name).toBe('SAD')
    expect(abbrev[0]?.matchup.oppTeam?.owner).toBe('drake iz yoda')

    const owner = toEspnLeaguePairs({
      payload: {
        scoringPeriodId: 4,
        teams: [{ id: 6, name: '6', primaryOwner: '{176868CA-FA85-46A2-A868-CAFA8576A2A4}' }],
        members: [
          {
            id: '{176868CA-FA85-46A2-A868-CAFA8576A2A4}',
            displayName: 'drake iz yoda',
            firstName: 'Drake',
            lastName: 'Hernandez'
          }
        ],
        schedule: [{ matchupPeriodId: 4, home: { teamId: 6, totalPointsLive: 1 }, away: { teamId: 1, totalPointsLive: 2 } }]
      },
      displayWeek: 4,
      myTeamId: 6,
      matchupPeriod: period
    })
    expect(owner[0]?.matchup.myTeam.name).toBe('drake iz yoda')
    expect(owner[0]?.matchup.myTeam.name).not.toBe('6')
    expect(owner[0]?.matchup.oppTeam?.name).toBe('Team 1')
  })
})

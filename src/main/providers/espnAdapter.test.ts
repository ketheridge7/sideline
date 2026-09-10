import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { BENCH_SLOT_IDS, findMyTeam, getAppliedTotal, mergeEspnTeams, overlayEspnMatchup, overlayLiveScoring, toEspnActivity, toEspnMatchup, type EspnRosterEntry } from './espnAdapter'

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), 'fixtures/espn-league.json'), 'utf8')
) as unknown

const publicWeek1 = JSON.parse(
  readFileSync(join(process.cwd(), 'fixtures/espn-public-week1.json'), 'utf8')
) as unknown

const public2025Week1 = JSON.parse(
  readFileSync(join(process.cwd(), 'fixtures/espn-public-2025-week1.json'), 'utf8')
) as unknown

describe('getAppliedTotal', () => {
  it('prefers live actuals (statSourceId 0, statSplitTypeId 1)', () => {
    const entry: EspnRosterEntry = {
      playerPoolEntry: {
        appliedStatTotal: 18,
        player: {
          stats: [
            { statSourceId: 1, statSplitTypeId: 1, appliedTotal: 20 },
            { statSourceId: 0, statSplitTypeId: 1, appliedTotal: 24.1 }
          ]
        }
      }
    }
    expect(getAppliedTotal(entry)).toBe(24.1)
  })

  it('reads week actuals from entry.player.stats when playerPoolEntry is omitted', () => {
    const entry = {
      player: {
        stats: [{ statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 22.4 }]
      }
    } as EspnRosterEntry
    expect(getAppliedTotal(entry, 1)).toBe(22.4)
  })

  it('reads week actuals from playerPoolEntry.stats when player.stats is omitted', () => {
    const entry = {
      playerPoolEntry: {
        stats: [{ statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 22.4 }]
      }
    } as EspnRosterEntry
    expect(getAppliedTotal(entry, 1)).toBe(22.4)
  })

  it('uses the scoring period actual when multiple weeks are present', () => {
    const entry: EspnRosterEntry = {
      playerPoolEntry: {
        appliedStatTotal: 18,
        player: {
          stats: [
            { statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 13, appliedTotal: 99 },
            { statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 14, appliedTotal: 24.1 }
          ]
        }
      }
    }
    expect(getAppliedTotal(entry, 14)).toBe(24.1)
  })

  it('prefers a live unscoped actual over a stale week actual', () => {
    const entry: EspnRosterEntry = {
      playerPoolEntry: {
        appliedStatTotal: 22.4,
        player: {
          stats: [
            { statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 14, appliedTotal: 10 },
            { statSourceId: 0, statSplitTypeId: 1, appliedTotal: 22.4 }
          ]
        }
      }
    }
    expect(getAppliedTotal(entry, 14)).toBe(22.4)
  })

  it('lets a lower unscoped actual correct a leftover week actual', () => {
    const entry: EspnRosterEntry = {
      playerPoolEntry: {
        appliedStatTotal: 18,
        player: {
          stats: [
            { statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 22.4 },
            { statSourceId: 0, statSplitTypeId: 1, appliedTotal: 18 }
          ]
        }
      }
    }
    expect(getAppliedTotal(entry, 1)).toBe(18)
  })

  it('falls back to appliedStatTotal when live stats are missing', () => {
    const entry: EspnRosterEntry = {
      playerPoolEntry: { appliedStatTotal: 9.5, player: { stats: [] } }
    }
    expect(getAppliedTotal(entry)).toBe(9.5)
  })

  it('does not treat week projections as live player points', () => {
    const entry: EspnRosterEntry = {
      playerPoolEntry: {
        appliedStatTotal: 99,
        player: {
          stats: [{ statSourceId: 1, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 14.7 }]
        }
      }
    }
    expect(getAppliedTotal(entry, 1)).toBeUndefined()
  })

  it('reads nested playerPoolEntry liveScore when week projections are present', () => {
    const entry = {
      playerPoolEntry: {
        liveScore: 22.4,
        appliedStatTotal: 99,
        player: {
          stats: [{ statSourceId: 1, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 18 }]
        }
      }
    } as EspnRosterEntry
    expect(getAppliedTotal(entry, 1)).toBe(22.4)
  })

  it('prefers nested liveScore over a stale week actual on the same entry', () => {
    const entry = {
      playerPoolEntry: {
        liveScore: 22.4,
        appliedStatTotal: 99,
        player: {
          stats: [{ statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 10 }]
        }
      }
    } as EspnRosterEntry
    expect(getAppliedTotal(entry, 1)).toBe(22.4)
  })

  it('lets a lower liveScore correct a leftover week actual', () => {
    const entry = {
      playerPoolEntry: {
        liveScore: 18,
        player: {
          stats: [{ statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 22.4 }]
        }
      }
    } as EspnRosterEntry
    expect(getAppliedTotal(entry, 1)).toBe(18)
  })

  it('lets liveScore 0 correct leftover week actuals and leftover points', () => {
    const entry = {
      liveScore: 0,
      points: 99,
      playerPoolEntry: {
        liveScore: 0,
        player: {
          stats: [{ statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 22.4 }]
        }
      }
    } as EspnRosterEntry
    expect(getAppliedTotal(entry, 1)).toBe(0)
  })

  it('does not treat a zeroed totalPointsLive stub as a liveScore 0 correction', () => {
    const entry = {
      totalPointsLive: 0,
      points: 22.4,
      playerPoolEntry: {
        player: {
          stats: [{ statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 22.4 }]
        }
      }
    } as EspnRosterEntry
    expect(getAppliedTotal(entry, 1)).toBe(22.4)
  })

  it('lets a lower totalPointsLive correct leftover liveScore on the same player row', () => {
    const entry = {
      totalPointsLive: 18,
      liveScore: 22.4,
      playerPoolEntry: {
        liveScore: 22.4,
        player: {
          stats: [{ statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 22.4 }]
        }
      }
    } as EspnRosterEntry
    expect(getAppliedTotal(entry, 1)).toBe(18)
  })

  it('does not let a zeroed totalPointsLive hide liveScore on the same player row', () => {
    const entry = {
      playerPoolEntry: {
        totalPointsLive: 0,
        liveScore: 22.4,
        player: {
          stats: [{ statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 10 }]
        }
      }
    } as EspnRosterEntry
    expect(getAppliedTotal(entry, 1)).toBe(22.4)
  })

  it('prefers liveScore over leftover points when totalPointsLive is zero', () => {
    const entry = {
      playerPoolEntry: {
        totalPointsLive: 0,
        liveScore: 22.4,
        points: 99,
        player: {
          stats: [{ statSourceId: 1, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 18 }]
        }
      }
    } as EspnRosterEntry
    expect(getAppliedTotal(entry, 1)).toBe(22.4)
  })

  it('does not let a zeroed row totalPointsLive hide nested playerPoolEntry liveScore', () => {
    const entry = {
      totalPointsLive: 0,
      playerPoolEntry: {
        liveScore: 22.4,
        player: {
          stats: [{ statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 10 }]
        }
      }
    } as EspnRosterEntry
    expect(getAppliedTotal(entry, 1)).toBe(22.4)
  })

  it('reads finite numeric strings as live actuals', () => {
    const entry = {
      playerPoolEntry: {
        appliedStatTotal: '9.5',
        player: {
          stats: [{ statSourceId: '0', statSplitTypeId: '1', appliedTotal: '24.1' }]
        }
      }
    } as EspnRosterEntry
    expect(getAppliedTotal(entry)).toBe(24.1)
  })

  it('reads live actuals when stats is a keyed map', () => {
    const entry = {
      playerPoolEntry: {
        appliedStatTotal: 18,
        player: {
          stats: {
            '0': { statSourceId: 1, statSplitTypeId: 1, appliedTotal: 20 },
            '1': { statSourceId: 0, statSplitTypeId: 1, appliedTotal: 24.1 }
          }
        }
      }
    } as EspnRosterEntry
    expect(getAppliedTotal(entry)).toBe(24.1)
  })

  it('reads live actuals when stats is a single object', () => {
    const entry = {
      playerPoolEntry: {
        appliedStatTotal: 18,
        player: {
          stats: { statSourceId: 0, statSplitTypeId: 1, appliedTotal: 24.1 }
        }
      }
    } as EspnRosterEntry
    expect(getAppliedTotal(entry)).toBe(24.1)
  })

  it('reads nested liveScore objects on a player row', () => {
    const entry = {
      playerPoolEntry: {
        liveScore: { points: 22.4 },
        appliedStatTotal: 99
      }
    } as EspnRosterEntry
    expect(getAppliedTotal(entry, 1)).toBe(22.4)
  })
})

describe('toEspnMatchup', () => {
  it('identifies my team by SWID and reads live team totals', () => {
    const matchup = toEspnMatchup({
      payload: fixture,
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(matchup).not.toBeNull()
    expect(matchup?.myTeam.name).toBe('Sideline Squad')
    expect(matchup?.oppTeam?.name).toBe('Rival Club')
    expect(matchup?.myPoints).toBe(124.6)
    expect(matchup?.oppPoints).toBe(117.3)
  })

  it('unwraps a wrapped lm-api-reads envelope so a data/league shell cannot stall HUD', () => {
    const matchup = toEspnMatchup({
      payload: { data: fixture },
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(matchup?.myPoints).toBe(124.6)
    expect(matchup?.oppPoints).toBe(117.3)
    const fromLeague = toEspnMatchup({
      payload: { league: fixture },
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(fromLeague?.myPoints).toBe(124.6)
  })

  it('matches my team when SWID is percent-encoded', () => {
    const matchup = toEspnMatchup({
      payload: fixture,
      cookies: { espn_s2: 'x', SWID: '%7B11111111-1111-1111-1111-111111111111%7D' },
      displayWeek: 14
    })
    expect(matchup?.myTeam.name).toBe('Sideline Squad')
  })

  it('keeps bench and IR out of starters', () => {
    const matchup = toEspnMatchup({
      payload: fixture,
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    const starterIds = matchup?.starters.map((player) => player.playerId) ?? []
    const benchIds = matchup?.bench.map((player) => player.playerId) ?? []
    expect(starterIds).toContain('3139477')
    expect(starterIds).not.toContain('3918298')
    expect(starterIds).not.toContain('3918000')
    expect(benchIds).toEqual(['3918298', '3918000'])
    expect(matchup?.starters[0]?.points).toBe(24.1)
    expect(matchup?.oppStarters.map((player) => player.name)).toEqual([
      'Josh Allen',
      'Derrick Henry',
      'Justin Jefferson'
    ])
    expect(BENCH_SLOT_IDS.has(20)).toBe(true)
  })

  it('maps proTeamId to NFL abbr, hides ACTIVE, and shows IR', () => {
    const payload = {
      ...(fixture as Record<string, unknown>),
      members: [
        { id: '{11111111-1111-1111-1111-111111111111}', displayName: 'Kevin' },
        { id: '{22222222-2222-2222-2222-222222222222}', displayName: 'Rival' }
      ]
    }
    const matchup = toEspnMatchup({
      payload,
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(matchup?.myTeam.owner).toBe('Kevin')
    expect(matchup?.myTeam.owner).not.toBe('SNL')
    expect(matchup?.starters[0]?.nflTeam).toBe('KC')
    expect(matchup?.starters[0]?.status).toBeUndefined()
    expect(matchup?.bench.find((player) => player.name === 'IR Player')?.status).toBe('IR')
    expect(matchup?.bench.find((player) => player.name === 'IR Player')?.nflTeam).toBe('DEN')
  })

  it('reads members keyed by SWID so HUD owner names still bind', () => {
    const payload = {
      ...(fixture as Record<string, unknown>),
      members: {
        '{11111111-1111-1111-1111-111111111111}': { displayName: 'Kevin' },
        '{22222222-2222-2222-2222-222222222222}': {
          id: '{22222222-2222-2222-2222-222222222222}',
          displayName: 'Rival'
        }
      }
    }
    const matchup = toEspnMatchup({
      payload,
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(matchup?.myTeam.owner).toBe('Kevin')
    expect(matchup?.oppTeam.owner).toBe('Rival')
  })

  it('does not treat projected points as live scores', () => {
    const matchup = toEspnMatchup({
      payload: {
        teams: [
          {
            id: 1,
            primaryOwner: '{11111111-1111-1111-1111-111111111111}',
            location: 'Mine',
            nickname: 'Squad'
          },
          { id: 2, location: 'Them', nickname: 'Squad' }
        ],
        schedule: [
          {
            matchupPeriodId: 1,
            home: {
              teamId: 1,
              totalPointsLive: 0,
              totalPoints: 0,
              totalProjectedPointsLive: 101.46,
              cumulativeScoreLive: { wins: 0, losses: 0, ties: 0 }
            },
            away: {
              teamId: 2,
              totalPointsLive: 0,
              totalPoints: 0,
              totalProjectedPointsLive: 94.2
            }
          }
        ]
      },
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 1
    })
    expect(matchup?.myPoints).toBe(0)
    expect(matchup?.oppPoints).toBe(0)
  })

  it('keeps leftover boxscore starters that compact mLiveScoring omitted', () => {
    const matchup = toEspnMatchup({
      payload: {
        teams: [
          {
            id: 1,
            primaryOwner: '{11111111-1111-1111-1111-111111111111}',
            location: 'Mine',
            nickname: 'Squad'
          },
          { id: 2, location: 'Them', nickname: 'Squad' }
        ],
        schedule: [
          {
            matchupPeriodId: 1,
            home: {
              teamId: 1,
              rosterForCurrentScoringPeriod: {
                entries: [
                  {
                    playerId: 100,
                    lineupSlotId: 0,
                    playerPoolEntry: {
                      player: {
                        fullName: 'Hurts',
                        stats: [
                          { statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 0 }
                        ]
                      }
                    }
                  },
                  {
                    playerId: 999,
                    lineupSlotId: 2,
                    playerPoolEntry: {
                      player: {
                        fullName: 'Nico',
                        stats: [
                          { statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 0 }
                        ]
                      }
                    }
                  }
                ]
              }
            },
            away: { teamId: 2 }
          }
        ],
        liveScoring: {
          teams: [
            {
              teamId: 1,
              totalPointsLive: 18,
              players: [{ playerId: 100, liveScore: 18, lineupSlotId: 0, playerPoolEntry: { player: { fullName: 'Hurts' } } }]
            },
            {
              teamId: 2,
              totalPointsLive: 12,
              players: [{ playerId: 200, liveScore: 12 }]
            }
          ]
        }
      },
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 1
    })
    expect(matchup?.myPoints).toBe(18)
    expect(matchup?.starters.map((player) => player.playerId)).toEqual(['100', '999'])
    expect(matchup?.starters[0]?.name).toBe('Hurts')
    expect(matchup?.starters[0]?.points).toBe(18)
    expect(matchup?.starters[1]?.name).toBe('Nico')
    expect(matchup?.starters[1]?.points).toBe(0)
  })

  it('does not add quoted bench lineupSlotId actuals to the team total', () => {
    const matchup = toEspnMatchup({
      payload: {
        teams: [
          {
            id: 1,
            primaryOwner: '{11111111-1111-1111-1111-111111111111}',
            location: 'Mine',
            nickname: 'Squad'
          },
          { id: 2, location: 'Them', nickname: 'Squad' }
        ],
        schedule: [
          {
            matchupPeriodId: 1,
            home: {
              teamId: 1,
              totalPointsLive: 12.4,
              rosterForCurrentScoringPeriod: {
                entries: [
                  {
                    lineupSlotId: '0',
                    playerId: 7,
                    playerPoolEntry: {
                      player: {
                        fullName: 'Starter',
                        defaultPositionId: '1',
                        proTeamId: '12',
                        stats: [{ statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 12.4 }]
                      }
                    }
                  },
                  {
                    lineupSlotId: '20',
                    playerId: 8,
                    playerPoolEntry: {
                      player: {
                        fullName: 'Bench',
                        defaultPositionId: 2,
                        stats: [{ statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 18.8 }]
                      }
                    }
                  }
                ]
              }
            },
            away: { teamId: 2, totalPointsLive: 9 }
          }
        ]
      },
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 1
    })
    expect(matchup?.myPoints).toBe(12.4)
    expect(matchup?.starters.map((player) => player.name)).toEqual(['Starter'])
    expect(matchup?.starters[0]?.position).toBe('QB')
    expect(matchup?.starters[0]?.nflTeam).toBe('KC')
    expect(matchup?.bench.map((player) => player.name)).toEqual(['Bench'])
  })

  it('scores from schedule when teams[] is empty if myTeamId is known', () => {
    const matchup = toEspnMatchup({
      payload: {
        teams: [],
        schedule: [
          {
            matchupPeriodId: 1,
            home: { teamId: 7, totalPointsLive: 41.2 },
            away: { teamId: 2, totalPointsLive: 27.6 }
          }
        ]
      },
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 1,
      myTeamId: 7
    })
    expect(matchup?.myPoints).toBe(41.2)
    expect(matchup?.oppPoints).toBe(27.6)
    expect(matchup?.myTeam.id).toBe('7')
  })

  it('uses week actuals when totalPointsLive is still zero', () => {
    const matchup = toEspnMatchup({
      payload: {
        teams: [
          {
            id: 1,
            primaryOwner: '{11111111-1111-1111-1111-111111111111}',
            location: 'Mine',
            nickname: 'Squad'
          },
          { id: 2, location: 'Them', nickname: 'Squad' }
        ],
        schedule: [
          {
            matchupPeriodId: 1,
            home: {
              teamId: 1,
              totalPointsLive: 0,
              totalPoints: 0,
              totalProjectedPointsLive: 101.46,
              pointsByScoringPeriod: { '1': 22.4 }
            },
            away: {
              teamId: 2,
              totalPointsLive: 0,
              totalPoints: 0,
              pointsByScoringPeriod: { '1': 18.1 }
            }
          }
        ]
      },
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 1
    })
    expect(matchup?.myPoints).toBe(22.4)
    expect(matchup?.oppPoints).toBe(18.1)
  })

  it('sums starter actuals when team live totals are still zero', () => {
    const matchup = toEspnMatchup({
      payload: {
        teams: [
          {
            id: 1,
            primaryOwner: '{11111111-1111-1111-1111-111111111111}',
            location: 'Mine',
            nickname: 'Squad'
          },
          { id: 2, location: 'Them', nickname: 'Squad' }
        ],
        schedule: [
          {
            matchupPeriodId: 1,
            home: {
              teamId: 1,
              totalPointsLive: 0,
              totalPoints: 0,
              totalProjectedPointsLive: 101.46,
              rosterForCurrentScoringPeriod: {
                entries: [
                  {
                    lineupSlotId: 0,
                    playerId: 1,
                    playerPoolEntry: {
                      appliedStatTotal: 0,
                      player: {
                        fullName: 'QB',
                        stats: [
                          { statSourceId: 1, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 18 },
                          { statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 10 }
                        ]
                      }
                    }
                  },
                  {
                    lineupSlotId: 2,
                    playerId: 2,
                    playerPoolEntry: {
                      player: {
                        fullName: 'RB',
                        stats: [{ statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 12.4 }]
                      }
                    }
                  },
                  {
                    lineupSlotId: 20,
                    playerId: 3,
                    playerPoolEntry: {
                      player: {
                        fullName: 'Bench',
                        stats: [{ statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 40 }]
                      }
                    }
                  }
                ]
              }
            },
            away: { teamId: 2, totalPointsLive: 0, totalPoints: 0 }
          }
        ]
      },
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 1
    })
    expect(matchup?.myPoints).toBe(22.4)
    expect(matchup?.starters.map((player) => player.points)).toEqual([10, 12.4])
  })

  it('does not leak owner abbrev when members are missing', () => {
    const matchup = toEspnMatchup({
      payload: fixture,
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(matchup?.myTeam.owner).toBe('')
    expect(matchup?.starters[0]?.nflTeam).toBe('KC')
  })

  it('fills live totals from mLiveScoring when the schedule side is thin', () => {
    const payload = {
      scoringPeriodId: 14,
      status: { latestScoringPeriod: 14, currentMatchupPeriod: 14 },
      teams: [
        {
          id: 1,
          location: 'Sideline',
          nickname: 'Squad',
          primaryOwner: '{11111111-1111-1111-1111-111111111111}',
          record: { overall: { wins: 1, losses: 0, ties: 0 } }
        },
        {
          id: 2,
          location: 'Rival',
          nickname: 'Club',
          primaryOwner: '{22222222-2222-2222-2222-222222222222}',
          record: { overall: { wins: 0, losses: 1, ties: 0 } }
        }
      ],
      schedule: [
        {
          matchupPeriodId: 14,
          home: { teamId: 1 },
          away: { teamId: 2 }
        }
      ],
      liveScoring: {
        teams: [
          {
            teamId: 1,
            totalPointsLive: 88.4,
            rosterForCurrentScoringPeriod: {
              entries: [
                {
                  lineupSlotId: 0,
                  playerId: 1,
                  playerPoolEntry: {
                    appliedStatTotal: 12,
                    player: { fullName: 'Live QB', defaultPositionId: 1, proTeamId: 12, stats: [] }
                  }
                }
              ]
            }
          },
          { teamId: 2, totalPointsLive: 70.1 }
        ]
      }
    }
    const matchup = toEspnMatchup({
      payload,
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(matchup?.myPoints).toBe(88.4)
    expect(matchup?.oppPoints).toBe(70.1)
    expect(matchup?.starters[0]?.name).toBe('Live QB')
    expect(matchup?.starters[0]?.points).toBe(12)
  })

  it('reads mLiveScoring teams when ESPN sends a teamId map instead of an array', () => {
    const payload = {
      scoringPeriodId: 14,
      teams: [
        {
          id: 1,
          location: 'Sideline',
          nickname: 'Squad',
          primaryOwner: '{11111111-1111-1111-1111-111111111111}'
        },
        { id: 2, location: 'Rival', nickname: 'Club' }
      ],
      schedule: [{ matchupPeriodId: 14, home: { teamId: 1 }, away: { teamId: 2 } }],
      liveScoring: {
        teams: {
          '1': { teamId: 1, totalPointsLive: 88.4 },
          '2': { teamId: 2, totalPointsLive: 70.1 }
        }
      }
    }
    const matchup = toEspnMatchup({
      payload,
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(matchup?.myPoints).toBe(88.4)
    expect(matchup?.oppPoints).toBe(70.1)
  })

  it('reads nested liveScore and totalPointsLive objects the same way Sleeper nested chips do', () => {
    const payload = {
      scoringPeriodId: 14,
      teams: [
        {
          id: 1,
          location: 'Sideline',
          nickname: 'Squad',
          primaryOwner: '{11111111-1111-1111-1111-111111111111}'
        },
        { id: 2, location: 'Rival', nickname: 'Club' }
      ],
      schedule: [
        {
          matchupPeriodId: 14,
          home: { teamId: 1, totalPointsLive: { points: 88.4 } },
          away: { teamId: 2, liveScore: { pts: 70.1 } }
        }
      ]
    }
    const matchup = toEspnMatchup({
      payload,
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(matchup?.myPoints).toBe(88.4)
    expect(matchup?.oppPoints).toBe(70.1)
    const fromMap = toEspnMatchup({
      payload: {
        scoringPeriodId: 14,
        teams: payload.teams,
        schedule: [{ matchupPeriodId: 14, home: { teamId: 1 }, away: { teamId: 2 } }],
        liveScoring: { teams: { '1': { points: 88.4 }, '2': { pts: 70.1 } } }
      },
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(fromMap?.myPoints).toBe(88.4)
    expect(fromMap?.oppPoints).toBe(70.1)
    const fromArray = toEspnMatchup({
      payload: {
        scoringPeriodId: 14,
        teams: payload.teams,
        schedule: [{ matchupPeriodId: 14, home: { teamId: 1 }, away: { teamId: 2 } }],
        liveScoring: { teams: [{ teamId: 1, pts: 88.4 }, { teamId: 2, pts: 70.1 }] }
      },
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(fromArray?.myPoints).toBe(88.4)
    expect(fromArray?.oppPoints).toBe(70.1)
  })

  it('reads schedule games when ESPN nests them under games or a matchup-id map', () => {
    const teams = [
      {
        id: 1,
        location: 'Sideline',
        nickname: 'Squad',
        primaryOwner: '{11111111-1111-1111-1111-111111111111}'
      },
      { id: 2, location: 'Rival', nickname: 'Club' }
    ]
    const game = {
      matchupPeriodId: 14,
      home: { teamId: 1, totalPointsLive: 88.4 },
      away: { teamId: 2, totalPointsLive: 70.1 }
    }
    const nested = toEspnMatchup({
      payload: { scoringPeriodId: 14, teams, schedule: { games: [game] } },
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(nested?.myPoints).toBe(88.4)
    expect(nested?.oppPoints).toBe(70.1)
    const keyed = toEspnMatchup({
      payload: { scoringPeriodId: 14, teams, schedule: { '7': game } },
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(keyed?.myPoints).toBe(88.4)
  })

  it('reads identity teams when ESPN sends a teamId map instead of an array', () => {
    const payload = {
      scoringPeriodId: 14,
      teams: {
        '1': {
          location: 'Sideline',
          nickname: 'Squad',
          primaryOwner: '{11111111-1111-1111-1111-111111111111}'
        },
        '2': { id: '2', location: 'Rival', nickname: 'Club' }
      },
      schedule: [{ matchupPeriodId: 14, home: { teamId: 1 }, away: { teamId: 2 } }],
      liveScoring: {
        teams: [
          { teamId: 1, totalPointsLive: 88.4 },
          { teamId: 2, totalPointsLive: 70.1 }
        ]
      }
    }
    const matchup = toEspnMatchup({
      payload,
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(matchup?.myTeam.id).toBe('1')
    expect(matchup?.myTeam.name).toBe('Sideline Squad')
    expect(matchup?.oppTeam?.id).toBe('2')
    expect(matchup?.myPoints).toBe(88.4)
    expect(matchup?.oppPoints).toBe(70.1)
  })

  it('does not treat a liveScoring points map as identity teams', () => {
    const payload = {
      scoringPeriodId: 14,
      teams: { '1': 88.4, '2': 70.1 },
      schedule: [{ matchupPeriodId: 14, home: { teamId: 1 }, away: { teamId: 2 } }]
    }
    const matchup = toEspnMatchup({
      payload,
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(matchup).toBeNull()
  })

  it('reads mLiveScoring teamId maps when the team id is only the object key', () => {
    const payload = {
      scoringPeriodId: 14,
      teams: [
        {
          id: 1,
          location: 'Sideline',
          nickname: 'Squad',
          primaryOwner: '{11111111-1111-1111-1111-111111111111}'
        },
        { id: 2, location: 'Rival', nickname: 'Club' }
      ],
      schedule: [{ matchupPeriodId: 14, home: { teamId: 1 }, away: { teamId: 2 } }],
      liveScoring: {
        uid: 'ignore-me',
        scoringPeriodId: 14,
        '1': { totalPointsLive: 88.4 },
        '2': { totalPointsLive: 70.1 }
      }
    }
    const matchup = toEspnMatchup({
      payload,
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(matchup?.myPoints).toBe(88.4)
    expect(matchup?.oppPoints).toBe(70.1)
  })

  it('reads mLiveScoring when the teamId map is the liveScoring object itself', () => {
    const payload = {
      scoringPeriodId: 14,
      teams: [
        {
          id: 1,
          location: 'Sideline',
          nickname: 'Squad',
          primaryOwner: '{11111111-1111-1111-1111-111111111111}'
        },
        { id: 2, location: 'Rival', nickname: 'Club' }
      ],
      schedule: [{ matchupPeriodId: 14, home: { teamId: 1 }, away: { teamId: 2 } }],
      liveScoring: {
        '1': { teamId: 1, totalPointsLive: 88.4 },
        '2': { teamId: 2, totalPointsLive: 70.1 }
      }
    }
    const matchup = toEspnMatchup({
      payload,
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(matchup?.myPoints).toBe(88.4)
    expect(matchup?.oppPoints).toBe(70.1)
  })

  it('overlays mLiveScoring players maps onto a cached roster', () => {
    const cookies = { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' }
    const cached = {
      teams: [
        {
          id: 1,
          primaryOwner: '{11111111-1111-1111-1111-111111111111}',
          location: 'Sideline',
          nickname: 'Squad'
        },
        { id: 2, location: 'Rival', nickname: 'Club' }
      ],
      schedule: [
        {
          matchupPeriodId: 14,
          home: {
            teamId: 1,
            totalPointsLive: 10,
            rosterForCurrentScoringPeriod: {
              entries: [
                {
                  lineupSlotId: 0,
                  playerId: 7,
                  playerPoolEntry: {
                    appliedStatTotal: 10,
                    player: {
                      fullName: 'Cached QB',
                      defaultPositionId: 1,
                      proTeamId: 12,
                      stats: [
                        { statSourceId: 1, statSplitTypeId: 1, scoringPeriodId: 14, appliedTotal: 18.2 }
                      ]
                    }
                  }
                }
              ]
            }
          },
          away: { teamId: 2, totalPointsLive: 8 }
        }
      ]
    }
    const liveOnly = {
      liveScoring: {
        teams: {
          '1': {
            totalPointsLive: 41.2,
            players: {
              '7': { totalPointsLive: 22.4, lineupSlotId: 0 }
            }
          },
          '2': { totalPointsLive: 27.6, players: { '9': { liveScore: 27.6, lineupSlotId: 2 } } }
        }
      }
    }
    const matchup = toEspnMatchup({
      payload: overlayLiveScoring(cached, liveOnly),
      cookies,
      displayWeek: 14
    })
    expect(matchup?.myPoints).toBe(41.2)
    expect(matchup?.oppPoints).toBe(27.6)
    expect(matchup?.starters[0]?.name).toBe('Cached QB')
    expect(matchup?.starters[0]?.points).toBe(22.4)
  })

  it('reads rosterForMatchupPeriod when rosterForCurrentScoringPeriod is omitted', () => {
    const payload = {
      scoringPeriodId: 14,
      teams: [
        {
          id: 1,
          location: 'Sideline',
          nickname: 'Squad',
          primaryOwner: '{11111111-1111-1111-1111-111111111111}'
        },
        { id: 2, location: 'Rival', nickname: 'Club' }
      ],
      schedule: [{ matchupPeriodId: 14, home: { teamId: 1 }, away: { teamId: 2 } }],
      liveScoring: {
        teams: [
          {
            teamId: 1,
            totalPointsLive: 0,
            rosterForMatchupPeriod: {
              entries: [
                {
                  lineupSlotId: 0,
                  playerId: 1,
                  playerPoolEntry: {
                    appliedStatTotal: 12.4,
                    player: { fullName: 'Live QB', defaultPositionId: 1, proTeamId: 12, stats: [] }
                  }
                }
              ]
            }
          },
          { teamId: 2, totalPointsLive: 8.1 }
        ]
      }
    }
    const matchup = toEspnMatchup({
      payload,
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(matchup?.myPoints).toBe(12.4)
    expect(matchup?.starters[0]?.name).toBe('Live QB')
    expect(matchup?.starters[0]?.points).toBe(12.4)
  })

  it('reads roster entries keyed by player id so Sunday starters still bind', () => {
    const payload = {
      scoringPeriodId: 14,
      teams: [
        {
          id: 1,
          location: 'Sideline',
          nickname: 'Squad',
          primaryOwner: '{11111111-1111-1111-1111-111111111111}'
        },
        { id: 2, location: 'Rival', nickname: 'Club' }
      ],
      schedule: [{ matchupPeriodId: 14, home: { teamId: 1 }, away: { teamId: 2 } }],
      liveScoring: {
        teams: [
          {
            teamId: 1,
            totalPointsLive: 0,
            rosterForCurrentScoringPeriod: {
              entries: {
                '3139477': {
                  lineupSlotId: 0,
                  liveScore: 22.4,
                  playerPoolEntry: {
                    id: 3139477,
                    player: { fullName: 'Map QB', defaultPositionId: 1, proTeamId: 12 }
                  }
                },
                '0': {
                  lineupSlotId: 20,
                  liveScore: 1,
                  player: { id: 9, fullName: 'Bench WR' }
                }
              }
            }
          },
          { teamId: 2, totalPointsLive: 8.1 }
        ]
      }
    }
    const matchup = toEspnMatchup({
      payload,
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(matchup?.starters.map((player) => player.name)).toEqual(['Map QB'])
    expect(matchup?.starters[0]?.points).toBe(22.4)
    expect(matchup?.starters[0]?.playerId).toBe('3139477')
    expect(matchup?.bench.map((player) => player.name)).toEqual(['Bench WR'])
    expect(matchup?.myPoints).toBe(22.4)
  })

  it('reads roster entry maps when ESPN nests pts instead of liveScore', () => {
    const payload = {
      scoringPeriodId: 14,
      teams: [
        {
          id: 1,
          location: 'Sideline',
          nickname: 'Squad',
          primaryOwner: '{11111111-1111-1111-1111-111111111111}'
        },
        { id: 2, location: 'Rival', nickname: 'Club' }
      ],
      schedule: [{ matchupPeriodId: 14, home: { teamId: 1 }, away: { teamId: 2 } }],
      liveScoring: {
        teams: [
          {
            teamId: 1,
            totalPointsLive: 0,
            rosterForCurrentScoringPeriod: {
              entries: {
                '3139477': {
                  lineupSlotId: 0,
                  pts: 22.4,
                  player: { id: 3139477, fullName: 'Map QB', defaultPositionId: 1, proTeamId: 12 }
                }
              }
            }
          },
          { teamId: 2, totalPointsLive: 8.1 }
        ]
      }
    }
    const matchup = toEspnMatchup({
      payload,
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(matchup?.starters[0]?.points).toBe(22.4)
    expect(matchup?.myPoints).toBe(22.4)
  })

  it('does not let leftover roster pts hide week appliedTotal', () => {
    const payload = {
      scoringPeriodId: 14,
      teams: [
        {
          id: 1,
          location: 'Sideline',
          nickname: 'Squad',
          primaryOwner: '{11111111-1111-1111-1111-111111111111}'
        },
        { id: 2, location: 'Rival', nickname: 'Club' }
      ],
      schedule: [{ matchupPeriodId: 14, home: { teamId: 1 }, away: { teamId: 2 } }],
      liveScoring: {
        teams: [
          {
            teamId: 1,
            rosterForCurrentScoringPeriod: {
              entries: [
                {
                  lineupSlotId: 0,
                  playerId: 3139477,
                  pts: 99,
                  appliedTotal: 18,
                  player: { id: 3139477, fullName: 'QB', defaultPositionId: 1, proTeamId: 12 }
                }
              ]
            }
          },
          { teamId: 2, totalPointsLive: 8.1 }
        ]
      }
    }
    const matchup = toEspnMatchup({
      payload,
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(matchup?.starters[0]?.points).toBe(18)
    expect(matchup?.myPoints).toBe(18)
  })

  it('overlays mLiveScoring player actuals onto a same-size schedule roster stuck at 0', () => {
    const payload = {
      scoringPeriodId: 14,
      status: { latestScoringPeriod: 14, currentMatchupPeriod: 14 },
      teams: [
        {
          id: 1,
          location: 'Sideline',
          nickname: 'Squad',
          primaryOwner: '{11111111-1111-1111-1111-111111111111}'
        },
        {
          id: 2,
          location: 'Rival',
          nickname: 'Club',
          primaryOwner: '{22222222-2222-2222-2222-222222222222}'
        }
      ],
      schedule: [
        {
          matchupPeriodId: 14,
          home: {
            teamId: 1,
            totalPointsLive: 0,
            rosterForCurrentScoringPeriod: {
              entries: [
                {
                  lineupSlotId: 0,
                  playerId: 1,
                  playerPoolEntry: {
                    appliedStatTotal: 0,
                    player: { fullName: 'Live QB', defaultPositionId: 1, proTeamId: 12, stats: [] }
                  }
                }
              ]
            }
          },
          away: { teamId: 2, totalPointsLive: 0 }
        }
      ],
      liveScoring: {
        teams: [
          {
            teamId: 1,
            totalPointsLive: 88.4,
            rosterForCurrentScoringPeriod: {
              entries: [
                {
                  lineupSlotId: 0,
                  playerId: 1,
                  playerPoolEntry: {
                    appliedStatTotal: 12.4,
                    player: {
                      fullName: 'Live QB',
                      defaultPositionId: 1,
                      proTeamId: 12,
                      stats: [{ statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 14, appliedTotal: 12.4 }]
                    }
                  }
                }
              ]
            }
          },
          { teamId: 2, totalPointsLive: 70.1 }
        ]
      }
    }
    const matchup = toEspnMatchup({
      payload,
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(matchup?.myPoints).toBe(88.4)
    expect(matchup?.starters[0]?.name).toBe('Live QB')
    expect(matchup?.starters[0]?.points).toBe(12.4)
  })

  it('keeps mLiveScoring totals when the schedule side is stuck at 0', () => {
    const payload = {
      scoringPeriodId: 14,
      status: { latestScoringPeriod: 14, currentMatchupPeriod: 14 },
      teams: [
        {
          id: 1,
          location: 'Sideline',
          nickname: 'Squad',
          primaryOwner: '{11111111-1111-1111-1111-111111111111}'
        },
        {
          id: 2,
          location: 'Rival',
          nickname: 'Club',
          primaryOwner: '{22222222-2222-2222-2222-222222222222}'
        }
      ],
      schedule: [
        {
          matchupPeriodId: 14,
          home: { teamId: 1, totalPointsLive: 0, totalPoints: 0 },
          away: { teamId: 2, totalPointsLive: 0, totalPoints: 0 }
        }
      ],
      liveScoring: {
        teams: [
          { teamId: 1, totalPointsLive: 88.4 },
          { teamId: 2, totalPointsLive: 70.1 }
        ]
      }
    }
    const matchup = toEspnMatchup({
      payload,
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(matchup?.myPoints).toBe(88.4)
    expect(matchup?.oppPoints).toBe(70.1)
  })

  it('parses a live-view payload captured from public ESPN league 899513', () => {
    const matchup = toEspnMatchup({
      payload: publicWeek1,
      cookies: { espn_s2: 'x', SWID: '{219A4C65-317E-4BD2-A5E4-D8B50AFE4FBF}' },
      displayWeek: 1
    })
    expect(matchup).not.toBeNull()
    expect(matchup?.starters[0]?.name).toBe('James Cook III')
    expect(typeof matchup?.myPoints).toBe('number')
    expect(matchup?.oppTeam).not.toBeNull()
  })

  it('reads completed-week totals and player actuals from public ESPN league 899513 (2025 week 1)', () => {
    const matchup = toEspnMatchup({
      payload: public2025Week1,
      cookies: { espn_s2: 'x', SWID: '{05B95FAE-8345-4823-B95F-AE8345382379}' },
      displayWeek: 1
    })
    expect(matchup?.myPoints).toBe(112.24)
    expect(matchup?.starters[0]?.name).toBe('Nico Collins')
    expect(matchup?.starters[0]?.points).toBe(2.5)
    expect(matchup?.starters[0]?.nflTeam).toBe('HOU')
    expect(matchup?.oppTeam?.name).toBe('SLB')
  })

  it('rebuilds identity when the live payload has no teams array (mMatchupScore + mLiveScoring)', () => {
    const live = public2025Week1 as Record<string, unknown>
    const cached = (live.teams as Record<string, unknown>[]).map((team) => ({
      id: team.id,
      abbrev: team.abbrev,
      location: team.location,
      nickname: team.nickname,
      primaryOwner: team.primaryOwner,
      owners: team.owners,
      record: team.record
    }))
    const { teams: _dropped, ...scoreOnly } = live
    const matchup = toEspnMatchup({
      payload: mergeEspnTeams(scoreOnly, cached),
      cookies: { espn_s2: 'x', SWID: '{05B95FAE-8345-4823-B95F-AE8345382379}' },
      displayWeek: 1
    })
    expect(matchup?.myPoints).toBe(112.24)
    expect(matchup?.starters[0]?.name).toBe('Nico Collins')
    expect(matchup?.oppTeam?.name).toBe('SLB')
  })

  it('keeps the requested week when ESPN status still points at last week', () => {
    const payload = {
      scoringPeriodId: 1,
      status: { latestScoringPeriod: 1, currentMatchupPeriod: 1 },
      teams: [
        {
          id: 1,
          location: 'Sideline',
          nickname: 'Squad',
          primaryOwner: '{11111111-1111-1111-1111-111111111111}'
        },
        {
          id: 2,
          location: 'Rival',
          nickname: 'Club',
          primaryOwner: '{22222222-2222-2222-2222-222222222222}'
        }
      ],
      schedule: [
        {
          matchupPeriodId: 2,
          home: { teamId: 1, totalPointsLive: 44.2, totalPoints: 0 },
          away: { teamId: 2, totalPointsLive: 31.1, totalPoints: 0 }
        }
      ]
    }
    const matchup = toEspnMatchup({
      payload,
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 2
    })
    expect(matchup?.myPoints).toBe(44.2)
    expect(matchup?.oppPoints).toBe(31.1)
  })

  it('merges cached owners onto an mScoreboard payload that omitted primaryOwner', () => {
    const live = {
      scoringPeriodId: 1,
      status: { latestScoringPeriod: 1, currentMatchupPeriod: 1 },
      teams: [
        { id: 1, abbrev: 'SNL', record: { overall: { wins: 1, losses: 0, ties: 0 } } },
        { id: 2, abbrev: 'RIV' }
      ],
      schedule: [
        {
          matchupPeriodId: 1,
          home: { teamId: 1, totalPointsLive: 21.4 },
          away: { teamId: 2, totalPointsLive: 18.1 }
        }
      ]
    }
    const cached = [
      {
        id: 1,
        location: 'Sideline',
        nickname: 'Squad',
        primaryOwner: '{11111111-1111-1111-1111-111111111111}'
      },
      {
        id: 2,
        location: 'Rival',
        nickname: 'Club',
        primaryOwner: '{22222222-2222-2222-2222-222222222222}'
      }
    ]
    const matchup = toEspnMatchup({
      payload: mergeEspnTeams(live, cached),
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 1
    })
    expect(matchup?.myTeam.name).toBe('Sideline Squad')
    expect(matchup?.myPoints).toBe(21.4)
    expect(matchup?.oppTeam?.name).toBe('Rival Club')
  })

  it('matches SWID when owners is an object list and primaryOwner is omitted', () => {
    const payload = {
      scoringPeriodId: 1,
      teams: [
        {
          id: 1,
          location: 'Sideline',
          nickname: 'Squad',
          owners: [{ id: '{11111111-1111-1111-1111-111111111111}' }]
        },
        {
          id: 2,
          location: 'Rival',
          nickname: 'Club',
          owners: [{ id: '{22222222-2222-2222-2222-222222222222}' }]
        }
      ],
      schedule: [
        {
          matchupPeriodId: 1,
          home: { teamId: 1, totalPointsLive: 21.4 },
          away: { teamId: 2, totalPointsLive: 18.1 }
        }
      ]
    }
    const mine = findMyTeam(payload.teams, {
      espn_s2: 'x',
      SWID: '{11111111-1111-1111-1111-111111111111}'
    })
    expect(mine?.id).toBe(1)
    const matchup = toEspnMatchup({
      payload,
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 1
    })
    expect(matchup?.myTeam.name).toBe('Sideline Squad')
    expect(matchup?.myPoints).toBe(21.4)
  })

  it('does not bind HUD to teams[0] when cookies exist and SWID matches no owner', () => {
    const teams = [
      {
        id: 1,
        location: 'Sideline',
        nickname: 'Squad',
        primaryOwner: '{11111111-1111-1111-1111-111111111111}'
      },
      {
        id: 2,
        location: 'Rival',
        nickname: 'Club',
        primaryOwner: '{22222222-2222-2222-2222-222222222222}'
      }
    ]
    expect(
      findMyTeam(teams, { espn_s2: 'x', SWID: '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}' })
    ).toBeUndefined()
    const matchup = toEspnMatchup({
      payload: {
        scoringPeriodId: 1,
        teams,
        schedule: [
          {
            matchupPeriodId: 1,
            home: { teamId: 1, totalPointsLive: 21.4 },
            away: { teamId: 2, totalPointsLive: 18.1 }
          }
        ]
      },
      cookies: { espn_s2: 'x', SWID: '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}' },
      displayWeek: 1
    })
    expect(matchup).toBeNull()
  })
})

describe('toEspnActivity', () => {
  it('maps kona waiver add/drop message types', () => {
    const rows = toEspnActivity({
      topics: [
        {
          id: 'topic-1',
          date: 1_720_000_000_000,
          messages: [
            {
              messageTypeId: 180,
              for: { firstName: 'Rome', lastName: 'Odunze' }
            },
            {
              messageTypeId: 179,
              for: { firstName: 'Tank', lastName: 'Dell' }
            }
          ]
        }
      ]
    })
    expect(rows).toEqual([
      {
        id: 'topic-1',
        type: 'add_drop',
        players: ['Rome Odunze', 'Tank Dell'],
        timestamp: 1_720_000_000_000
      }
    ])
  })
})

describe('overlayEspnMatchup', () => {
  const prev = {
    myTeam: { id: '1', name: 'Mine', owner: 'Me', record: '0-0' },
    oppTeam: { id: '2', name: 'Them', owner: 'You', record: '0-0' },
    myPoints: 10,
    oppPoints: 8,
    starters: [{ playerId: '100', name: 'Hurts', position: 'QB', nflTeam: 'PHI', points: 10 }],
    bench: [],
    oppStarters: [{ playerId: '200', name: 'Mahomes', position: 'QB', nflTeam: 'KC', points: 8 }],
    oppBench: []
  }

  it('paints live points onto last HUD without waiting on mMatchupScore', () => {
    const live = {
      liveScoring: {
        teams: [
          { teamId: 1, totalPointsLive: 22.4, players: [{ playerId: 100, totalPointsLive: 22.4 }] },
          { teamId: 2, totalPointsLive: 15.1, players: [{ playerId: 200, totalPointsLive: 15.1 }] }
        ]
      }
    }
    const next = overlayEspnMatchup(prev, live, 1)
    expect(next?.myPoints).toBe(22.4)
    expect(next?.oppPoints).toBe(15.1)
    expect(next?.starters[0]?.name).toBe('Hurts')
    expect(next?.starters[0]?.points).toBe(22.4)
    expect(next?.oppStarters[0]?.points).toBe(15.1)
  })

  it('lets compact mLiveScoring move HUD totals down when preferLive is set', () => {
    const highPrev = {
      ...prev,
      myPoints: 22.4,
      oppPoints: 15.1,
      starters: [{ ...prev.starters[0], points: 22.4 }],
      oppStarters: [{ ...prev.oppStarters[0], points: 15.1 }]
    }
    const live = {
      liveScoring: {
        teams: [
          { teamId: 1, totalPointsLive: 18, players: [{ playerId: 100, totalPointsLive: 18 }] },
          { teamId: 2, totalPointsLive: 12, players: [{ playerId: 200, totalPointsLive: 12 }] }
        ]
      }
    }
    expect(overlayEspnMatchup(highPrev, live, 1)?.myPoints).toBe(22.4)
    const next = overlayEspnMatchup(highPrev, live, 1, true)
    expect(next?.myPoints).toBe(18)
    expect(next?.starters[0]?.points).toBe(18)
    expect(next?.oppPoints).toBe(12)
    expect(next?.oppStarters[0]?.points).toBe(12)
  })

  it('keeps last HUD when preferLive compact overlay is a zeroed stub', () => {
    const highPrev = { ...prev, myPoints: 22.4, starters: [{ ...prev.starters[0], points: 22.4 }] }
    const live = {
      liveScoring: {
        teams: [
          { teamId: 1, totalPointsLive: 0 },
          { teamId: 2, totalPointsLive: 0 }
        ]
      }
    }
    const next = overlayEspnMatchup(highPrev, live, 1, true)
    expect(next?.myPoints).toBe(22.4)
    expect(next?.starters[0]?.points).toBe(22.4)
  })

  it('does not let a zeroed stub on one side wipe last HUD on the other', () => {
    const highPrev = {
      ...prev,
      myPoints: 22.4,
      starters: [{ ...prev.starters[0], points: 22.4 }],
      oppPoints: 8,
      oppStarters: [{ ...prev.oppStarters[0], points: 8 }]
    }
    const live = {
      liveScoring: {
        teams: [
          { teamId: 1, totalPointsLive: 0 },
          { teamId: 2, totalPointsLive: 12, players: [{ playerId: 200, totalPointsLive: 12 }] }
        ]
      }
    }
    const next = overlayEspnMatchup(highPrev, live, 1, true)
    expect(next?.myPoints).toBe(22.4)
    expect(next?.starters[0]?.points).toBe(22.4)
    expect(next?.oppPoints).toBe(12)
    expect(next?.oppStarters[0]?.points).toBe(12)
  })

  it('keeps last starter chips when compact live has a side total but zeroed players', () => {
    const live = {
      liveScoring: {
        teams: [
          { teamId: 1, totalPointsLive: 22.4, players: [{ playerId: 100, totalPointsLive: 0 }] },
          { teamId: 2, totalPointsLive: 15.1, players: [{ playerId: 200, totalPointsLive: 0 }] }
        ]
      }
    }
    const next = overlayEspnMatchup(prev, live, 1, true)
    expect(next?.myPoints).toBe(22.4)
    expect(next?.starters[0]?.points).toBe(10)
    expect(next?.oppPoints).toBe(15.1)
    expect(next?.oppStarters[0]?.points).toBe(8)
  })

  it('reads an unwrapped teamId map when the liveScoring wrapper is omitted', () => {
    const live = {
      '1': { totalPointsLive: 22.4, players: [{ playerId: 100, totalPointsLive: 22.4 }] },
      '2': { totalPointsLive: 15.1, players: [{ playerId: 200, totalPointsLive: 15.1 }] }
    }
    const next = overlayEspnMatchup(prev, live, 1)
    expect(next?.myPoints).toBe(22.4)
    expect(next?.starters[0]?.points).toBe(22.4)
    expect(next?.oppStarters[0]?.points).toBe(15.1)
  })

  it('coerces quoted JSON numbers on compact live rows', () => {
    const live = {
      liveScoring: {
        teams: [
          { teamId: 1, totalPointsLive: '22.4', players: [{ playerId: 100, totalPointsLive: '22.4' }] },
          { teamId: 2, totalPointsLive: '15.1', players: [{ playerId: 200, totalPointsLive: '15.1' }] }
        ]
      }
    }
    const next = overlayEspnMatchup(prev, live, 1)
    expect(next?.myPoints).toBe(22.4)
    expect(next?.starters[0]?.points).toBe(22.4)
  })

  it('reads compact appliedTotal when liveScore and totalPointsLive are omitted', () => {
    const live = {
      liveScoring: {
        teams: [
          { teamId: 1, appliedTotal: 22.4, players: [{ playerId: 100, appliedTotal: 22.4 }] },
          { teamId: 2, appliedTotal: 15.1, players: [{ playerId: 200, appliedTotal: 15.1 }] }
        ]
      }
    }
    const next = overlayEspnMatchup(prev, live, 1)
    expect(next?.myPoints).toBe(22.4)
    expect(next?.starters[0]?.points).toBe(22.4)
    expect(next?.oppPoints).toBe(15.1)
  })

  it('reads compact player points when leftover projection stats are present', () => {
    const live = {
      liveScoring: {
        teams: [
          {
            teamId: 1,
            points: 22.4,
            players: [
              {
                playerId: 100,
                points: 22.4,
                stats: [{ statSourceId: 1, statSplitTypeId: 1, appliedTotal: 18 }]
              }
            ]
          },
          {
            teamId: 2,
            points: 15.1,
            players: [
              {
                playerId: 200,
                appliedActiveReal: 15.1,
                stats: [{ statSourceId: 1, statSplitTypeId: 1, appliedTotal: 14 }]
              }
            ]
          }
        ]
      }
    }
    const next = overlayEspnMatchup(prev, live, 1)
    expect(next?.myPoints).toBe(22.4)
    expect(next?.starters[0]?.points).toBe(22.4)
    expect(next?.oppPoints).toBe(15.1)
    expect(next?.oppStarters[0]?.points).toBe(15.1)
  })

  it('reads nested playerPoolEntry liveScore when leftover projection stats are present', () => {
    const live = {
      liveScoring: {
        teams: [
          {
            teamId: 1,
            players: [
              {
                playerId: 100,
                playerPoolEntry: {
                  liveScore: 22.4,
                  player: { stats: [{ statSourceId: 1, statSplitTypeId: 1, appliedTotal: 18 }] }
                }
              }
            ]
          },
          {
            teamId: 2,
            players: [
              {
                playerId: 200,
                playerPoolEntry: {
                  totalPointsLive: 15.1,
                  player: { stats: [{ statSourceId: 1, statSplitTypeId: 1, appliedTotal: 14 }] }
                }
              }
            ]
          }
        ]
      }
    }
    const next = overlayEspnMatchup(prev, live, 1)
    expect(next?.myPoints).toBe(22.4)
    expect(next?.starters[0]?.points).toBe(22.4)
    expect(next?.oppPoints).toBe(15.1)
    expect(next?.oppStarters[0]?.points).toBe(15.1)
  })

  it('prefers compact liveScore over leftover week actuals on overlay', () => {
    const live = {
      liveScoring: {
        teams: [
          {
            teamId: 1,
            players: [
              {
                playerId: 100,
                playerPoolEntry: {
                  liveScore: 22.4,
                  player: {
                    stats: [{ statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 10 }]
                  }
                }
              }
            ]
          },
          {
            teamId: 2,
            players: [
              {
                playerId: 200,
                playerPoolEntry: {
                  totalPointsLive: 15.1,
                  player: {
                    stats: [{ statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 8 }]
                  }
                }
              }
            ]
          }
        ]
      }
    }
    const next = overlayEspnMatchup(prev, live, 1)
    expect(next?.myPoints).toBe(22.4)
    expect(next?.starters[0]?.points).toBe(22.4)
    expect(next?.oppPoints).toBe(15.1)
    expect(next?.oppStarters[0]?.points).toBe(15.1)
  })

  it('lets a lower liveScore correct leftover week actuals on overlay', () => {
    const live = {
      liveScoring: {
        teams: [
          {
            teamId: 1,
            totalPointsLive: 18,
            players: [
              {
                playerId: 100,
                liveScore: 18,
                playerPoolEntry: {
                  liveScore: 18,
                  player: {
                    stats: [{ statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 22.4 }]
                  }
                }
              }
            ]
          },
          { teamId: 2, totalPointsLive: 12, players: [{ playerId: 200, liveScore: 12 }] }
        ]
      }
    }
    const highPrev = {
      ...prev,
      myPoints: 22.4,
      starters: [{ ...prev.starters[0], points: 22.4 }],
      oppPoints: 15.1,
      oppStarters: [{ ...prev.oppStarters[0], points: 15.1 }]
    }
    const next = overlayEspnMatchup(highPrev, live, 1, true)
    expect(next?.myPoints).toBe(18)
    expect(next?.starters[0]?.points).toBe(18)
    expect(next?.oppPoints).toBe(12)
    expect(next?.oppStarters[0]?.points).toBe(12)
  })

  it('lets compact liveScore 0 correct leftover starter chips when another starter still has points', () => {
    const live = {
      liveScoring: {
        teams: [
          {
            teamId: 1,
            totalPointsLive: 18,
            players: [
              { playerId: 100, liveScore: 0 },
              { playerId: 101, liveScore: 18 }
            ]
          },
          { teamId: 2, totalPointsLive: 12, players: [{ playerId: 200, liveScore: 12 }] }
        ]
      }
    }
    const highPrev = {
      ...prev,
      myPoints: 22.4,
      starters: [
        { ...prev.starters[0], points: 22.4 },
        { playerId: '101', name: 'Barkley', position: 'RB', nflTeam: 'PHI', points: 10 }
      ],
      oppPoints: 15.1,
      oppStarters: [{ ...prev.oppStarters[0], points: 15.1 }]
    }
    const next = overlayEspnMatchup(highPrev, live, 1, true)
    expect(next?.starters[0]?.points).toBe(0)
    expect(next?.starters[1]?.points).toBe(18)
    expect(next?.myPoints).toBe(18)
  })

  it('keeps compact live scores when leftover mMatchupScore is merged before overlay', () => {
    const boxscore = {
      schedule: [
        {
          matchupPeriodId: 1,
          home: { teamId: 1, totalPointsLive: 22.4 },
          away: { teamId: 2, totalPointsLive: 15.1 }
        }
      ]
    }
    const compact = {
      liveScoring: {
        teams: [
          { teamId: 1, totalPointsLive: 18, players: [{ playerId: 100, liveScore: 18 }] },
          { teamId: 2, totalPointsLive: 12, players: [{ playerId: 200, liveScore: 12 }] }
        ]
      }
    }
    const highPrev = {
      ...prev,
      myPoints: 18,
      starters: [{ ...prev.starters[0], points: 18 }],
      oppPoints: 12,
      oppStarters: [{ ...prev.oppStarters[0], points: 12 }]
    }
    expect(overlayEspnMatchup(highPrev, boxscore, 1)?.myPoints).toBe(22.4)
    const next = overlayEspnMatchup(highPrev, overlayLiveScoring(boxscore, compact), 1, true)
    expect(next?.myPoints).toBe(18)
    expect(next?.starters[0]?.points).toBe(18)
    expect(next?.oppPoints).toBe(12)
  })

  it('lets a lower live team total correct leftover pointsByScoringPeriod', () => {
    const live = {
      liveScoring: {
        teams: [
          {
            teamId: 1,
            totalPointsLive: 18,
            pointsByScoringPeriod: { '1': 22.4 },
            players: [{ playerId: 100, liveScore: 18 }]
          },
          {
            teamId: 2,
            totalPointsLive: 12,
            pointsByScoringPeriod: { '1': 15.1 },
            players: [{ playerId: 200, liveScore: 12 }]
          }
        ]
      }
    }
    const highPrev = {
      ...prev,
      myPoints: 22.4,
      starters: [{ ...prev.starters[0], points: 22.4 }],
      oppPoints: 15.1,
      oppStarters: [{ ...prev.oppStarters[0], points: 15.1 }]
    }
    const next = overlayEspnMatchup(highPrev, live, 1, true)
    expect(next?.myPoints).toBe(18)
    expect(next?.starters[0]?.points).toBe(18)
    expect(next?.oppPoints).toBe(12)
  })

  it('lets compact liveScoring win over leftover schedule liveScore on the same payload', () => {
    const live = {
      schedule: [
        {
          matchupPeriodId: 1,
          home: { teamId: 1, liveScore: 22.4, totalPointsLive: 0 },
          away: { teamId: 2, liveScore: 15.1, totalPointsLive: 0 }
        }
      ],
      liveScoring: {
        teams: [
          { teamId: 1, totalPointsLive: 18, players: [{ playerId: 100, liveScore: 18 }] },
          { teamId: 2, totalPointsLive: 12, players: [{ playerId: 200, liveScore: 12 }] }
        ]
      }
    }
    const highPrev = {
      ...prev,
      myPoints: 22.4,
      starters: [{ ...prev.starters[0], points: 22.4 }],
      oppPoints: 15.1,
      oppStarters: [{ ...prev.oppStarters[0], points: 15.1 }]
    }
    const next = overlayEspnMatchup(highPrev, live, 1, true)
    expect(next?.myPoints).toBe(18)
    expect(next?.starters[0]?.points).toBe(18)
    expect(next?.oppPoints).toBe(12)
  })

  it('lets compact liveScore 0 correct leftover schedule liveScore on the same payload', () => {
    const payload = {
      teams: [{ id: 1 }, { id: 2 }],
      schedule: [
        {
          matchupPeriodId: 1,
          home: { teamId: 1, liveScore: 22.4, totalPointsLive: 22.4 },
          away: { teamId: 2, liveScore: 15.1, totalPointsLive: 15.1 }
        }
      ],
      liveScoring: {
        teams: [
          { teamId: 1, liveScore: 0 },
          { teamId: 2, liveScore: 0 }
        ]
      }
    }
    const matchup = toEspnMatchup({ payload, cookies: null, displayWeek: 1, myTeamId: 1 })
    expect(matchup?.myPoints).toBe(0)
    expect(matchup?.oppPoints).toBe(0)
  })

  it('lets compact starter chips correct leftover pointsByScoringPeriod when team liveScore is omitted', () => {
    const payload = {
      teams: [{ id: 1 }, { id: 2 }],
      schedule: [
        {
          matchupPeriodId: 1,
          home: { teamId: 1, totalPointsLive: 0, pointsByScoringPeriod: { '1': 22.4 } },
          away: { teamId: 2, totalPointsLive: 0, pointsByScoringPeriod: { '1': 15.1 } }
        }
      ],
      liveScoring: {
        teams: [
          { teamId: 1, players: [{ playerId: 100, liveScore: 18, lineupSlotId: 0 }] },
          { teamId: 2, players: [{ playerId: 200, liveScore: 12, lineupSlotId: 0 }] }
        ]
      }
    }
    const matchup = toEspnMatchup({ payload, cookies: null, displayWeek: 1, myTeamId: 1 })
    expect(matchup?.myPoints).toBe(18)
    expect(matchup?.oppPoints).toBe(12)
    expect(matchup?.starters[0]?.points).toBe(18)
  })

  it('lets compact starter chips correct leftover totalPointsLive when team liveScore is omitted', () => {
    const payload = {
      teams: [{ id: 1 }, { id: 2 }],
      schedule: [
        {
          matchupPeriodId: 1,
          home: { teamId: 1, totalPointsLive: 22.4, pointsByScoringPeriod: { '1': 22.4 } },
          away: { teamId: 2, totalPointsLive: 15.1, pointsByScoringPeriod: { '1': 15.1 } }
        }
      ],
      liveScoring: {
        teams: [
          { teamId: 1, players: [{ playerId: 100, liveScore: 18, lineupSlotId: 0 }] },
          { teamId: 2, players: [{ playerId: 200, liveScore: 12, lineupSlotId: 0 }] }
        ]
      }
    }
    const matchup = toEspnMatchup({ payload, cookies: null, displayWeek: 1, myTeamId: 1 })
    expect(matchup?.myPoints).toBe(18)
    expect(matchup?.oppPoints).toBe(12)
    expect(matchup?.starters[0]?.points).toBe(18)
  })

  it('lets compact appliedTotal chips correct leftover pointsByScoringPeriod when liveScore is omitted', () => {
    const payload = {
      teams: [{ id: 1 }, { id: 2 }],
      schedule: [
        {
          matchupPeriodId: 1,
          home: { teamId: 1, totalPointsLive: 0, pointsByScoringPeriod: { '1': 22.4 } },
          away: { teamId: 2, totalPointsLive: 0, pointsByScoringPeriod: { '1': 15.1 } }
        }
      ],
      liveScoring: {
        teams: [
          { teamId: 1, players: [{ playerId: 100, appliedTotal: 18, lineupSlotId: 0 }] },
          { teamId: 2, players: [{ playerId: 200, appliedTotal: 12, lineupSlotId: 0 }] }
        ]
      }
    }
    const matchup = toEspnMatchup({ payload, cookies: null, displayWeek: 1, myTeamId: 1 })
    expect(matchup?.myPoints).toBe(18)
    expect(matchup?.oppPoints).toBe(12)
    expect(matchup?.starters[0]?.points).toBe(18)
  })

  it('lets compact starter chips win over compact team points when liveScore is omitted', () => {
    const payload = {
      teams: [{ id: 1 }, { id: 2 }],
      schedule: [
        {
          matchupPeriodId: 1,
          home: { teamId: 1, totalPointsLive: 22.4 },
          away: { teamId: 2, totalPointsLive: 15.1 }
        }
      ],
      liveScoring: {
        teams: [
          { teamId: 1, points: 99, appliedTotal: 99, players: [{ playerId: 100, liveScore: 18, lineupSlotId: 0 }] },
          { teamId: 2, points: 88, appliedTotal: 88, players: [{ playerId: 200, liveScore: 12, lineupSlotId: 0 }] }
        ]
      }
    }
    const matchup = toEspnMatchup({ payload, cookies: null, displayWeek: 1, myTeamId: 1 })
    expect(matchup?.myPoints).toBe(18)
    expect(matchup?.oppPoints).toBe(12)
    expect(matchup?.starters[0]?.points).toBe(18)
  })

  it('lets compact player liveScore win over leftover roster liveScore', () => {
    const live = {
      schedule: [
        {
          matchupPeriodId: 1,
          home: {
            teamId: 1,
            rosterForCurrentScoringPeriod: {
              entries: [
                {
                  playerId: 100,
                  lineupSlotId: 0,
                  liveScore: 22.4,
                  playerPoolEntry: { liveScore: 22.4, player: { fullName: 'Hurts' } }
                }
              ]
            }
          },
          away: { teamId: 2 }
        }
      ],
      liveScoring: {
        teams: [
          { teamId: 1, totalPointsLive: 18, players: [{ playerId: 100, liveScore: 18 }] },
          { teamId: 2, totalPointsLive: 12, players: [{ playerId: 200, liveScore: 12 }] }
        ]
      }
    }
    const highPrev = {
      ...prev,
      myPoints: 22.4,
      starters: [{ ...prev.starters[0], points: 22.4 }],
      oppPoints: 15.1,
      oppStarters: [{ ...prev.oppStarters[0], points: 15.1 }]
    }
    const next = overlayEspnMatchup(highPrev, live, 1, true)
    expect(next?.myPoints).toBe(18)
    expect(next?.starters[0]?.points).toBe(18)
    expect(next?.oppPoints).toBe(12)
  })

  it('lets compact player chips correct leftover roster week actuals', () => {
    const live = {
      schedule: [
        {
          matchupPeriodId: 1,
          home: {
            teamId: 1,
            rosterForCurrentScoringPeriod: {
              entries: [
                {
                  playerId: 100,
                  lineupSlotId: 0,
                  playerPoolEntry: {
                    appliedStatTotal: 22.4,
                    player: {
                      stats: [
                        { statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 22.4 }
                      ]
                    }
                  }
                }
              ]
            }
          },
          away: { teamId: 2 }
        }
      ],
      liveScoring: {
        teams: [
          { teamId: 1, totalPointsLive: 18, players: [{ playerId: 100, liveScore: 18 }] },
          { teamId: 2, totalPointsLive: 12, players: [{ playerId: 200, liveScore: 12 }] }
        ]
      }
    }
    const highPrev = {
      ...prev,
      myPoints: 22.4,
      starters: [{ ...prev.starters[0], points: 22.4 }],
      oppPoints: 15.1,
      oppStarters: [{ ...prev.oppStarters[0], points: 15.1 }]
    }
    const next = overlayEspnMatchup(highPrev, live, 1, true)
    expect(next?.myPoints).toBe(18)
    expect(next?.starters[0]?.points).toBe(18)
    expect(next?.oppPoints).toBe(12)
  })

  it('lets compact appliedTotal chips correct leftover roster week actuals when liveScore is omitted', () => {
    const live = {
      schedule: [
        {
          matchupPeriodId: 1,
          home: {
            teamId: 1,
            rosterForCurrentScoringPeriod: {
              entries: [
                {
                  playerId: 100,
                  lineupSlotId: 0,
                  playerPoolEntry: {
                    appliedStatTotal: 22.4,
                    player: {
                      stats: [
                        { statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 22.4 }
                      ]
                    }
                  }
                }
              ]
            }
          },
          away: { teamId: 2 }
        }
      ],
      liveScoring: {
        teams: [
          { teamId: 1, players: [{ playerId: 100, appliedTotal: 18, lineupSlotId: 0 }] },
          { teamId: 2, players: [{ playerId: 200, appliedTotal: 12, lineupSlotId: 0 }] }
        ]
      }
    }
    const highPrev = {
      ...prev,
      myPoints: 22.4,
      starters: [{ ...prev.starters[0], points: 22.4 }],
      oppPoints: 15.1,
      oppStarters: [{ ...prev.oppStarters[0], points: 15.1 }]
    }
    const next = overlayEspnMatchup(highPrev, live, 1, true)
    expect(next?.myPoints).toBe(18)
    expect(next?.starters[0]?.points).toBe(18)
    expect(next?.oppPoints).toBe(12)
  })

  it('lets a lower live team total correct leftover starter week actuals', () => {
    const live = {
      schedule: [
        {
          matchupPeriodId: 1,
          home: {
            teamId: 1,
            rosterForCurrentScoringPeriod: {
              entries: [
                {
                  playerId: 999,
                  lineupSlotId: 0,
                  playerPoolEntry: {
                    player: {
                      stats: [
                        { statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 22.4 }
                      ]
                    }
                  }
                }
              ]
            }
          },
          away: { teamId: 2 }
        }
      ],
      liveScoring: {
        teams: [
          { teamId: 1, totalPointsLive: 18, players: [{ playerId: 100, liveScore: 18 }] },
          { teamId: 2, totalPointsLive: 12, players: [{ playerId: 200, liveScore: 12 }] }
        ]
      }
    }
    const highPrev = {
      ...prev,
      myPoints: 22.4,
      starters: [{ ...prev.starters[0], points: 22.4 }],
      oppPoints: 15.1,
      oppStarters: [{ ...prev.oppStarters[0], points: 15.1 }]
    }
    const next = overlayEspnMatchup(highPrev, live, 1, true)
    expect(next?.myPoints).toBe(18)
    expect(next?.starters[0]?.points).toBe(18)
    expect(next?.oppPoints).toBe(12)
  })

  it('reads compact player actuals when stats is a keyed map', () => {
    const live = {
      liveScoring: {
        teams: [
          {
            teamId: 1,
            players: [
              {
                playerId: 100,
                stats: { '0': { statSourceId: 0, statSplitTypeId: 1, appliedTotal: 22.4 } }
              }
            ]
          },
          {
            teamId: 2,
            players: [
              {
                playerId: 200,
                stats: { '0': { statSourceId: 0, statSplitTypeId: 1, appliedTotal: 15.1 } }
              }
            ]
          }
        ]
      }
    }
    const next = overlayEspnMatchup(prev, live, 1)
    expect(next?.myPoints).toBe(22.4)
    expect(next?.starters[0]?.points).toBe(22.4)
    expect(next?.oppPoints).toBe(15.1)
  })

  it('reads compact team appliedTotal when players are omitted', () => {
    const live = {
      liveScoring: {
        teams: [
          { teamId: 1, appliedTotal: 22.4 },
          { teamId: 2, appliedActiveReal: 15.1 }
        ]
      }
    }
    const next = overlayEspnMatchup(prev, live, 1)
    expect(next?.myPoints).toBe(22.4)
    expect(next?.oppPoints).toBe(15.1)
  })

  it('does not treat boxscore appliedTotal as live when a roster is present', () => {
    const live = {
      liveScoring: {
        teams: [
          { teamId: 1, appliedTotal: 999, rosterForCurrentScoringPeriod: { entries: [] } },
          { teamId: 2, appliedTotal: 888, rosterForCurrentScoringPeriod: { entries: [] } }
        ]
      }
    }
    const next = overlayEspnMatchup(prev, live, 1)
    expect(next?.myPoints).toBe(10)
    expect(next?.oppPoints).toBe(8)
  })

  it('does not treat compact team points as live when player chips are present', () => {
    const live = {
      liveScoring: {
        teams: [
          { teamId: 1, points: 99, appliedTotal: 99, players: [{ playerId: 100, liveScore: 18, lineupSlotId: 0 }] },
          { teamId: 2, points: 88, appliedTotal: 88, players: [{ playerId: 200, liveScore: 12, lineupSlotId: 0 }] }
        ]
      }
    }
    const next = overlayEspnMatchup(prev, live, 1, true)
    expect(next?.myPoints).toBe(18)
    expect(next?.oppPoints).toBe(12)
    expect(next?.starters[0]?.points).toBe(18)
  })

  it('does not treat compact team points as live when players is an empty array', () => {
    const live = {
      liveScoring: {
        teams: [
          { teamId: 1, points: 99, appliedTotal: 99, players: [] },
          { teamId: 2, points: 88, appliedTotal: 88, players: [] }
        ]
      }
    }
    const next = overlayEspnMatchup(prev, live, 1, true)
    expect(next?.myPoints).toBe(10)
    expect(next?.oppPoints).toBe(8)
    expect(next?.starters[0]?.points).toBe(10)
  })

  it('reads compact player chips when players is a playerId-to-points map', () => {
    const highPrev = {
      ...prev,
      myPoints: 22.4,
      starters: [{ ...prev.starters[0], points: 22.4 }],
      oppPoints: 15.1,
      oppStarters: [{ ...prev.oppStarters[0], points: 15.1 }]
    }
    const live = {
      liveScoring: {
        teams: [
          { teamId: 1, players: { '100': 18 } },
          { teamId: 2, players: { '200': '12' } }
        ]
      }
    }
    const next = overlayEspnMatchup(highPrev, live, 1, true)
    expect(next?.myPoints).toBe(18)
    expect(next?.starters[0]?.points).toBe(18)
    expect(next?.oppPoints).toBe(12)
    expect(next?.oppStarters[0]?.points).toBe(12)
  })

  it('reads compact player chips when the points map holds nested score objects', () => {
    const highPrev = {
      ...prev,
      myPoints: 22.4,
      starters: [{ ...prev.starters[0], points: 22.4 }],
      oppPoints: 15.1,
      oppStarters: [{ ...prev.oppStarters[0], points: 15.1 }]
    }
    const live = {
      liveScoring: {
        teams: [
          { teamId: 1, players: { '100': { points: 18 } } },
          { teamId: 2, players: { '200': { pts: 12 } } }
        ]
      }
    }
    const next = overlayEspnMatchup(highPrev, live, 1, true)
    expect(next?.myPoints).toBe(18)
    expect(next?.starters[0]?.points).toBe(18)
    expect(next?.oppPoints).toBe(12)
    expect(next?.oppStarters[0]?.points).toBe(12)
  })

  it('reads compact player chips when ESPN sends a players array with nested pts', () => {
    const highPrev = {
      ...prev,
      myPoints: 22.4,
      starters: [{ ...prev.starters[0], points: 22.4 }],
      oppPoints: 15.1,
      oppStarters: [{ ...prev.oppStarters[0], points: 15.1 }]
    }
    const live = {
      liveScoring: {
        teams: [
          { teamId: 1, players: [{ playerId: 100, pts: 18 }] },
          { teamId: 2, players: [{ playerId: 200, pts: 12 }] }
        ]
      }
    }
    const next = overlayEspnMatchup(highPrev, live, 1, true)
    expect(next?.myPoints).toBe(18)
    expect(next?.starters[0]?.points).toBe(18)
    expect(next?.oppPoints).toBe(12)
    expect(next?.oppStarters[0]?.points).toBe(12)
  })

  it('reads compact player chips when the id is nested on player or playerPoolEntry', () => {
    const highPrev = {
      ...prev,
      myPoints: 22.4,
      starters: [{ ...prev.starters[0], points: 22.4 }],
      oppPoints: 15.1,
      oppStarters: [{ ...prev.oppStarters[0], points: 15.1 }]
    }
    const live = {
      liveScoring: {
        teams: [
          { teamId: 1, players: [{ liveScore: 18, player: { id: 100 } }] },
          { teamId: 2, players: [{ liveScore: 12, playerPoolEntry: { id: '200' } }] }
        ]
      }
    }
    const next = overlayEspnMatchup(highPrev, live, 1, true)
    expect(next?.myPoints).toBe(18)
    expect(next?.starters[0]?.points).toBe(18)
    expect(next?.oppPoints).toBe(12)
    expect(next?.oppStarters[0]?.points).toBe(12)
  })

  it('does not treat a slot-index players map as player 0 when nested player.id is present', () => {
    const highPrev = {
      ...prev,
      myPoints: 22.4,
      starters: [{ ...prev.starters[0], points: 22.4 }],
      oppPoints: 15.1,
      oppStarters: [{ ...prev.oppStarters[0], points: 15.1 }]
    }
    const live = {
      liveScoring: {
        teams: [
          { teamId: 1, players: { '0': { liveScore: 18, player: { id: 100 } } } },
          { teamId: 2, players: { '0': { liveScore: 12, playerPoolEntry: { player: { id: '200' } } } } }
        ]
      }
    }
    const next = overlayEspnMatchup(highPrev, live, 1, true)
    expect(next?.myPoints).toBe(18)
    expect(next?.starters[0]?.points).toBe(18)
    expect(next?.oppPoints).toBe(12)
    expect(next?.oppStarters[0]?.points).toBe(12)
  })

  it('reads compact team totals when liveScoring teams is a teamId-to-points map', () => {
    const highPrev = {
      ...prev,
      myPoints: 22.4,
      starters: [{ ...prev.starters[0], points: 22.4 }],
      oppPoints: 15.1,
      oppStarters: [{ ...prev.oppStarters[0], points: 15.1 }]
    }
    const live = {
      liveScoring: {
        teams: { '1': 18, '2': '12' }
      }
    }
    const next = overlayEspnMatchup(highPrev, live, 1, true)
    expect(next?.myPoints).toBe(18)
    expect(next?.starters[0]?.points).toBe(22.4)
    expect(next?.oppPoints).toBe(12)
    expect(next?.oppStarters[0]?.points).toBe(15.1)
  })

  it('reads compact team totals when the id is nested on team', () => {
    const highPrev = {
      ...prev,
      myPoints: 22.4,
      starters: [{ ...prev.starters[0], points: 22.4 }],
      oppPoints: 15.1,
      oppStarters: [{ ...prev.oppStarters[0], points: 15.1 }]
    }
    const live = {
      liveScoring: {
        teams: [
          { liveScore: 18, team: { id: 1 } },
          { liveScore: 12, team: { id: '2' } }
        ]
      }
    }
    const next = overlayEspnMatchup(highPrev, live, 1, true)
    expect(next?.myPoints).toBe(18)
    expect(next?.starters[0]?.points).toBe(22.4)
    expect(next?.oppPoints).toBe(12)
    expect(next?.oppStarters[0]?.points).toBe(15.1)
  })

  it('does not treat a slot-index teams map as team 1 when nested team.id is present', () => {
    const highPrev = {
      ...prev,
      myPoints: 22.4,
      starters: [{ ...prev.starters[0], points: 22.4 }],
      oppPoints: 15.1,
      oppStarters: [{ ...prev.oppStarters[0], points: 15.1 }]
    }
    const live = {
      liveScoring: {
        teams: {
          '1': { liveScore: 99, team: { id: 9 } },
          '0': { liveScore: 18, team: { teamId: 1 } },
          '2': { liveScore: 12, team: { id: '2' } }
        }
      }
    }
    const next = overlayEspnMatchup(highPrev, live, 1, true)
    expect(next?.myPoints).toBe(18)
    expect(next?.oppPoints).toBe(12)
  })

  it('reads compact schedule totals when home/away nest team.id instead of teamId', () => {
    const highPrev = {
      ...prev,
      myPoints: 22.4,
      starters: [{ ...prev.starters[0], points: 22.4 }],
      oppPoints: 15.1,
      oppStarters: [{ ...prev.oppStarters[0], points: 15.1 }]
    }
    const live = {
      schedule: [
        {
          matchupPeriodId: 1,
          home: { liveScore: 18, team: { id: 1 } },
          away: { liveScore: 12, team: { id: '2' } }
        }
      ]
    }
    const next = overlayEspnMatchup(highPrev, live, 1, true)
    expect(next?.myPoints).toBe(18)
    expect(next?.starters[0]?.points).toBe(22.4)
    expect(next?.oppPoints).toBe(12)
    expect(next?.oppStarters[0]?.points).toBe(15.1)
  })

  it('reads compact schedule totals when schedule is a map or a single game object', () => {
    const highPrev = {
      ...prev,
      myPoints: 22.4,
      starters: [{ ...prev.starters[0], points: 22.4 }],
      oppPoints: 15.1,
      oppStarters: [{ ...prev.oppStarters[0], points: 15.1 }]
    }
    const asMap = overlayEspnMatchup(
      highPrev,
      {
        schedule: {
          '0': {
            matchupPeriodId: 1,
            home: { teamId: 1, liveScore: 18 },
            away: { teamId: 2, liveScore: 12 }
          }
        }
      },
      1,
      true
    )
    expect(asMap?.myPoints).toBe(18)
    expect(asMap?.oppPoints).toBe(12)
    const asOne = overlayEspnMatchup(
      highPrev,
      {
        schedule: {
          matchupPeriodId: 1,
          home: { teamId: 1, liveScore: 18 },
          away: { teamId: 2, liveScore: 12 }
        }
      },
      1,
      true
    )
    expect(asOne?.myPoints).toBe(18)
    expect(asOne?.oppPoints).toBe(12)
  })

  it('reads team liveScore when totalPointsLive is omitted or zero', () => {
    const live = {
      liveScoring: {
        teams: [
          { teamId: 1, liveScore: 22.4 },
          { teamId: 2, liveScore: 15.1 }
        ]
      }
    }
    const next = overlayEspnMatchup(prev, live, 1)
    expect(next?.myPoints).toBe(22.4)
    expect(next?.oppPoints).toBe(15.1)
  })

  it('does not let a zeroed totalPointsLive hide liveScore on the same compact row', () => {
    const live = {
      liveScoring: {
        teams: [
          {
            teamId: 1,
            totalPointsLive: 0,
            liveScore: 22.4,
            players: [{ playerId: 100, totalPointsLive: 0, liveScore: 22.4 }]
          },
          {
            teamId: 2,
            totalPointsLive: 0,
            liveScore: 15.1,
            players: [{ playerId: 200, totalPointsLive: 0, liveScore: 15.1 }]
          }
        ]
      }
    }
    const next = overlayEspnMatchup(prev, live, 1)
    expect(next?.myPoints).toBe(22.4)
    expect(next?.starters[0]?.points).toBe(22.4)
    expect(next?.oppPoints).toBe(15.1)
    expect(next?.oppStarters[0]?.points).toBe(15.1)
  })

  it('does not let a zeroed row totalPointsLive hide nested playerPoolEntry liveScore on overlay', () => {
    const live = {
      liveScoring: {
        teams: [
          {
            teamId: 1,
            players: [
              {
                playerId: 100,
                totalPointsLive: 0,
                playerPoolEntry: { liveScore: 22.4 }
              }
            ]
          },
          {
            teamId: 2,
            players: [
              {
                playerId: 200,
                totalPointsLive: 0,
                playerPoolEntry: { liveScore: 15.1 }
              }
            ]
          }
        ]
      }
    }
    const next = overlayEspnMatchup(prev, live, 1)
    expect(next?.myPoints).toBe(22.4)
    expect(next?.starters[0]?.points).toBe(22.4)
    expect(next?.oppPoints).toBe(15.1)
    expect(next?.oppStarters[0]?.points).toBe(15.1)
  })

  it('prefers liveScore over a zeroed schedule totalPointsLive', () => {
    const live = {
      schedule: [
        {
          matchupPeriodId: 1,
          home: { teamId: 1, totalPointsLive: 0 },
          away: { teamId: 2, totalPointsLive: 0 }
        }
      ],
      liveScoring: {
        teams: [
          { teamId: 1, liveScore: 22.4 },
          { teamId: 2, liveScore: 15.1 }
        ]
      }
    }
    const next = overlayEspnMatchup(prev, live, 1)
    expect(next?.myPoints).toBe(22.4)
    expect(next?.oppPoints).toBe(15.1)
  })

  it('matches last HUD when myTeam.id is a quoted JSON number', () => {
    const quotedPrev = {
      ...prev,
      myTeam: { ...prev.myTeam, id: '1' },
      oppTeam: { ...prev.oppTeam, id: '2' }
    }
    const live = {
      liveScoring: {
        teams: [
          { teamId: '1', totalPointsLive: 22.4, players: [{ playerId: 100, totalPointsLive: 22.4 }] },
          { teamId: '2', totalPointsLive: 15.1, players: [{ playerId: 200, totalPointsLive: 15.1 }] }
        ]
      }
    }
    const next = overlayEspnMatchup(quotedPrev, live, 1)
    expect(next?.myPoints).toBe(22.4)
    expect(next?.oppPoints).toBe(15.1)
  })

  it('ignores pre-kickoff schedule stubs so last scores stay on screen', () => {
    expect(overlayEspnMatchup(prev, { schedule: [{ matchupPeriodId: 1 }] }, 1)).toBeNull()
    expect(overlayEspnMatchup(prev, { liveScoring: { teams: [] } }, 1)).toBeNull()
  })

  it('does not overlay a Sleeper last HUD onto ESPN live chips', () => {
    const sleeperHud = {
      ...prev,
      starters: [{ playerId: '4046', name: 'Amon-Ra St. Brown', position: 'WR', nflTeam: 'DET', points: 14.8 }],
      oppStarters: [{ playerId: '6794', name: 'Justin Jefferson', position: 'WR', nflTeam: 'MIN', points: 11 }]
    }
    const live = {
      liveScoring: {
        teams: [
          { teamId: 1, totalPointsLive: 22.4, players: [{ playerId: 100, totalPointsLive: 22.4 }] },
          { teamId: 2, totalPointsLive: 15.1, players: [{ playerId: 200, totalPointsLive: 15.1 }] }
        ]
      }
    }
    expect(overlayEspnMatchup(sleeperHud, live, 1)).toBeNull()
  })
})

describe('overlayLiveScoring', () => {
  it('keeps cached schedule/rosters and overlays a tiny liveScoring blob', () => {
    const cookies = { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' }
    const cached = {
      scoringPeriodId: 1,
      teams: [
        {
          id: 1,
          primaryOwner: '{11111111-1111-1111-1111-111111111111}',
          location: 'Mine',
          nickname: 'Squad'
        },
        { id: 2, location: 'Them', nickname: 'Squad' }
      ],
      schedule: [
        {
          matchupPeriodId: 1,
          home: {
            teamId: 1,
            totalPointsLive: 10,
            rosterForCurrentScoringPeriod: {
              entries: [
                {
                  lineupSlotId: 0,
                  playerId: 7,
                  playerPoolEntry: {
                    appliedStatTotal: 10,
                    player: { fullName: 'Cached QB', defaultPositionId: 1, proTeamId: 12, stats: [] }
                  }
                }
              ]
            }
          },
          away: { teamId: 2, totalPointsLive: 8 }
        }
      ]
    }
    const liveOnly = {
      liveScoring: {
        teams: [
          {
            teamId: 1,
            totalPointsLive: 22.4,
            rosterForCurrentScoringPeriod: {
              entries: [
                {
                  lineupSlotId: 0,
                  playerId: 7,
                  playerPoolEntry: {
                    appliedStatTotal: 22.4,
                    player: { fullName: 'Cached QB', defaultPositionId: 1, proTeamId: 12, stats: [] }
                  }
                }
              ]
            }
          },
          { teamId: 2, totalPointsLive: 19.1 }
        ]
      }
    }
    const matchup = toEspnMatchup({
      payload: overlayLiveScoring(cached, liveOnly),
      cookies,
      displayWeek: 1
    })
    expect(matchup?.myPoints).toBe(22.4)
    expect(matchup?.oppPoints).toBe(19.1)
    expect(matchup?.starters[0]?.name).toBe('Cached QB')
    expect(matchup?.starters[0]?.points).toBe(22.4)
  })

  it('reads compact pointsLive the same as totalPointsLive', () => {
    const cookies = { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' }
    const cached = {
      scoringPeriodId: 1,
      teams: [
        {
          id: 1,
          primaryOwner: '{11111111-1111-1111-1111-111111111111}',
          location: 'Mine',
          nickname: 'Squad'
        },
        { id: 2, location: 'Them', nickname: 'Squad' }
      ],
      schedule: [
        {
          matchupPeriodId: 1,
          home: {
            teamId: 1,
            totalPointsLive: 10,
            rosterForCurrentScoringPeriod: {
              entries: [
                {
                  lineupSlotId: 0,
                  playerId: 7,
                  playerPoolEntry: {
                    appliedStatTotal: 10,
                    player: { fullName: 'Cached QB', defaultPositionId: 1, proTeamId: 12, stats: [] }
                  }
                }
              ]
            }
          },
          away: { teamId: 2, totalPointsLive: 8 }
        }
      ]
    }
    const matchup = toEspnMatchup({
      payload: overlayLiveScoring(cached, {
        liveScoring: {
          teams: [
            {
              teamId: 1,
              pointsLive: 18.2,
              players: [{ playerId: 7, pointsLive: 18.2 }]
            },
            { teamId: 2, pointsLive: 9 }
          ]
        }
      }),
      cookies,
      displayWeek: 1
    })
    expect(matchup?.myPoints).toBe(18.2)
    expect(matchup?.oppPoints).toBe(9)
    expect(matchup?.starters[0]?.points).toBe(18.2)
  })

  it('reads compact player_id the same as playerId', () => {
    const cookies = { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' }
    const cached = {
      scoringPeriodId: 1,
      teams: [
        {
          id: 1,
          primaryOwner: '{11111111-1111-1111-1111-111111111111}',
          location: 'Mine',
          nickname: 'Squad'
        },
        { id: 2, location: 'Them', nickname: 'Squad' }
      ],
      schedule: [
        {
          matchupPeriodId: 1,
          home: {
            teamId: 1,
            totalPointsLive: 10,
            rosterForCurrentScoringPeriod: {
              entries: [
                {
                  lineupSlotId: 0,
                  playerId: 7,
                  playerPoolEntry: {
                    appliedStatTotal: 10,
                    player: { fullName: 'Cached QB', defaultPositionId: 1, proTeamId: 12, stats: [] }
                  }
                }
              ]
            }
          },
          away: { teamId: 2, totalPointsLive: 8 }
        }
      ]
    }
    const matchup = toEspnMatchup({
      payload: overlayLiveScoring(cached, {
        liveScoring: {
          teams: [
            {
              teamId: 1,
              pointsLive: 18.2,
              players: [{ player_id: 7, pointsLive: 18.2 }]
            },
            { teamId: 2, pointsLive: 9 }
          ]
        }
      }),
      cookies,
      displayWeek: 1
    })
    expect(matchup?.myPoints).toBe(18.2)
    expect(matchup?.oppPoints).toBe(9)
    expect(matchup?.starters[0]?.points).toBe(18.2)
  })

  it('returns the cached payload when the live blob is missing or empty', () => {
    const cached = { schedule: [{ matchupPeriodId: 1 }], liveScoring: { teams: [{ teamId: 1 }] } }
    expect(overlayLiveScoring(cached, null)).toEqual(cached)
    expect(overlayLiveScoring(cached, { liveScoring: null })).toEqual(cached)
    expect(overlayLiveScoring(cached, { liveScoring: { teams: [] } })).toEqual(cached)
    expect(overlayLiveScoring(cached, { liveScoring: { teams: {} } })).toEqual(cached)
    expect(overlayLiveScoring(cached, { liveScoring: {} })).toEqual(cached)
    expect(overlayLiveScoring(cached, { liveScoring: { '1': { totalPointsLive: 41.2 } } })).not.toEqual(cached)
    expect(overlayLiveScoring(cached, { liveScoring: { teams: { '1': { totalPointsLive: 41.2 } } } })).not.toEqual(
      cached
    )
    expect(overlayLiveScoring(cached, { '1': { totalPointsLive: 41.2 } })).not.toEqual(cached)
    expect(overlayLiveScoring(cached, { teams: { '1': { totalPointsLive: 41.2 } } })).not.toEqual(cached)
    expect(overlayLiveScoring(cached, { schedule: [], scoringPeriodId: 1 })).toEqual(cached)
    expect(overlayLiveScoring(cached, { schedule: [{ matchupPeriodId: 1 }] })).toEqual(cached)
    const seasonStubs = Array.from({ length: 75 }, (_, i) => ({ matchupPeriodId: (i % 15) + 1 }))
    expect(overlayLiveScoring(cached, { schedule: seasonStubs, scoringPeriodId: 1 })).toEqual(cached)
    expect(overlayLiveScoring(cached, { data: { liveScoring: { '1': { totalPointsLive: 41.2 } } } })).not.toEqual(
      cached
    )
  })

  it('keeps the higher week actual when overlaying live schedule pointsByScoringPeriod', () => {
    const cookies = { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' }
    const cached = {
      teams: [
        {
          id: 1,
          primaryOwner: '{11111111-1111-1111-1111-111111111111}',
          location: 'Mine',
          nickname: 'Squad'
        },
        { id: 2, location: 'Them', nickname: 'Squad' }
      ],
      schedule: [
        {
          matchupPeriodId: 1,
          home: { teamId: 1, totalPointsLive: 0, pointsByScoringPeriod: { '1': 10 } },
          away: { teamId: 2, totalPointsLive: 0, pointsByScoringPeriod: { '1': 8 } }
        }
      ]
    }
    const live = {
      schedule: [
        {
          matchupPeriodId: 1,
          home: { teamId: 1, totalPointsLive: 0, pointsByScoringPeriod: { '1': 22.4 } },
          away: { teamId: 2, totalPointsLive: 0, pointsByScoringPeriod: { '1': 18.1 } }
        }
      ]
    }
    const matchup = toEspnMatchup({
      payload: overlayLiveScoring(cached, live),
      cookies,
      displayWeek: 1
    })
    expect(matchup?.myPoints).toBe(22.4)
    expect(matchup?.oppPoints).toBe(18.1)
  })

  it('overlays live schedule onto leftover games when home/away nest team.id', () => {
    const cookies = { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' }
    const cached = {
      teams: [
        {
          id: 1,
          primaryOwner: '{11111111-1111-1111-1111-111111111111}',
          location: 'Mine',
          nickname: 'Squad'
        },
        { id: 2, location: 'Them', nickname: 'Squad' }
      ],
      schedule: [
        {
          matchupPeriodId: 1,
          home: { teamId: 1, totalPointsLive: 0, pointsByScoringPeriod: { '1': 22.4 } },
          away: { teamId: 2, totalPointsLive: 0, pointsByScoringPeriod: { '1': 15.1 } }
        }
      ]
    }
    const live = {
      schedule: [
        {
          matchupPeriodId: 1,
          home: { liveScore: 18, team: { id: 1 } },
          away: { liveScore: 12, team: { id: '2' } }
        }
      ]
    }
    const matchup = toEspnMatchup({
      payload: overlayLiveScoring(cached, live),
      cookies,
      displayWeek: 1
    })
    expect(matchup?.myPoints).toBe(18)
    expect(matchup?.oppPoints).toBe(12)
  })

  it('lets a lower live schedule period correct leftover pointsByScoringPeriod', () => {
    const cookies = { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' }
    const cached = {
      teams: [
        {
          id: 1,
          primaryOwner: '{11111111-1111-1111-1111-111111111111}',
          location: 'Mine',
          nickname: 'Squad'
        },
        { id: 2, location: 'Them', nickname: 'Squad' }
      ],
      schedule: [
        {
          matchupPeriodId: 1,
          home: { teamId: 1, totalPointsLive: 0, pointsByScoringPeriod: { '1': 22.4 } },
          away: { teamId: 2, totalPointsLive: 0, pointsByScoringPeriod: { '1': 15.1 } }
        }
      ]
    }
    const live = {
      schedule: [
        {
          matchupPeriodId: 1,
          home: { teamId: 1, totalPointsLive: 18, pointsByScoringPeriod: { '1': 18 } },
          away: { teamId: 2, totalPointsLive: 12, pointsByScoringPeriod: { '1': 12 } }
        }
      ]
    }
    const matchup = toEspnMatchup({
      payload: overlayLiveScoring(cached, live),
      cookies,
      displayWeek: 1
    })
    expect(matchup?.myPoints).toBe(18)
    expect(matchup?.oppPoints).toBe(12)
  })

  it('lets a zeroed live schedule period correct leftover pointsByScoringPeriod', () => {
    const cookies = { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' }
    const cached = {
      teams: [
        {
          id: 1,
          primaryOwner: '{11111111-1111-1111-1111-111111111111}',
          location: 'Mine',
          nickname: 'Squad'
        },
        { id: 2, location: 'Them', nickname: 'Squad' }
      ],
      schedule: [
        {
          matchupPeriodId: 1,
          home: { teamId: 1, totalPointsLive: 0, pointsByScoringPeriod: { '1': 22.4 } },
          away: { teamId: 2, totalPointsLive: 0, pointsByScoringPeriod: { '1': 15.1 } }
        }
      ]
    }
    const live = {
      schedule: [
        {
          matchupPeriodId: 1,
          home: { teamId: 1, totalPointsLive: 0, pointsByScoringPeriod: { '1': 0 } },
          away: { teamId: 2, totalPointsLive: 0, pointsByScoringPeriod: { '1': 0 } }
        }
      ]
    }
    const matchup = toEspnMatchup({
      payload: overlayLiveScoring(cached, live),
      cookies,
      displayWeek: 1
    })
    expect(matchup?.myPoints).toBe(0)
    expect(matchup?.oppPoints).toBe(0)
  })

  it('overlays schedule totalPointsLive onto a cached roster when liveScoring is omitted', () => {
    const cookies = { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' }
    const cached = {
      teams: [
        {
          id: 1,
          primaryOwner: '{11111111-1111-1111-1111-111111111111}',
          location: 'Mine',
          nickname: 'Squad'
        },
        { id: 2, location: 'Them', nickname: 'Squad' }
      ],
      schedule: [
        {
          matchupPeriodId: 1,
          home: {
            teamId: 1,
            totalPointsLive: 10,
            rosterForCurrentScoringPeriod: {
              entries: [
                {
                  lineupSlotId: 0,
                  playerId: 7,
                  playerPoolEntry: {
                    appliedStatTotal: 10,
                    player: { fullName: 'Cached QB', defaultPositionId: 1, proTeamId: 12, stats: [] }
                  }
                }
              ]
            }
          },
          away: { teamId: 2, totalPointsLive: 8 }
        }
      ]
    }
    const liveOnly = {
      schedule: [
        {
          matchupPeriodId: 1,
          home: { teamId: 1, totalPointsLive: 41.2 },
          away: { teamId: 2, totalPointsLive: 27.6 }
        }
      ]
    }
    const matchup = toEspnMatchup({
      payload: overlayLiveScoring(cached, liveOnly),
      cookies,
      displayWeek: 1
    })
    expect(matchup?.myPoints).toBe(41.2)
    expect(matchup?.oppPoints).toBe(27.6)
    expect(matchup?.starters[0]?.name).toBe('Cached QB')
    expect(matchup?.starters[0]?.points).toBe(10)
  })

  it('overlays liveScoring.schedule onto a cached roster when top-level schedule is omitted', () => {
    const cookies = { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' }
    const cached = {
      teams: [
        {
          id: 1,
          primaryOwner: '{11111111-1111-1111-1111-111111111111}',
          location: 'Mine',
          nickname: 'Squad'
        },
        { id: 2, location: 'Them', nickname: 'Squad' }
      ],
      schedule: [
        {
          matchupPeriodId: 1,
          home: {
            teamId: 1,
            totalPointsLive: 10,
            rosterForCurrentScoringPeriod: {
              entries: [
                {
                  lineupSlotId: 0,
                  playerId: 7,
                  playerPoolEntry: {
                    appliedStatTotal: 10,
                    player: { fullName: 'Cached QB', defaultPositionId: 1, proTeamId: 12, stats: [] }
                  }
                }
              ]
            }
          },
          away: { teamId: 2, totalPointsLive: 8 }
        }
      ]
    }
    const liveOnly = {
      liveScoring: {
        schedule: [
          {
            matchupPeriodId: 1,
            home: { teamId: 1, totalPointsLive: 41.2 },
            away: { teamId: 2, totalPointsLive: 27.6 }
          }
        ]
      }
    }
    const matchup = toEspnMatchup({
      payload: overlayLiveScoring(cached, liveOnly),
      cookies,
      displayWeek: 1
    })
    expect(matchup?.myPoints).toBe(41.2)
    expect(matchup?.oppPoints).toBe(27.6)
    expect(matchup?.starters[0]?.name).toBe('Cached QB')
    expect(matchup?.starters[0]?.points).toBe(10)
  })

  it('overlays liveScoring.schedule when it is a map of games', () => {
    const cookies = { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' }
    const cached = {
      teams: [
        {
          id: 1,
          primaryOwner: '{11111111-1111-1111-1111-111111111111}',
          location: 'Mine',
          nickname: 'Squad'
        },
        { id: 2, location: 'Them', nickname: 'Squad' }
      ],
      schedule: [
        {
          matchupPeriodId: 1,
          home: { teamId: 1, totalPointsLive: 10 },
          away: { teamId: 2, totalPointsLive: 8 }
        }
      ]
    }
    const liveOnly = {
      liveScoring: {
        schedule: {
          '0': {
            matchupPeriodId: 1,
            home: { teamId: 1, totalPointsLive: 41.2 },
            away: { teamId: 2, totalPointsLive: 27.6 }
          }
        }
      }
    }
    const matchup = toEspnMatchup({
      payload: overlayLiveScoring(cached, liveOnly),
      cookies,
      displayWeek: 1
    })
    expect(matchup?.myPoints).toBe(41.2)
    expect(matchup?.oppPoints).toBe(27.6)
  })

  it('keeps cached week actuals when the live roster only has projections', () => {
    const cookies = { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' }
    const cached = {
      teams: [
        {
          id: 1,
          primaryOwner: '{11111111-1111-1111-1111-111111111111}',
          location: 'Mine',
          nickname: 'Squad'
        },
        { id: 2, location: 'Them', nickname: 'Squad' }
      ],
      schedule: [
        {
          matchupPeriodId: 1,
          home: {
            teamId: 1,
            totalPointsLive: 12.4,
            rosterForCurrentScoringPeriod: {
              entries: [
                {
                  lineupSlotId: 0,
                  playerId: 1,
                  playerPoolEntry: {
                    appliedStatTotal: 12.4,
                    player: {
                      fullName: 'Cached QB',
                      stats: [
                        { statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 12.4 }
                      ]
                    }
                  }
                }
              ]
            }
          },
          away: { teamId: 2, totalPointsLive: 8 }
        }
      ]
    }
    const liveOnly = {
      schedule: [
        {
          matchupPeriodId: 1,
          home: {
            teamId: 1,
            totalPointsLive: 12.4,
            rosterForCurrentScoringPeriod: {
              entries: [
                {
                  lineupSlotId: 0,
                  playerId: 1,
                  playerPoolEntry: {
                    appliedStatTotal: 0,
                    player: {
                      fullName: 'Cached QB',
                      stats: [
                        { statSourceId: 1, statSplitTypeId: 1, scoringPeriodId: 1, appliedTotal: 18.2 }
                      ]
                    }
                  }
                }
              ]
            }
          },
          away: { teamId: 2, totalPointsLive: 8 }
        }
      ]
    }
    const matchup = toEspnMatchup({
      payload: overlayLiveScoring(cached, liveOnly),
      cookies,
      displayWeek: 1
    })
    expect(matchup?.starters[0]?.points).toBe(12.4)
    expect(matchup?.myPoints).toBe(12.4)
  })
})

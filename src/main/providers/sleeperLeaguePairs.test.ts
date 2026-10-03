import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import type { NflTickerGame } from '@shared/types'
import type { CachedPlayer, SleeperLeagueUser, SleeperMatchup, SleeperRoster } from './sleeperClient'
import { toMatchup, toSleeperLeaguePairs } from './sleeperAdapter'

type Fixture = {
  userId: string
  rosters: SleeperRoster[]
  users: SleeperLeagueUser[]
  players: Record<string, CachedPlayer>
  matchups: SleeperMatchup[]
}

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), 'fixtures/sleeper-league-matchups.json'), 'utf8')
) as Fixture

const ticker: NflTickerGame[] = [
  { id: 'dal-nyg', away: 'DAL', awayScore: 28, home: 'NYG', homeScore: 14, clock: 'FINAL', final: true }
]

describe('toSleeperLeaguePairs', () => {
  it('pairs two matchup ids and treats a lone id and a null id as byes', () => {
    const pairs = toSleeperLeaguePairs({ ...fixture, ticker })
    expect(pairs.map((pair) => pair.id)).toEqual(['m:1', 'bye:3', 'bye:4'])
    const mine = pairs.find((pair) => pair.mine)
    expect(mine?.matchup.myTeam.name).toBe('Alpha')
    expect(mine?.matchup.oppTeam?.name).toBe('Bravo')
    expect(mine?.matchup.myPoints).toBe(90)
    expect(mine?.left).toBe(0)
    expect(mine?.oppLeft).toBe(1)
    expect(pairs.filter((pair) => pair.matchup.oppTeam == null).map((pair) => pair.matchup.myTeam.name)).toEqual([
      'Charlie',
      'Delta'
    ])
    const hud = toMatchup(fixture)
    expect(hud?.myTeam.name).toBe('Alpha')
    expect(hud?.oppTeam?.name).toBe('Bravo')
    expect(hud?.oppTeam?.id).toBe('2')
  })

  it('shows nothing yet when every matchup id is still null', () => {
    const pairs = toSleeperLeaguePairs({
      ...fixture,
      matchups: fixture.matchups.map((row) => ({ ...row, matchup_id: null }))
    })
    expect(pairs).toEqual([])
  })

  it('keeps an ownerless roster, a negative score, and does not count IR, empty slots, or bye-week teams', () => {
    const pairs = toSleeperLeaguePairs({
      userId: 'u1',
      rosters: [
        { roster_id: 1, owner_id: 'u1', reserve: ['11'], settings: { wins: 1, losses: 0 } },
        { roster_id: 5, owner_id: null, settings: { wins: 0, losses: 1 } },
        { roster_id: 6, owner_id: 'u6', settings: { wins: 0, losses: 1 } }
      ],
      users: [
        { user_id: 'u1', display_name: 'Ada', metadata: { team_name: 'Alpha' } },
        { user_id: 'u6', display_name: 'Eve', metadata: { team_name: 'Echo' } }
      ],
      players: {
        '11': { name: 'IR Receiver', position: 'WR', nflTeam: 'KC' },
        '50': { name: 'Orphan DST', position: 'DEF', nflTeam: 'NYJ' },
        '60': { name: 'Echo QB', position: 'QB', nflTeam: 'KC' }
      },
      matchups: [
        {
          roster_id: 1,
          matchup_id: 1,
          points: 3,
          starters: ['11', '0'],
          players: ['11'],
          players_points: { '11': 0 }
        },
        {
          roster_id: 2,
          matchup_id: 9,
          points: 1,
          starters: [],
          players: []
        },
        {
          roster_id: 5,
          matchup_id: 3,
          points: -2,
          starters: ['50', '0'],
          players: ['50'],
          players_points: { '50': -2 }
        },
        {
          roster_id: 6,
          matchup_id: 3,
          points: 4,
          starters: ['60'],
          players: ['60'],
          players_points: { '60': 4 }
        }
      ],
      ticker: [],
      slate: ['KC', 'LV']
    })
    const mine = pairs.find((pair) => pair.mine)
    expect(mine?.matchup.starters).toEqual([])
    expect(mine?.left).toBe(0)
    const orphan = pairs.find((pair) => pair.id === 'm:3')
    expect(orphan?.matchup.myTeam.name).toBe('Roster 5')
    expect(orphan?.matchup.myTeam.owner).toBe('Unknown')
    expect(orphan?.matchup.oppTeam?.name).toBe('Echo')
    expect(orphan?.matchup.myPoints).toBe(-2)
    expect(orphan?.left).toBe(0)
    expect(orphan?.oppLeft).toBe(1)
    expect(orphan?.matchup.winPctSource).toBe('estimated')
  })

  const club = (
    rosterId: number,
    ownerId: string | null,
    name: string,
    playerId: string
  ): { roster: SleeperRoster; user: SleeperLeagueUser | null; player: CachedPlayer } => ({
    roster: { roster_id: rosterId, owner_id: ownerId, settings: { wins: 1, losses: 0 } },
    user: ownerId ? { user_id: ownerId, display_name: name, metadata: { team_name: name } } : null,
    player: { name: `${name} QB`, position: 'QB', nflTeam: 'KC' }
  })

  it('pairs the two real clubs when a synthetic median shares the matchup id, in any order', () => {
    const alpha = club(1, 'u1', 'Alpha', '10')
    const bravo = club(2, 'u2', 'Bravo', '20')
    const median = {
      roster_id: 99,
      matchup_id: 1,
      points: 70,
      starters: [] as string[],
      players: [] as string[]
    }
    const alphaRow = {
      roster_id: 1,
      matchup_id: 1,
      points: 10,
      starters: ['10'],
      players: ['10'],
      players_points: { '10': 10 }
    }
    const bravoRow = {
      roster_id: 2,
      matchup_id: 1,
      points: 8,
      starters: ['20'],
      players: ['20'],
      players_points: { '20': 8 }
    }
    const base = {
      userId: 'u1',
      rosters: [alpha.roster, bravo.roster],
      users: [alpha.user, bravo.user].filter((user): user is SleeperLeagueUser => user != null),
      players: { '10': alpha.player, '20': bravo.player },
      projections: { '10': 18, '20': 14 }
    }
    for (const matchups of [
      [median, alphaRow, bravoRow],
      [alphaRow, median, bravoRow],
      [alphaRow, bravoRow, median]
    ]) {
      const pairs = toSleeperLeaguePairs({ ...base, matchups })
      expect(pairs.map((pair) => pair.id)).toEqual(['m:1'])
      expect(pairs[0]?.matchup.myTeam.name).toBe('Alpha')
      expect(pairs[0]?.matchup.oppTeam?.name).toBe('Bravo')
      expect(pairs[0]?.matchup.myWinPct).toEqual(expect.any(Number))
      expect(pairs[0]?.pod).toBeUndefined()
      expect(pairs.some((pair) => pair.id.startsWith('bye'))).toBe(false)
    }
    const hud = toMatchup({ ...base, matchups: [median, alphaRow, bravoRow] })
    expect(hud?.myTeam.name).toBe('Alpha')
    expect(hud?.oppTeam).toBeNull()
  })

  it('does not spend the Est. win% bar on an empty median roster that is in the league', () => {
    const alpha = club(1, 'u1', 'Alpha', '10')
    const bravo = club(2, 'u2', 'Bravo', '20')
    const pairs = toSleeperLeaguePairs({
      userId: 'u1',
      rosters: [alpha.roster, bravo.roster, { roster_id: 9, owner_id: null, settings: { wins: 0, losses: 0 } }],
      users: [alpha.user, bravo.user].filter((user): user is SleeperLeagueUser => user != null),
      players: { '10': alpha.player, '20': bravo.player },
      projections: { '10': 18, '20': 14 },
      matchups: [
        { roster_id: 9, matchup_id: 1, points: 70, starters: [], players: [] },
        {
          roster_id: 1,
          matchup_id: 1,
          points: 10,
          starters: ['10'],
          players: ['10'],
          players_points: { '10': 10 }
        },
        {
          roster_id: 2,
          matchup_id: 1,
          points: 8,
          starters: ['20'],
          players: ['20'],
          players_points: { '20': 8 }
        }
      ]
    })
    expect(pairs.map((pair) => pair.id)).toEqual(['m:1'])
    expect(pairs[0]?.matchup.oppTeam?.name).toBe('Bravo')
    expect(pairs[0]?.matchup.myWinPct).toEqual(expect.any(Number))
    expect(pairs[0]?.pod?.map((side) => side.team.name)).toEqual(['Roster 9'])
    expect(pairs.some((pair) => pair.id.startsWith('bye'))).toBe(false)
  })

  it('keeps a third real club on the matchup instead of painting a bye', () => {
    const alpha = club(1, 'u1', 'Alpha', '10')
    const bravo = club(2, 'u2', 'Bravo', '20')
    const charlie = club(3, 'u3', 'Charlie', '30')
    const row = (rosterId: number, playerId: string, points: number) => ({
      roster_id: rosterId,
      matchup_id: 4,
      points,
      starters: [playerId],
      players: [playerId],
      players_points: { [playerId]: points }
    })
    const pairs = toSleeperLeaguePairs({
      userId: 'u1',
      rosters: [alpha.roster, bravo.roster, charlie.roster],
      users: [alpha.user, bravo.user, charlie.user].filter((user): user is SleeperLeagueUser => user != null),
      players: { '10': alpha.player, '20': bravo.player, '30': charlie.player },
      projections: { '10': 18, '20': 14, '30': 16 },
      matchups: [row(3, '30', 4), row(1, '10', 9), row(2, '20', 7)]
    })
    expect(pairs.map((pair) => pair.id)).toEqual(['m:4'])
    expect(pairs[0]?.matchup.myTeam.name).toBe('Alpha')
    expect(pairs[0]?.matchup.oppTeam?.name).toBe('Bravo')
    expect(pairs[0]?.pod?.map((side) => side.team.name)).toEqual(['Charlie'])
    expect(pairs[0]?.pod?.[0]?.points).toBe(4)
    expect(pairs[0]?.matchup.myWinPct).toEqual(expect.any(Number))
    expect(pairs.some((pair) => pair.matchup.oppTeam == null)).toBe(false)
  })

  it('fills Est. win% for every head-to-head that has projections, including a zero, and stays pending when one starter is missing', () => {
    const alpha = club(1, 'u1', 'Alpha', '10')
    const bravo = club(2, 'u2', 'Bravo', '20')
    const charlie = club(3, 'u3', 'Charlie', '30')
    const delta = club(4, 'u4', 'Delta', '40')
    const echo = club(5, 'u5', 'Echo', '50')
    const foxtrot = club(6, 'u6', 'Foxtrot', '60')
    const row = (rosterId: number, matchupId: number, playerId: string) => ({
      roster_id: rosterId,
      matchup_id: matchupId,
      points: 0,
      starters: [playerId],
      players: [playerId],
      players_points: { [playerId]: 0 }
    })
    const pairs = toSleeperLeaguePairs({
      userId: 'u1',
      rosters: [alpha, bravo, charlie, delta, echo, foxtrot].map((side) => side.roster),
      users: [alpha, bravo, charlie, delta, echo, foxtrot]
        .map((side) => side.user)
        .filter((user): user is SleeperLeagueUser => user != null),
      players: {
        '10': alpha.player,
        '20': bravo.player,
        '30': charlie.player,
        '40': delta.player,
        '50': echo.player,
        '60': foxtrot.player
      },
      projections: { '10': 18, '20': 0, '30': 12, '40': 11, '50': 15 },
      matchups: [
        row(1, 1, '10'),
        row(2, 1, '20'),
        row(3, 2, '30'),
        row(4, 2, '40'),
        row(5, 3, '50'),
        row(6, 3, '60')
      ]
    })
    const byId = new Map(pairs.map((pair) => [pair.id, pair]))
    expect(byId.get('m:1')?.matchup.myWinPct).toEqual(expect.any(Number))
    expect(byId.get('m:1')?.matchup.myProjectedPoints).toBe(18)
    expect(byId.get('m:1')?.matchup.oppProjectedPoints).toBe(0)
    expect(byId.get('m:2')?.matchup.myWinPct).toEqual(expect.any(Number))
    expect(byId.get('m:3')?.matchup.winPctSource).toBe('estimated')
    expect(byId.get('m:3')?.matchup.myWinPct).toBeUndefined()
    expect(byId.get('m:3')?.matchup.myProjectedPoints).toBeUndefined()
  })
})

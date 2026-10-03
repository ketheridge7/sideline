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
})

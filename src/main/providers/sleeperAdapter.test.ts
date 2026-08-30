import { describe, expect, it } from 'vitest'
import { toMatchup, toTransactions } from './sleeperAdapter'
import type { SleeperLeagueUser, SleeperMatchup, SleeperRoster } from './sleeperClient'

const players = {
  '1': { name: 'Hurts', position: 'QB', nflTeam: 'PHI' },
  '2': { name: 'Barkley', position: 'RB', nflTeam: 'PHI' },
  '3': { name: 'Allen', position: 'QB', nflTeam: 'BUF' },
  '9': { name: 'Bench', position: 'WR', nflTeam: 'DAL' }
}

const rosters: SleeperRoster[] = [
  { roster_id: 1, owner_id: 'me', co_owners: null, settings: { wins: 1, losses: 0 } },
  { roster_id: 2, owner_id: 'them', settings: { wins: 0, losses: 1 } }
]

const users: SleeperLeagueUser[] = [
  { user_id: 'me', display_name: 'Me', metadata: { team_name: 'Mine' } },
  { user_id: 'them', display_name: 'You', metadata: { team_name: 'Yours' } }
]

const matchups: SleeperMatchup[] = [
  {
    roster_id: 1,
    matchup_id: 7,
    points: 20,
    starters: ['1', '2'],
    players: ['1', '2', '9'],
    players_points: { '1': 12.4, '2': 7.6, '9': 1 }
  },
  { roster_id: 2, matchup_id: 7, points: 18, starters: ['3'], players: ['3'], players_points: { '3': 18 } }
]

describe('toMatchup', () => {
  it('pairs opponents by matchup_id and uses team totals', () => {
    const result = toMatchup({ userId: 'me', rosters, users, matchups, players })
    expect(result?.myTeam.name).toBe('Mine')
    expect(result?.oppTeam?.name).toBe('Yours')
    expect(result?.myPoints).toBe(20)
    expect(result?.oppPoints).toBe(18)
    expect(result?.starters.map((row) => row.name)).toEqual(['Hurts', 'Barkley'])
    expect(result?.bench.map((row) => row.name)).toEqual(['Bench'])
    expect(result?.starters[0]?.points).toBe(12.4)
    expect(result?.oppStarters.map((row) => row.name)).toEqual(['Allen'])
    expect(result?.oppStarters[0]?.points).toBe(18)
  })

  it('treats co_owners as my roster', () => {
    const co = [{ ...rosters[0], owner_id: 'other', co_owners: ['me'] }, rosters[1]]
    const result = toMatchup({ userId: 'me', rosters: co, users, matchups, players })
    expect(result?.myTeam.id).toBe('1')
  })

  it('does not invent per-player points', () => {
    const without = matchups.map(({ players_points, ...rest }) => rest)
    const result = toMatchup({ userId: 'me', rosters, users, matchups: without, players })
    expect(result?.starters[0]?.points).toBeUndefined()
    expect(result?.myPoints).toBe(20)
  })
})

describe('toTransactions', () => {
  it('derives players from adds and drops maps', () => {
    const rows = toTransactions(
      [
        {
          transaction_id: 't1',
          type: 'waiver',
          status: 'complete',
          adds: { '1': 1 },
          drops: { '9': 1 }
        }
      ],
      players
    )
    expect(rows[0]?.players).toEqual(['Hurts', 'Bench'])
    expect(rows[0]?.type).toBe('add_drop')
  })
})

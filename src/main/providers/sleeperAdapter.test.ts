import { describe, expect, it } from 'vitest'
import { applyPlayerNames, applySleeperWinEstimate, overlaySleeperMatchups, sleeperInactiveByRoster, sleeperMatchupWeek, sleeperRosterIdForUser, starterProjectedFinal, starterProjectedTotal, toMatchup, toNflState, toTransactions } from './sleeperAdapter'
import { parseSleeperMatchup, type SleeperLeagueUser, type SleeperMatchup, type SleeperRoster } from './sleeperClient'
import { emptyScoreMemory, stabilizeMatchup } from '@shared/scoreStability'
import { finalNflTeams } from '@shared/winPct'
import type { Matchup } from '@shared/types'

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
    expect(result?.myWinPct).toBeUndefined()
    expect(result?.oppWinPct).toBeUndefined()
    expect(result?.winPctSource).toBe('estimated')
  })

  it('copies a published Sleeper win_probability onto the matchup when present', () => {
    const live = [
      { ...matchups[0], win_probability: 0.62 },
      { ...matchups[1], win_probability: 0.38 }
    ]
    const result = toMatchup({ userId: 'me', rosters, users, matchups: live, players })
    expect(result?.myPoints).toBe(20)
    expect(result?.myWinPct).toBe(0.62)
    expect(result?.oppWinPct).toBe(0.38)
    expect(result?.winPctSource).toBe('official')
  })

  it('treats co_owners as my roster', () => {
    const co = [{ ...rosters[0], owner_id: 'other', co_owners: ['me'] }, rosters[1]]
    const result = toMatchup({ userId: 'me', rosters: co, users, matchups, players })
    expect(result?.myTeam.id).toBe('1')
  })

  it('matches my roster when user_id and owner_id disagree on string vs number', () => {
    const numbered = [{ ...rosters[0], owner_id: 11 as unknown as string }, rosters[1]]
    const numberedUsers = [{ ...users[0], user_id: '11' }, users[1]]
    const result = toMatchup({
      userId: 11 as unknown as string,
      rosters: numbered,
      users: numberedUsers,
      matchups,
      players
    })
    expect(result?.myTeam.name).toBe('Mine')
  })

  it('pairs opponents when roster_id and starter ids are quoted JSON numbers', () => {
    const stringRosters = [
      { ...rosters[0], roster_id: '1' as unknown as number },
      { ...rosters[1], roster_id: '2' as unknown as number }
    ]
    const live = [
      {
        roster_id: '1' as unknown as number,
        matchup_id: '7' as unknown as number,
        points: 20,
        starters: [1, 2] as unknown as string[],
        players: [1, 2, 9] as unknown as string[],
        players_points: { '1': 12.4, '2': 7.6, '9': 1 }
      },
      {
        roster_id: '2' as unknown as number,
        matchup_id: '7' as unknown as number,
        points: 18,
        starters: [3] as unknown as string[],
        players: [3] as unknown as string[],
        players_points: { '3': 18 }
      }
    ]
    const result = toMatchup({ userId: 'me', rosters: stringRosters, users, matchups: live, players })
    expect(result?.myTeam.name).toBe('Mine')
    expect(result?.oppTeam?.name).toBe('Yours')
    expect(result?.starters[0]?.name).toBe('Hurts')
    expect(result?.starters[0]?.points).toBe(12.4)
  })

  it('does not invent per-player points', () => {
    const without = matchups.map(({ players_points, ...rest }) => rest)
    const result = toMatchup({ userId: 'me', rosters, users, matchups: without, players })
    expect(result?.starters[0]?.points).toBeUndefined()
    expect(result?.myPoints).toBe(20)
  })

  it('uses live points when custom_points is null', () => {
    const live = matchups.map((row) => ({ ...row, custom_points: null, points: row.points }))
    const result = toMatchup({ userId: 'me', rosters, users, matchups: live, players })
    expect(result?.myPoints).toBe(20)
    expect(result?.oppPoints).toBe(18)
  })

  it('uses starter points when the team total is still zero', () => {
    const live = [
      { ...matchups[0], points: 0 },
      { ...matchups[1], points: 0 }
    ]
    const result = toMatchup({ userId: 'me', rosters, users, matchups: live, players })
    expect(result?.myPoints).toBe(20)
    expect(result?.oppPoints).toBe(18)
  })

  it('uses starters_points when players_points is still zero', () => {
    const live = [
      {
        ...matchups[0],
        points: 0,
        players_points: { '1': 0, '2': 0, '9': 0 },
        starters_points: [22.4, 7.6]
      },
      matchups[1]
    ]
    const result = toMatchup({ userId: 'me', rosters, users, matchups: live, players })
    expect(result?.starters[0]?.points).toBe(22.4)
    expect(result?.starters[1]?.points).toBe(7.6)
    expect(result?.myPoints).toBe(30)
  })

  it('lets a lower players_points correct leftover starters_points on the same row', () => {
    const live = [
      {
        ...matchups[0],
        points: 18,
        players_points: { '1': 10.4, '2': 7.6, '9': 1 },
        starters_points: [22.4, 10]
      },
      { ...matchups[1], points: 15, players_points: { '3': 15 }, starters_points: [18] }
    ]
    const result = toMatchup({ userId: 'me', rosters, users, matchups: live, players })
    expect(result?.starters[0]?.points).toBe(10.4)
    expect(result?.starters[1]?.points).toBe(7.6)
    expect(result?.oppStarters[0]?.points).toBe(15)
    expect(result?.myPoints).toBe(18)
  })

  it('keeps commissioner custom_points over the starter sum', () => {
    const live = [{ ...matchups[0], custom_points: 19.5, points: 0 }, matchups[1]]
    const result = toMatchup({ userId: 'me', rosters, users, matchups: live, players })
    expect(result?.myPoints).toBe(19.5)
  })

  it('keeps a negative DST score when players_points is still zero', () => {
    const live: SleeperMatchup[] = [
      {
        roster_id: 1,
        matchup_id: 7,
        points: 0,
        starters: ['1', '2'],
        players: ['1', '2'],
        players_points: { '1': 0, '2': 0 },
        starters_points: [-3.2, 0]
      },
      matchups[1]
    ]
    const result = toMatchup({ userId: 'me', rosters, users, matchups: live, players })
    expect(result?.starters[0]?.points).toBe(-3.2)
    expect(result?.myPoints).toBe(-3.2)
  })

  it('keeps a negative official total when bench points would otherwise explain it away', () => {
    const live: SleeperMatchup[] = [
      {
        roster_id: 1,
        matchup_id: 7,
        points: -4.2,
        starters: ['1', '2'],
        players: ['1', '2', '9'],
        players_points: { '1': 0, '2': 0, '9': 6 },
        starters_points: [0, 0]
      },
      matchups[1]
    ]
    const result = toMatchup({ userId: 'me', rosters, users, matchups: live, players })
    expect(result?.myPoints).toBe(-4.2)
    expect(result?.bench[0]?.points).toBe(6)
  })

  it('does not count a bench scorer when no starter has played (TNF)', () => {
    const live: SleeperMatchup[] = [
      {
        roster_id: 1,
        matchup_id: 7,
        points: 0,
        starters: ['1', '0', '2'],
        players: ['1', '2', '9'],
        players_points: { '1': 0, '2': 0, '9': 14.2, '0': 14.2 },
        starters_points: [0, 14.2, 0]
      },
      {
        roster_id: 2,
        matchup_id: 7,
        points: 0,
        starters: ['3', '0'],
        players: ['3', '9'],
        players_points: { '3': 0, '9': 6.5 },
        starters_points: [0, 6.5]
      }
    ]
    const result = toMatchup({ userId: 'me', rosters, users, matchups: live, players })
    expect(result?.myPoints).toBe(0)
    expect(result?.oppPoints).toBe(0)
    expect(result?.starters.map((row) => row.playerId)).toEqual(['1', '2'])
    expect(result?.starters.every((row) => (row.points ?? 0) === 0)).toBe(true)
    expect(result?.bench.map((row) => row.playerId)).toEqual(['9'])
    expect(result?.bench[0]?.points).toBe(14.2)
    expect(result?.oppStarters.map((row) => row.playerId)).toEqual(['3'])
    expect(result?.oppBench[0]?.points).toBe(6.5)
  })

  it('ignores a positive matchup total that is only bench points', () => {
    const live: SleeperMatchup[] = [
      {
        roster_id: 1,
        matchup_id: 7,
        points: 14.2,
        starters: ['1', '2'],
        players: ['1', '2', '9'],
        players_points: { '1': 0, '2': 0, '9': 14.2 },
        starters_points: [0, 0]
      },
      matchups[1]
    ]
    const result = toMatchup({ userId: 'me', rosters, users, matchups: live, players })
    expect(result?.myPoints).toBe(0)
    expect(result?.bench[0]?.points).toBe(14.2)
    expect(result?.oppPoints).toBe(18)
  })

  it('counts starters only when matchup points equal the whole roster', () => {
    const live: SleeperMatchup[] = [
      {
        ...matchups[0],
        points: 21.8,
        players_points: { '1': 12.4, '2': 7.6, '9': 1.8 }
      },
      matchups[1]
    ]
    const result = toMatchup({ userId: 'me', rosters, users, matchups: live, players })
    expect(result?.myPoints).toBe(20)
    expect(result?.bench[0]?.points).toBe(1.8)
  })

  it('keeps official starter points when a bench player has also scored', () => {
    const live: SleeperMatchup[] = [
      {
        roster_id: 1,
        matchup_id: 7,
        points: 3.4,
        starters: ['1', '2'],
        players: ['1', '2', '9'],
        players_points: { '1': 3.4, '2': 0, '9': 4.7 },
        starters_points: [3.4, 0]
      },
      matchups[1]
    ]
    const result = toMatchup({ userId: 'me', rosters, users, matchups: live, players })
    expect(result?.myPoints).toBe(3.4)
    expect(result?.bench[0]?.points).toBe(4.7)
  })

  it('does not score IR or taxi players left in the starter list', () => {
    const withInactive: SleeperRoster[] = [
      { ...rosters[0], reserve: ['9'], taxi: ['8'] },
      rosters[1]
    ]
    const live: SleeperMatchup[] = [
      {
        roster_id: 1,
        matchup_id: 7,
        points: 8,
        starters: ['1', '9', '0'],
        players: ['1', '8', '9'],
        players_points: { '1': 0, '8': 3, '9': 5 },
        starters_points: [0, 5, 3]
      },
      matchups[1]
    ]
    const result = toMatchup({
      userId: 'me',
      rosters: withInactive,
      users,
      matchups: live,
      players: { ...players, '8': { name: 'Taxi', position: 'RB', nflTeam: 'NYJ' } }
    })
    expect(result?.myPoints).toBe(0)
    expect(result?.starters.map((row) => row.playerId)).toEqual(['1'])
    expect(result?.bench.map((row) => row.playerId)).toEqual(['9', '8'])
    expect(result?.bench[0]?.points).toBe(5)
    expect(result?.bench[1]?.points).toBe(3)
  })
})

describe('overlaySleeperMatchups', () => {
  it('paints live points onto last HUD without waiting on rosters', () => {
    const prev = toMatchup({ userId: 'me', rosters, users, matchups, players })
    expect(prev).not.toBeNull()
    if (!prev) return
    const live = [
      { ...matchups[0], points: 41.2, players_points: { '1': 22.4, '2': 18.8, '9': 1 } },
      { ...matchups[1], points: 27.6, players_points: { '3': 27.6 } }
    ]
    const next = overlaySleeperMatchups(prev, live)
    expect(next?.myPoints).toBe(41.2)
    expect(next?.oppPoints).toBe(27.6)
    expect(next?.starters[0]?.name).toBe('Hurts')
    expect(next?.starters[0]?.points).toBe(22.4)
    expect(next?.oppStarters[0]?.points).toBe(27.6)
  })

  it('overlays published Sleeper win_probability and keeps last when compact omits it', () => {
    const prev = toMatchup({ userId: 'me', rosters, users, matchups, players })
    expect(prev).not.toBeNull()
    if (!prev) return
    const withWp = overlaySleeperMatchups(prev, [
      { ...matchups[0], points: 41.2, win_probability: 0.62, players_points: { '1': 22.4, '2': 18.8, '9': 1 } },
      { ...matchups[1], points: 27.6, win_probability: 0.38, players_points: { '3': 27.6 } }
    ])
    expect(withWp?.myPoints).toBe(41.2)
    expect(withWp?.myWinPct).toBe(0.62)
    expect(withWp?.oppWinPct).toBe(0.38)
    expect(withWp?.winPctSource).toBe('official')
    const omitted = overlaySleeperMatchups(withWp!, [
      { ...matchups[0], points: 42.1, players_points: { '1': 23.3, '2': 18.8, '9': 1 } },
      { ...matchups[1], points: 27.6, players_points: { '3': 27.6 } }
    ])
    expect(omitted?.myPoints).toBe(42.1)
    expect(omitted?.myWinPct).toBe(0.62)
    expect(omitted?.oppWinPct).toBe(0.38)
    expect(omitted?.winPctSource).toBe('official')
  })

  it('overlays player-id keyed starters_points when the payload omits starters', () => {
    const prev = toMatchup({ userId: 'me', rosters, users, matchups, players })
    expect(prev).not.toBeNull()
    if (!prev) return
    const mine = parseSleeperMatchup({
      roster_id: 1,
      matchup_id: 7,
      points: 30,
      starters_points: { '1': 18, '2': 12 }
    })
    const opp = parseSleeperMatchup({
      roster_id: 2,
      matchup_id: 7,
      points: 9,
      starters_points: { '3': 9 }
    })
    expect(mine).not.toBeNull()
    expect(opp).not.toBeNull()
    if (!mine || !opp) return
    const next = overlaySleeperMatchups(prev, [mine, opp])
    expect(next?.myPoints).toBe(30)
    expect(next?.starters[0]?.points).toBe(18)
    expect(next?.starters[1]?.points).toBe(12)
    expect(next?.oppPoints).toBe(9)
    expect(next?.oppStarters[0]?.points).toBe(9)
  })

  it('lets a live /matchups correction move HUD totals down', () => {
    const prev = toMatchup({ userId: 'me', rosters, users, matchups, players })
    expect(prev).not.toBeNull()
    if (!prev) return
    const live = [
      { ...matchups[0], points: 18, players_points: { '1': 10.4, '2': 7.6, '9': 1 } },
      { ...matchups[1], points: 15, players_points: { '3': 15 } }
    ]
    const next = overlaySleeperMatchups(prev, live)
    expect(next?.myPoints).toBe(18)
    expect(next?.starters[0]?.points).toBe(10.4)
    expect(next?.oppPoints).toBe(15)
    expect(next?.oppStarters[0]?.points).toBe(15)
  })

  it('does not let a later lower /matchups payload overwrite a committed HUD total', () => {
    const prev = toMatchup({ userId: 'me', rosters, users, matchups, players })
    expect(prev).not.toBeNull()
    if (!prev) return
    const memory = emptyScoreMemory()
    const shown = stabilizeMatchup(null, prev, memory)
    const live = [
      { ...matchups[0], points: 18, players_points: { '1': 10.4, '2': 7.6, '9': 1 } },
      { ...matchups[1], points: 15, players_points: { '3': 15 } }
    ]
    const candidate = overlaySleeperMatchups(shown, live)
    expect(candidate?.myPoints).toBe(18)
    const held = stabilizeMatchup(shown, candidate!, memory)
    expect(held.myPoints).toBe(prev.myPoints)
    expect(held.starters[0]?.points).toBe(prev.starters[0]?.points)
  })

  it('lets a lower team total correct leftover starter chips', () => {
    const prev = toMatchup({ userId: 'me', rosters, users, matchups, players })
    expect(prev).not.toBeNull()
    if (!prev) return
    const live = [
      { ...matchups[0], points: 18, players_points: { '1': 12.4, '2': 7.6, '9': 1 } },
      { ...matchups[1], points: 15, players_points: { '3': 18 } }
    ]
    const next = overlaySleeperMatchups(prev, live)
    expect(next?.myPoints).toBe(18)
    expect(next?.starters[0]?.points).toBe(12.4)
    expect(next?.oppPoints).toBe(15)
  })

  it('keeps last HUD when /matchups is a zeroed stub without player points', () => {
    const prev = toMatchup({ userId: 'me', rosters, users, matchups, players })
    expect(prev).not.toBeNull()
    if (!prev) return
    const live = [
      { roster_id: 1, matchup_id: 7, points: 0 },
      { roster_id: 2, matchup_id: 7, points: 0 }
    ]
    const next = overlaySleeperMatchups(prev, live)
    expect(next?.myPoints).toBe(20)
    expect(next?.starters[0]?.points).toBe(12.4)
    expect(next?.oppPoints).toBe(18)
  })

  it('does not let a zeroed stub on one roster wipe last HUD on the other', () => {
    const prev = toMatchup({ userId: 'me', rosters, users, matchups, players })
    expect(prev).not.toBeNull()
    if (!prev) return
    const live = [
      { roster_id: 1, matchup_id: 7, points: 0 },
      { roster_id: 2, matchup_id: 7, points: 15, players_points: { '3': 15 } }
    ]
    const next = overlaySleeperMatchups(prev, live)
    expect(next?.myPoints).toBe(20)
    expect(next?.starters[0]?.points).toBe(12.4)
    expect(next?.oppPoints).toBe(15)
    expect(next?.oppStarters[0]?.points).toBe(15)
  })

  it('keeps last HUD when /matchups is a zeroed players_points stub', () => {
    const prev = toMatchup({ userId: 'me', rosters, users, matchups, players })
    expect(prev).not.toBeNull()
    if (!prev) return
    const live = [
      {
        roster_id: 1,
        matchup_id: 7,
        points: 0,
        starters_points: [0, 0],
        players_points: { '1': 0, '2': 0, '9': 0 }
      },
      { roster_id: 2, matchup_id: 7, points: 0, starters_points: [0], players_points: { '3': 0 } }
    ]
    const next = overlaySleeperMatchups(prev, live)
    expect(next?.myPoints).toBe(20)
    expect(next?.starters[0]?.points).toBe(12.4)
    expect(next?.oppPoints).toBe(18)
  })

  it('keeps last starter chips when /matchups has a team total but zeroed player maps', () => {
    const prev = toMatchup({ userId: 'me', rosters, users, matchups, players })
    expect(prev).not.toBeNull()
    if (!prev) return
    const live = [
      {
        roster_id: 1,
        matchup_id: 7,
        points: 22.4,
        starters_points: [0, 0],
        players_points: { '1': 0, '2': 0, '9': 0 }
      },
      { roster_id: 2, matchup_id: 7, points: 15.1, starters_points: [0], players_points: { '3': 0 } }
    ]
    const next = overlaySleeperMatchups(prev, live)
    expect(next?.myPoints).toBe(22.4)
    expect(next?.starters[0]?.points).toBe(12.4)
    expect(next?.oppPoints).toBe(15.1)
    expect(next?.oppStarters[0]?.points).toBe(18)
  })

  it('paints commissioner custom_points of 0', () => {
    const prev = toMatchup({ userId: 'me', rosters, users, matchups, players })
    expect(prev).not.toBeNull()
    if (!prev) return
    const live = [
      { ...matchups[0], custom_points: 0, points: 20, players_points: { '1': 12.4, '2': 7.6 } },
      matchups[1]
    ]
    const next = overlaySleeperMatchups(prev, live)
    expect(next?.myPoints).toBe(0)
    expect(next?.scoresFinal).toBe(true)
    const memory = emptyScoreMemory()
    const shown = stabilizeMatchup(null, prev, memory)
    expect(stabilizeMatchup(shown, next, memory).myPoints).toBe(0)
  })

  it('overlays when players_points keys are JSON numbers', () => {
    const prev = toMatchup({ userId: 'me', rosters, users, matchups, players })
    expect(prev).not.toBeNull()
    if (!prev) return
    const numericKeys = { 1: 22.4, 2: 18.8 } as unknown as Record<string, number>
    const live = [
      { ...matchups[0], points: 41.2, players_points: numericKeys },
      matchups[1]
    ]
    const next = overlaySleeperMatchups(prev, live)
    expect(next?.starters[0]?.points).toBe(22.4)
  })

  it('overlays after parseSleeperMatchup zips array players_points', () => {
    const prev = toMatchup({ userId: 'me', rosters, users, matchups, players })
    expect(prev).not.toBeNull()
    const mine = parseSleeperMatchup({
      roster_id: 1,
      matchup_id: 7,
      points: 41.2,
      starters: ['1', '2'],
      players: ['1', '2', '9'],
      players_points: [22.4, 18.8, 1]
    })
    const opp = parseSleeperMatchup({
      roster_id: 2,
      matchup_id: 7,
      points: 27.6,
      starters: ['3'],
      players: ['3'],
      players_points: [27.6]
    })
    expect(mine).not.toBeNull()
    expect(opp).not.toBeNull()
    if (!prev || !mine || !opp) return
    const next = overlaySleeperMatchups(prev, [mine, opp])
    expect(next?.myPoints).toBe(41.2)
    expect(next?.starters[0]?.points).toBe(22.4)
    expect(next?.oppPoints).toBe(27.6)
  })

  it('reads starters_points when HUD playerId is a JSON number', () => {
    const prev = toMatchup({ userId: 'me', rosters, users, matchups, players })
    expect(prev).not.toBeNull()
    if (!prev) return
    const numbered = {
      ...prev,
      starters: [{ ...prev.starters[0], playerId: 1 as unknown as string }]
    }
    const live = [
      {
        ...matchups[0],
        points: 0,
        players_points: {},
        starters_points: [22.4, 7.6],
        starters: [1, 2] as unknown as string[]
      },
      matchups[1]
    ]
    const next = overlaySleeperMatchups(numbered, live)
    expect(next?.starters[0]?.points).toBe(22.4)
  })

  it('coerces quoted JSON numbers on matchup points', () => {
    const prev = toMatchup({ userId: 'me', rosters, users, matchups, players })
    expect(prev).not.toBeNull()
    if (!prev) return
    const live = [
      { ...matchups[0], points: '41.2' as unknown as number, players_points: { '1': '22.4' as unknown as number } },
      { ...matchups[1], points: '27.6' as unknown as number, players_points: { '3': '27.6' as unknown as number } }
    ]
    const next = overlaySleeperMatchups(prev, live)
    expect(next?.myPoints).toBe(41.2)
    expect(next?.starters[0]?.points).toBe(22.4)
    expect(next?.oppPoints).toBe(27.6)
  })

  it('overlays when roster_id and matchup_id are quoted JSON numbers', () => {
    const prev = toMatchup({ userId: 'me', rosters, users, matchups, players })
    expect(prev).not.toBeNull()
    if (!prev) return
    const live = [
      {
        roster_id: '1' as unknown as number,
        matchup_id: '7' as unknown as number,
        points: 41.2,
        starters: [1, 2] as unknown as string[],
        players: [1, 2, 9] as unknown as string[],
        players_points: { '1': 22.4, '2': 18.8, '9': 1 }
      },
      {
        roster_id: '2' as unknown as number,
        matchup_id: '7' as unknown as number,
        points: 27.6,
        starters: [3] as unknown as string[],
        players: [3] as unknown as string[],
        players_points: { '3': 27.6 }
      }
    ]
    const next = overlaySleeperMatchups(prev, live)
    expect(next?.myPoints).toBe(41.2)
    expect(next?.oppPoints).toBe(27.6)
    expect(next?.starters[0]?.points).toBe(22.4)
  })

  it('keeps the header at 0 on overlay when only a bench player has scored', () => {
    const kickoff: SleeperMatchup[] = [
      {
        roster_id: 1,
        matchup_id: 7,
        points: 0,
        starters: ['1', '0', '2'],
        players: ['1', '2', '9'],
        players_points: { '1': 0, '2': 0, '9': 0 },
        starters_points: [0, 0, 0]
      },
      {
        roster_id: 2,
        matchup_id: 7,
        points: 0,
        starters: ['3'],
        players: ['3'],
        players_points: { '3': 0 },
        starters_points: [0]
      }
    ]
    const prev = toMatchup({ userId: 'me', rosters, users, matchups: kickoff, players })
    expect(prev?.myPoints).toBe(0)
    expect(prev).not.toBeNull()
    if (!prev) return
    const live: SleeperMatchup[] = [
      {
        ...kickoff[0],
        points: 14.2,
        players_points: { '1': 0, '2': 0, '9': 14.2, '0': 14.2 },
        starters_points: [0, 14.2, 0]
      },
      kickoff[1]
    ]
    const next = overlaySleeperMatchups(prev, live)
    expect(next?.myPoints).toBe(0)
    expect(next?.oppPoints).toBe(0)
    expect(next?.starters.map((row) => row.playerId)).toEqual(['1', '2'])
    expect(next?.starters.every((row) => (row.points ?? 0) === 0)).toBe(true)
    expect(next?.bench.map((row) => row.playerId)).toEqual(['9'])
    expect(next?.bench[0]?.points).toBe(14.2)
  })

  it('drops IR points out of the overlay total when the roster cache marks them inactive', () => {
    const prev = toMatchup({ userId: 'me', rosters, users, matchups, players })
    expect(prev).not.toBeNull()
    if (!prev) return
    const live: SleeperMatchup[] = [
      {
        roster_id: 1,
        matchup_id: 7,
        points: 8.1,
        starters: ['9', '2'],
        players: ['1', '2', '9'],
        players_points: { '1': 0, '2': 0, '9': 8.1 }
      },
      matchups[1]
    ]
    const inactive = sleeperInactiveByRoster([{ ...rosters[0], reserve: ['9'] }])
    const next = overlaySleeperMatchups(prev, live, inactive)
    expect(next?.myPoints).toBe(0)
    expect(next?.starters.map((row) => row.playerId)).toEqual(['2'])
    expect(next?.bench.map((row) => row.playerId)).toEqual(['1', '9'])
    expect(next?.bench.find((row) => row.playerId === '9')?.points).toBe(8.1)
  })

  it('moves a benched player into the starting lineup on the next /matchups overlay', () => {
    const prev = toMatchup({ userId: 'me', rosters, users, matchups, players })
    expect(prev).not.toBeNull()
    if (!prev) return
    const live = [
      {
        ...matchups[0],
        points: 22,
        starters: ['9', '2'],
        players: ['1', '2', '9'],
        players_points: { '1': 12.4, '2': 8.1, '9': 13.9 }
      },
      matchups[1]
    ]
    const next = overlaySleeperMatchups(prev, live)
    expect(next?.starters.map((player) => player.name)).toEqual(['Bench', 'Barkley'])
    expect(next?.starters[0]?.points).toBe(13.9)
    expect(next?.bench.map((player) => player.name)).toEqual(['Hurts'])
    expect(next?.bench[0]?.points).toBe(12.4)
  })

  it('does not overlay an ESPN last HUD onto a Sleeper /matchups payload', () => {
    const espnHud = {
      myTeam: { id: '1', name: 'Dawg House', owner: 'Kevin', record: '1-0' },
      oppTeam: { id: '2', name: 'Them', owner: 'You', record: '0-1' },
      myPoints: 10,
      oppPoints: 8,
      starters: [{ playerId: '1', name: 'Hurts', position: 'QB', nflTeam: 'PHI', points: 10 }],
      bench: [] as { playerId: string; name: string; position: string; nflTeam: string }[],
      oppStarters: [{ playerId: '3', name: 'Allen', position: 'QB', nflTeam: 'BUF', points: 8 }],
      oppBench: [] as { playerId: string; name: string; position: string; nflTeam: string }[]
    }
    const live = [
      {
        roster_id: 1,
        matchup_id: 7,
        points: 88.2,
        starters: ['4046'],
        players: ['4046'],
        players_points: { '4046': 88.2 }
      },
      {
        roster_id: 2,
        matchup_id: 7,
        points: 70,
        starters: ['6794'],
        players: ['6794'],
        players_points: { '6794': 70 }
      }
    ]
    expect(overlaySleeperMatchups(espnHud, live)).toBeNull()
  })

  it('refuses week 3 opponent when week 4 reuses matchup_id numbers for a different roster', () => {
    const prev = toMatchup({ userId: 'me', rosters, users, matchups, players })
    expect(prev?.oppTeam?.id).toBe('2')
    const week4: SleeperMatchup[] = [
      {
        roster_id: 1,
        matchup_id: 3,
        points: 14,
        starters: ['1', '2'],
        players: ['1', '2', '9'],
        players_points: { '1': 8, '2': 6, '9': 1 }
      },
      {
        roster_id: 3,
        matchup_id: 3,
        points: 11,
        starters: ['4'],
        players: ['4'],
        players_points: { '4': 11 }
      },
      {
        roster_id: 2,
        matchup_id: 9,
        points: 40,
        starters: ['3'],
        players: ['3'],
        players_points: { '3': 40 }
      }
    ]
    expect(overlaySleeperMatchups(prev!, week4)).toBeNull()
    const rebuilt = toMatchup({
      userId: 'me',
      rosters: [
        ...rosters,
        { roster_id: 3, owner_id: 'new', settings: { wins: 2, losses: 1 } }
      ],
      users: [...users, { user_id: 'new', display_name: 'New', metadata: { team_name: 'This Week' } }],
      matchups: week4,
      players
    })
    expect(rebuilt?.oppTeam?.id).toBe('3')
    expect(rebuilt?.oppTeam?.name).toBe('This Week')
    expect(rebuilt?.oppPoints).toBe(11)
    expect(rebuilt?.myPoints).toBe(14)
  })

  it('keeps the same opponent when the new week pairs the same roster', () => {
    const prev = toMatchup({ userId: 'me', rosters, users, matchups, players })
    const live = [
      { ...matchups[0], points: 22, players_points: { '1': 12, '2': 10, '9': 1 } },
      { ...matchups[1], points: 16, players_points: { '3': 16 } }
    ]
    const next = overlaySleeperMatchups(prev!, live)
    expect(next?.oppTeam?.id).toBe('2')
    expect(next?.oppPoints).toBe(16)
    expect(next?.myPoints).toBe(22)
  })

  it('refuses a bye week when last week still has an opponent', () => {
    const prev = toMatchup({ userId: 'me', rosters, users, matchups, players })
    const bye: SleeperMatchup[] = [
      { roster_id: 1, matchup_id: null, points: 0, starters: ['1', '2'], players: ['1', '2'] }
    ]
    expect(overlaySleeperMatchups(prev!, bye)).toBeNull()
  })

  it('rebuilds when the user now owns a different roster even if a starter id still overlaps', () => {
    const prev = toMatchup({ userId: 'me', rosters, users, matchups, players })
    const live: SleeperMatchup[] = [
      {
        roster_id: 1,
        matchup_id: 7,
        points: 30,
        starters: ['1', '2'],
        players: ['1', '2'],
        players_points: { '1': 18, '2': 12 }
      },
      {
        roster_id: 5,
        matchup_id: 4,
        points: 9,
        starters: ['1', '4'],
        players: ['1', '4'],
        players_points: { '1': 4, '4': 5 }
      },
      {
        roster_id: 2,
        matchup_id: 7,
        points: 11,
        starters: ['3'],
        players: ['3'],
        players_points: { '3': 11 }
      }
    ]
    expect(overlaySleeperMatchups(prev!, live, undefined, 5)).toBeNull()
    const kept = overlaySleeperMatchups(prev!, live, undefined, 1)
    expect(kept?.myTeam.id).toBe('1')
    expect(kept?.myPoints).toBe(30)
  })
})

describe('sleeperMatchupWeek', () => {
  it('uses display_week during the regular season', () => {
    expect(sleeperMatchupWeek({ displayWeek: 4, seasonType: 'regular', leg: 4 })).toBe(4)
    expect(sleeperMatchupWeek({ displayWeek: 4, seasonType: 'regular' })).toBe(4)
  })

  it('uses leg for postseason matchups when display_week has moved to the NFL playoff week', () => {
    const state = toNflState({
      week: 19,
      display_week: 19,
      leg: 16,
      season: '2026',
      league_season: '2026',
      season_type: 'post'
    })
    expect(state.leg).toBe(16)
    expect(sleeperMatchupWeek(state)).toBe(16)
    expect(sleeperMatchupWeek({ displayWeek: 19, seasonType: 'post', leg: 1 })).toBe(19)
    expect(sleeperMatchupWeek({ displayWeek: 19, seasonType: 'post', leg: 19 })).toBe(19)
  })
})

describe('sleeperRosterIdForUser', () => {
  it('finds the roster this user owns, including a co-owner', () => {
    expect(sleeperRosterIdForUser(rosters, 'me')).toBe(1)
    expect(sleeperRosterIdForUser([{ ...rosters[0], owner_id: 'other', co_owners: ['me'] }, rosters[1]], 'me')).toBe(1)
    expect(sleeperRosterIdForUser(rosters, 'missing')).toBeUndefined()
  })
})

describe('applyPlayerNames', () => {
  it('fills names onto a matchup that was scored with an empty player map', () => {
    const unnamed = toMatchup({ userId: 'me', rosters, users, matchups, players: {} })
    expect(unnamed).not.toBeNull()
    if (!unnamed) return
    expect(unnamed.starters[0]?.name).toBe('1')
    const named = applyPlayerNames(unnamed, players)
    expect(named.starters.map((row) => row.name)).toEqual(['Hurts', 'Barkley'])
    expect(named.starters[0]?.points).toBe(12.4)
  })

  it('fills names when the player map keys are JSON numbers', () => {
    const unnamed = toMatchup({ userId: 'me', rosters, users, matchups, players: {} })
    expect(unnamed).not.toBeNull()
    if (!unnamed) return
    const numericPlayers = { 1: players['1'], 2: players['2'] } as unknown as Record<string, CachedPlayer>
    const named = applyPlayerNames(unnamed, numericPlayers)
    expect(named.starters.map((row) => row.name)).toEqual(['Hurts', 'Barkley'])
  })

  it('keeps existing names when the dump misses a slug id (demo rosters on a machine with a live dump)', () => {
    const demo: Matchup = {
      myTeam: { id: 'cds-ice-box', name: 'Ice Box', owner: 'Maya', record: '2-0' },
      oppTeam: null,
      myPoints: 17.8,
      oppPoints: 0,
      starters: [{ playerId: 'cds-bijan-robinson', name: 'Bijan Robinson', position: 'RB', nflTeam: 'ATL', points: 17.8 }],
      bench: [],
      oppStarters: [],
      oppBench: []
    }
    const named = applyPlayerNames(demo, players)
    expect(named.starters[0]).toMatchObject({ name: 'Bijan Robinson', position: 'RB', nflTeam: 'ATL' })
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

  it('coerces a numeric transaction_id and quoted timestamps', () => {
    const rows = toTransactions(
      [
        {
          transaction_id: 99 as unknown as string,
          type: 'trade',
          status: 'complete',
          status_updated: '1710000000000' as unknown as number
        }
      ],
      players
    )
    expect(rows[0]?.id).toBe('99')
    expect(rows[0]?.timestamp).toBe(1710000000000)
  })
})

describe('applySleeperWinEstimate', () => {
  const projections = { '1': 22, '2': 18, '3': 16 }

  it('fills Est. win% from starter projections + live points', () => {
    const matchup = toMatchup({ userId: 'me', rosters, users, matchups, players })
    expect(matchup).not.toBeNull()
    if (!matchup) return
    expect(starterProjectedTotal(matchup.starters, projections)).toBe(40)
    const next = applySleeperWinEstimate(matchup, projections)
    expect(next.winPctSource).toBe('estimated')
    expect(next.myProjectedPoints).toBe(40)
    // Allen already has 18 against a 16 projection: his projected final is what he has.
    expect(next.oppProjectedPoints).toBe(18)
    expect(next.myWinPct).toBeGreaterThan(0.8)
    expect(next.myPoints).toBe(20)
  })

  it('counts only actual points for starters whose NFL game is final (finished-under-projection skew)', () => {
    // Mine: Hurts PHI final with 5 (proj 22), Barkley still to play (proj 18).
    // Theirs: Allen BUF still to play (proj 16) with 0 so far.
    const early: SleeperMatchup[] = [
      { ...matchups[0], points: 5, players_points: { '1': 5, '2': 0, '9': 0 } },
      { ...matchups[1], points: 0, players_points: { '3': 0 } }
    ]
    const matchup = toMatchup({ userId: 'me', rosters, users, matchups: early, players })!
    const beforeFinal = applySleeperWinEstimate(matchup, { '1': 22, '2': 18, '3': 16 })
    expect(beforeFinal.myProjectedPoints).toBe(40)
    expect(beforeFinal.myWinPct).toBeGreaterThan(0.8)

    // Hurts and Barkley are both PHI, so a final PHI game leaves only what they scored: 5 + 0.
    const bothFinal = applySleeperWinEstimate(matchup, { '1': 22, '2': 18, '3': 16 }, finalNflTeams([
      { id: 'g1', away: 'DAL', awayScore: 20, home: 'PHI', homeScore: 17, clock: 'FINAL', final: true }
    ]))
    expect(bothFinal.myProjectedPoints).toBe(5)
    expect(bothFinal.oppProjectedPoints).toBe(16)
    expect(bothFinal.myWinPct).toBeLessThan(0.5)
  })

  it('flips the favorite once an underperforming starter finishes, even with a teammate still to play', () => {
    const splitPlayers = { ...players, '2': { name: 'Barkley', position: 'RB', nflTeam: 'NYG' } }
    const live: SleeperMatchup[] = [
      { ...matchups[0], points: 4, players_points: { '1': 4, '2': 0, '9': 0 } },
      { ...matchups[1], points: 10, players_points: { '3': 10 } }
    ]
    const matchup = toMatchup({ userId: 'me', rosters, users, matchups: live, players: splitPlayers })!
    const projections = { '1': 25, '2': 12, '3': 24 }
    const old = applySleeperWinEstimate(matchup, projections)
    expect(old.myProjectedPoints).toBe(37)
    expect(old.myWinPct).toBeGreaterThan(0.5)
    const next = applySleeperWinEstimate(
      matchup,
      projections,
      finalNflTeams([{ id: 'g2', away: 'WSH', awayScore: 3, home: 'PHI', homeScore: 30, clock: 'FINAL', final: true }])
    )
    expect(next.myProjectedPoints).toBe(16)
    expect(next.oppProjectedPoints).toBe(24)
    expect(next.myWinPct).toBeLessThan(0.5)
    expect(next.winPctSource).toBe('estimated')
  })

  it('does not need a projection for a starter whose game is already final', () => {
    const matchup = toMatchup({ userId: 'me', rosters, users, matchups, players })!
    const finalPhi = finalNflTeams([
      { id: 'g1', away: 'DAL', awayScore: 20, home: 'PHI', homeScore: 17, clock: 'FINAL', final: true }
    ])
    expect(starterProjectedFinal(matchup.starters, { '3': 16 }, finalPhi)).toBe(20)
    expect(starterProjectedFinal(matchup.starters, { '3': 16 })).toBeUndefined()
  })

  it('counts a DST projected at -2 before that game is final', () => {
    const dstPlayers = {
      ...players,
      '16': { name: 'Bears D/ST', position: 'DEF', nflTeam: 'CHI' }
    }
    const pregame: SleeperMatchup[] = [
      {
        roster_id: 1,
        matchup_id: 7,
        points: 0,
        starters: ['1', '16'],
        players: ['1', '16'],
        players_points: { '1': 0, '16': 0 }
      },
      {
        roster_id: 2,
        matchup_id: 7,
        points: 0,
        starters: ['3'],
        players: ['3'],
        players_points: { '3': 0 }
      }
    ]
    const projections = { '1': 20, '16': -2, '3': 20 }
    const beforeKick = toMatchup({ userId: 'me', rosters, users, matchups: pregame, players: dstPlayers })!
    const before = applySleeperWinEstimate(beforeKick, projections)
    expect(before.myProjectedPoints).toBe(18)
    expect(before.oppProjectedPoints).toBe(20)
    expect(before.myWinPct).toBeLessThan(0.5)

    const mid: SleeperMatchup[] = [
      { ...pregame[0], points: 12, players_points: { '1': 12, '16': 0 } },
      { ...pregame[1], points: 12, players_points: { '3': 12 } }
    ]
    const during = applySleeperWinEstimate(
      toMatchup({ userId: 'me', rosters, users, matchups: mid, players: dstPlayers })!,
      projections
    )
    expect(during.myPoints).toBe(12)
    expect(during.myProjectedPoints).toBe(18)
    expect(during.oppProjectedPoints).toBe(20)
    expect(during.myWinPct).toBeLessThan(0.5)

    const dstFinal = applySleeperWinEstimate(
      toMatchup({ userId: 'me', rosters, users, matchups: mid, players: dstPlayers })!,
      projections,
      finalNflTeams([
        { id: 'g', away: 'GB', awayScore: 24, home: 'CHI', homeScore: 10, clock: 'FINAL', final: true }
      ])
    )
    expect(dstFinal.myProjectedPoints).toBe(20)
  })

  it('stays pending when a starter is missing a projection (no score-share)', () => {
    const matchup = toMatchup({ userId: 'me', rosters, users, matchups, players })
    expect(matchup).not.toBeNull()
    if (!matchup) return
    const next = applySleeperWinEstimate(matchup, { '1': 22, '3': 16 })
    expect(next.winPctSource).toBe('estimated')
    expect(next.myWinPct).toBeUndefined()
    expect(next.myProjectedPoints).toBeUndefined()
    expect(applySleeperWinEstimate(matchup, null).myWinPct).toBeUndefined()
  })

  it('does not replace a published Sleeper win_probability with the estimate', () => {
    const live = [
      { ...matchups[0], win_probability: 0.62 },
      { ...matchups[1], win_probability: 0.38 }
    ]
    const matchup = toMatchup({ userId: 'me', rosters, users, matchups: live, players })
    expect(matchup).not.toBeNull()
    if (!matchup) return
    const next = applySleeperWinEstimate(matchup, projections)
    expect(next.winPctSource).toBe('official')
    expect(next.myWinPct).toBe(0.62)
    expect(next.myProjectedPoints).toBeUndefined()
  })

  it('recomputes the estimate after overlaying live points', () => {
    const matchup = toMatchup({ userId: 'me', rosters, users, matchups, players })
    expect(matchup).not.toBeNull()
    if (!matchup) return
    const first = applySleeperWinEstimate(matchup, projections)
    const live = overlaySleeperMatchups(first, [
      { ...matchups[0], points: 41.2, players_points: { '1': 22.4, '2': 18.8, '9': 1 } },
      { ...matchups[1], points: 27.6, players_points: { '3': 27.6 } }
    ])
    expect(live?.winPctSource).toBe('estimated')
    expect(live?.myWinPct).toBeUndefined()
    const next = applySleeperWinEstimate(live!, projections)
    expect(next.myPoints).toBe(41.2)
    expect(next.winPctSource).toBe('estimated')
    expect(next.myWinPct).toBeGreaterThan(0.5)
  })
})


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
})

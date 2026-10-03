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
})

import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { BENCH_SLOT_IDS, getAppliedTotal, toEspnMatchup, type EspnRosterEntry } from './espnAdapter'

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), 'fixtures/espn-league.json'), 'utf8')
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

  it('falls back to appliedStatTotal when live stats are missing', () => {
    const entry: EspnRosterEntry = {
      playerPoolEntry: { appliedStatTotal: 9.5, player: { stats: [] } }
    }
    expect(getAppliedTotal(entry)).toBe(9.5)
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

  it('does not leak owner abbrev when members are missing', () => {
    const matchup = toEspnMatchup({
      payload: fixture,
      cookies: { espn_s2: 'x', SWID: '{11111111-1111-1111-1111-111111111111}' },
      displayWeek: 14
    })
    expect(matchup?.myTeam.owner).toBe('')
    expect(matchup?.starters[0]?.nflTeam).toBe('KC')
  })
})

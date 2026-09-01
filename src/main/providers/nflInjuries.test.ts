import { describe, expect, it } from 'vitest'
import { applyInjuryMap, injuryKey, injuryMapFromPayload } from './nflInjuries'

describe('injuryMapFromPayload', () => {
  it('keys IR players by name and team abbr', () => {
    const map = injuryMapFromPayload({
      injuries: [
        {
          injuries: [
            {
              status: 'Injured Reserve',
              type: { abbreviation: 'IR' },
              athlete: {
                displayName: 'James Conner',
                team: { abbreviation: 'ARI' }
              }
            }
          ]
        }
      ]
    })
    expect(map.get(injuryKey('James Conner', 'ARI'))).toBe('IR')
  })
})

describe('applyInjuryMap', () => {
  it('overlays ESPN status onto matching Sleeper players', () => {
    const players = {
      '1': { name: 'James Conner', position: 'RB', nflTeam: 'ARI' },
      '2': { name: 'Josh Allen', position: 'QB', nflTeam: 'BUF' }
    }
    const injuries = new Map([[injuryKey('James Conner', 'ARI'), 'IR']])
    const next = applyInjuryMap(players, injuries)
    expect(next['1']?.status).toBe('IR')
    expect(next['2']?.status).toBeUndefined()
    expect(players['1']?.status).toBeUndefined()
  })
})

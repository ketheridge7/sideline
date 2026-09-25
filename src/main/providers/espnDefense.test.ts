import { describe, expect, it } from 'vitest'
import { emptyScoreMemory, stabilizeMatchup } from '@shared/scoreStability'
import type { Matchup, Player } from '@shared/types'
import { overlayEspnMatchup } from './espnAdapter'

const player = (id: string, name: string, position: string, points: number): Player => ({
  playerId: id,
  name,
  position,
  nflTeam: 'GB',
  points
})

const entry = (playerId: number, slot: number, points: number, name: string) => ({
  lineupSlotId: slot,
  playerId,
  playerPoolEntry: {
    appliedStatTotal: points,
    player: {
      fullName: name,
      defaultPositionId: slot === 16 ? 16 : slot === 20 ? 2 : 1,
      proTeamId: 9,
      stats: [{ statSourceId: 0, statSplitTypeId: 1, scoringPeriodId: 3, appliedTotal: points }]
    }
  }
})

describe('ESPN defense scoring', () => {
  it('replaces a higher Packers D/ST total with the live negative actual', () => {
    const prev: Matchup = {
      myTeam: { id: '8', name: 'Mine', owner: '', record: '0-0' },
      oppTeam: { id: '3', name: 'Them', owner: '', record: '0-0' },
      myPoints: 4,
      oppPoints: 5,
      starters: [player('100', 'QB', 'QB', 0)],
      bench: [player('4429023', 'Bench RB', 'RB', 4)],
      oppStarters: [player('-16009', 'Packers D/ST', 'D/ST', 5)],
      oppBench: []
    }
    const payload = {
      scoringPeriodId: 3,
      schedule: [
        {
          matchupPeriodId: 3,
          home: {
            teamId: 8,
            rosterForCurrentScoringPeriod: {
              entries: [entry(100, 0, 0, 'QB'), entry(4429023, 20, 4, 'Bench RB')]
            }
          },
          away: {
            teamId: 3,
            rosterForCurrentScoringPeriod: {
              entries: [entry(-16009, 16, -7, 'Packers D/ST')]
            }
          }
        }
      ]
    }
    const overlaid = overlayEspnMatchup(prev, payload, 3, false)
    expect(overlaid?.oppStarters.find((row) => row.playerId === '-16009')?.points).toBe(-7)
    const memory = emptyScoreMemory()
    const shown = stabilizeMatchup(prev, overlaid ?? prev, memory, { week: 3 })
    expect(shown.oppStarters.find((row) => row.playerId === '-16009')?.points).toBe(-7)
  })
})

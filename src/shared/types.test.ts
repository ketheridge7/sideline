import { describe, expect, it } from 'vitest'
import { emptyAppState, toOverlayHud } from './types'
import { layoutFromPreset } from './overlayLayout'
import { mapTransactionKind } from './transactionKind'

describe('toOverlayHud', () => {
  it('carries bench, week, live, toast, and layout', () => {
    const state = emptyAppState()
    state.nfl = {
      week: 3,
      displayWeek: 3,
      season: '2025',
      leagueSeason: '2025',
      seasonType: 'regular'
    }
    state.leagues = [{ id: '1', name: 'Homies', provider: 'sleeper', season: '2025', week: 3 }]
    state.selectedLeagueKey = 'sleeper:1'
    state.pollingLive = true
    state.lastToast = { id: 't1', title: 'Homies · add', body: 'Hurts' }
    state.overlayLayout = layoutFromPreset('minimal')
    state.matchup = {
      myTeam: { id: 'a', name: 'Mine', owner: 'Me', record: '1-0' },
      oppTeam: { id: 'b', name: 'Yours', owner: 'You', record: '0-1' },
      myPoints: 20,
      oppPoints: 18,
      starters: [{ playerId: '1', name: 'Hurts', position: 'QB', nflTeam: 'PHI', points: 12 }],
      bench: [{ playerId: '9', name: 'Bench', position: 'WR', nflTeam: 'DAL' }],
      oppStarters: [{ playerId: '3', name: 'Allen', position: 'QB', nflTeam: 'BUF', points: 18 }],
      oppBench: []
    }
    const hud = toOverlayHud(state)
    expect(hud.week).toBe(3)
    expect(hud.pollingLive).toBe(true)
    expect(hud.myBench.map((row) => row.name)).toEqual(['Bench'])
    expect(hud.oppStarters[0]?.name).toBe('Allen')
    expect(hud.toast?.id).toBe('t1')
    expect(hud.tape).toEqual([])
    expect(hud.layout.presetId).toBe('minimal')
    expect(hud.delta).toBe(2)
  })

  it('fills BYE and empty benches when no matchup', () => {
    const hud = toOverlayHud(emptyAppState())
    expect(hud.oppName).toBe('—')
    expect(hud.myBench).toEqual([])
    expect(hud.tape).toEqual([])
    expect(hud.layout.presetId).toBe('broadcast-l')
  })
})

describe('mapTransactionKind', () => {
  it('maps provider strings onto the closed enum', () => {
    expect(mapTransactionKind('trade', 1, 1)).toBe('trade')
    expect(mapTransactionKind('waiver', 1, 1)).toBe('add_drop')
    expect(mapTransactionKind('free_agent', 1, 0)).toBe('add')
    expect(mapTransactionKind('WAIVER', 0, 1)).toBe('drop')
    expect(mapTransactionKind('commissioner', 0, 0)).toBe('status')
  })
})

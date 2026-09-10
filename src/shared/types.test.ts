import { describe, expect, it } from 'vitest'
import { emptyAppState, overlayHudUnchanged, toOverlayHud } from './types'
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
    expect(hud.nflTicker).toEqual([])
  })

  it('fills BYE and empty benches when no matchup', () => {
    const hud = toOverlayHud(emptyAppState())
    expect(hud.oppName).toBe('—')
    expect(hud.myBench).toEqual([])
    expect(hud.tape).toEqual([])
    expect(hud.layout.presetId).toBe('redzone')
  })

  it('paints overlay scores from a matchup before league discovery returns', () => {
    const state = emptyAppState()
    state.selectedLeagueKey = 'espn:899513'
    state.nfl = {
      week: 1,
      displayWeek: 1,
      season: '2026',
      leagueSeason: '2026',
      seasonType: 'regular'
    }
    state.matchup = {
      myTeam: { id: 'a', name: 'Sideline Squad', owner: 'Me', record: '0-0' },
      oppTeam: { id: 'b', name: 'Rival Club', owner: 'You', record: '0-0' },
      myPoints: 88.4,
      oppPoints: 70.1,
      starters: [{ playerId: '1', name: 'Live QB', position: 'QB', nflTeam: 'KC', points: 12.4 }],
      bench: [],
      oppStarters: [],
      oppBench: []
    }
    const hud = toOverlayHud(state)
    expect(hud.myPoints).toBe(88.4)
    expect(hud.oppPoints).toBe(70.1)
    expect(hud.provider).toBe('espn')
    expect(hud.week).toBe(1)
    expect(hud.myStarters[0]?.name).toBe('Live QB')
  })

  it('follows the selected league when two connected boards exist', () => {
    const state = emptyAppState()
    state.leagues = [
      { id: '1333470459076804608', name: 'Gucci Gang Dynasty', provider: 'sleeper', season: '2026', week: 1 },
      { id: '543268341', name: 'Dawg Pound', provider: 'espn', season: '2026', week: 1 }
    ]
    state.selectedLeagueKey = 'espn:543268341'
    const espnMatchup = {
      myTeam: { id: '1', name: 'Dawg House', owner: 'Kevin', record: '1-0' },
      oppTeam: { id: '2', name: 'Them', owner: 'You', record: '0-1' },
      myPoints: 12.5,
      oppPoints: 9,
      starters: [{ playerId: '1', name: 'Hurts', position: 'QB', nflTeam: 'PHI', points: 12.5 }],
      bench: [],
      oppStarters: [{ playerId: '3', name: 'Allen', position: 'QB', nflTeam: 'BUF', points: 9 }],
      oppBench: []
    }
    state.matchup = espnMatchup
    const hud = toOverlayHud(state)
    expect(hud.leagueName).toBe('Dawg Pound')
    expect(hud.provider).toBe('espn')
    expect(hud.myStarters[0]?.playerId).toBe('1')
    const sleeper = toOverlayHud({
      ...state,
      selectedLeagueKey: 'sleeper:1333470459076804608',
      matchup: {
        ...espnMatchup,
        myTeam: { id: '1', name: 'Gucci Gang', owner: 'ketheridge', record: '1-0' },
        starters: [{ playerId: '4046', name: 'Amon-Ra St. Brown', position: 'WR', nflTeam: 'DET', points: 88.2 }]
      }
    })
    expect(sleeper.leagueName).toBe('Gucci Gang Dynasty')
    expect(sleeper.provider).toBe('sleeper')
    expect(sleeper.myStarters[0]?.playerId).toBe('4046')
  })

  it('forwards the NFL ticker onto the overlay HUD', () => {
    const state = emptyAppState()
    state.nflTicker = [
      { id: '1', away: 'KC', awayScore: 14, home: 'BUF', homeScore: 10, clock: 'Q2 4:12' }
    ]
    expect(toOverlayHud(state).nflTicker).toEqual(state.nflTicker)
  })
})

describe('overlayHudUnchanged', () => {
  it('ignores lastUpdated so rest-board paints do not redraw the overlay', () => {
    const state = emptyAppState()
    state.matchup = {
      myTeam: { id: 'a', name: 'Mine', owner: 'Me', record: '1-0' },
      oppTeam: { id: 'b', name: 'Yours', owner: 'You', record: '0-1' },
      myPoints: 20,
      oppPoints: 18,
      starters: [{ playerId: '1', name: 'Hurts', position: 'QB', nflTeam: 'PHI', points: 12 }],
      bench: [],
      oppStarters: [],
      oppBench: []
    }
    const first = toOverlayHud({ ...state, lastUpdated: 1 })
    const later = toOverlayHud({ ...state, lastUpdated: 2 })
    expect(overlayHudUnchanged(first, later)).toBe(true)
    const matchup = state.matchup
    if (!matchup) throw new Error('expected matchup')
    const scored = toOverlayHud({
      ...state,
      lastUpdated: 3,
      matchup: { ...matchup, myPoints: 21 }
    })
    expect(overlayHudUnchanged(first, scored)).toBe(false)
    const ticked = toOverlayHud({
      ...state,
      lastUpdated: 4,
      matchup: {
        ...matchup,
        starters: [{ playerId: '1', name: 'Hurts', position: 'QB', nflTeam: 'PHI', points: 12, tickDelta: 0.5 }]
      }
    })
    expect(overlayHudUnchanged(first, ticked)).toBe(false)
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

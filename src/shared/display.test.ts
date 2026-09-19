import { describe, expect, it } from 'vitest'
import { applyCompanionHudPatch, boardChanceToWin, espnBoardUx, espnIndicatorHealthy, lastName, liveScorers, matchupChanceToWin, matchupHasLineup, matchupWinPctSource, nflTeamLabel, overlayStartersBelong, sparklinePoints, toMatchupBoard, upsertMatchupBoard, visibleInjury } from './display'
import { emptyAppState, type League, type Matchup } from './types'

const league: League = {
  id: '1',
  name: 'Friday Night Gridiron',
  provider: 'sleeper',
  season: '2025',
  week: 1
}

const matchup: Matchup = {
  myTeam: { id: 'a', name: 'Gibbs Me Head', owner: 'Me', record: '1-0' },
  oppTeam: { id: 'b', name: 'The Other Guys', owner: 'You', record: '0-1' },
  myPoints: 142.8,
  oppPoints: 131.2,
  starters: [
    { playerId: '1', name: 'Jahmyr Gibbs', position: 'RB', nflTeam: 'DET', points: 24.6 },
    { playerId: '2', name: 'Josh Allen', position: 'QB', nflTeam: 'BUF', points: 18.2 }
  ],
  bench: [],
  oppStarters: [{ playerId: '3', name: 'Derrick Henry', position: 'RB', nflTeam: 'BAL', points: 12 }],
  oppBench: []
}

describe('visibleInjury', () => {
  it('hides roster noise and keeps real injury/IR', () => {
    expect(visibleInjury('ACTIVE')).toBeNull()
    expect(visibleInjury('NORMAL')).toBeNull()
    expect(visibleInjury('Injured Reserve')).toBe('IR')
    expect(visibleInjury('injury-reserve')).toBe('IR')
    expect(visibleInjury('OUT')).toBe('OUT')
    expect(visibleInjury('Questionable')).toBe('Q')
    expect(visibleInjury('Doubtful')).toBe('D')
    expect(visibleInjury()).toBeNull()
  })
})

describe('lastName', () => {
  it('keeps DST labels and otherwise uses the last token', () => {
    expect(lastName('Jahmyr Gibbs')).toBe('Gibbs')
    expect(lastName('Eagles D/ST')).toBe('Eagles D/ST')
    expect(lastName('Hurts')).toBe('Hurts')
  })
})

describe('nflTeamLabel', () => {
  it('drops leaked numeric proTeamIds', () => {
    expect(nflTeamLabel('12')).toBe('')
    expect(nflTeamLabel('KC')).toBe('KC')
    expect(nflTeamLabel('')).toBe('')
  })
})

describe('matchupChanceToWin', () => {
  it('mirrors the provider win% field, not score-share or projected finals', () => {
    expect(
      matchupChanceToWin({
        ...matchup,
        myPoints: 0,
        oppPoints: 0,
        myWinPct: 0.5,
        oppWinPct: 0.5
      })?.mine
    ).toBe(0.5)
    expect(
      matchupChanceToWin({
        ...matchup,
        myPoints: 0,
        oppPoints: 0,
        myWinPct: 0.99,
        oppWinPct: 0.01
      })?.mine
    ).toBe(0.99)
    expect(matchupChanceToWin({ ...matchup, myPoints: 80, oppPoints: 40 })).toBeNull()
    expect(
      matchupChanceToWin({
        ...matchup,
        myPoints: 0,
        oppPoints: 0,
        myProjectedPoints: 140,
        oppProjectedPoints: 80
      })
    ).toBeNull()
    expect(matchupWinPctSource(matchup)).toBe('official')
  })

  it('estimates Sleeper win% from projected finals and does not score-share', () => {
    expect(
      matchupChanceToWin({
        ...matchup,
        myPoints: 0,
        oppPoints: 0,
        myProjectedPoints: 140,
        oppProjectedPoints: 80,
        winPctSource: 'estimated'
      })?.mine
    ).toBeGreaterThan(0.9)
    expect(
      matchupChanceToWin({
        ...matchup,
        myPoints: 80,
        oppPoints: 40,
        winPctSource: 'estimated'
      })
    ).toBeNull()
    expect(matchupWinPctSource({ ...matchup, winPctSource: 'estimated' })).toBe('estimated')
  })
})

describe('sparklinePoints', () => {
  it('returns an svg polyline for two or more samples', () => {
    expect(sparklinePoints([1], 40, 12)).toBe('')
    expect(sparklinePoints([1, 2, 3], 40, 12).split(' ')).toHaveLength(3)
  })
})

describe('toMatchupBoard', () => {
  it('packs one card of league meta, scores, and live scorers', () => {
    const board = toMatchupBoard(league, matchup)
    expect(board.key).toBe('sleeper:1')
    expect(board.myPoints).toBe(142.8)
    expect(board.lastScorers.map((row) => row.name)).toEqual([
      'Jahmyr Gibbs',
      'Josh Allen',
      'Derrick Henry'
    ])
    expect(board.lastScorers.every((row) => row.delta == null)).toBe(true)
    expect(liveScorers(null)).toEqual([])
    expect(toMatchupBoard(league, matchup, { refreshing: true }).refreshing).toBe(true)
    expect(toMatchupBoard(league, matchup).refreshing).toBeUndefined()
  })

  it('copies provider win% onto the LEAGUES card for the shared LeadBar', () => {
    const board = toMatchupBoard(league, {
      ...matchup,
      myProjectedPoints: 118.2,
      oppProjectedPoints: 96.4,
      myWinPct: 0.74,
      oppWinPct: 0.26
    })
    expect(board.myProjectedPoints).toBe(118.2)
    expect(board.oppProjectedPoints).toBe(96.4)
    expect(board.myWinPct).toBe(0.74)
    expect(board.oppWinPct).toBe(0.26)
    expect(boardChanceToWin(board)?.mine).toBe(0.74)
    expect(
      boardChanceToWin({
        ...board,
        myWinPct: undefined,
        oppWinPct: undefined
      })
    ).toBeNull()
    const estimated = toMatchupBoard(league, {
      ...matchup,
      myProjectedPoints: 140,
      oppProjectedPoints: 80,
      winPctSource: 'estimated'
    })
    expect(estimated.winPctSource).toBe('estimated')
    expect(boardChanceToWin(estimated)?.mine).toBeGreaterThan(0.9)
  })

  it('labels an ESPN board Sign in when cookies are missing instead of a false bye', () => {
    const espnLeague: League = {
      id: '543268341',
      name: 'Dawg Pound',
      provider: 'espn',
      season: '2026',
      week: 1
    }
    const board = toMatchupBoard(espnLeague, null, { espnNeedsRelogin: true })
    expect(board.myName).toBe('Sign in')
    expect(board.oppName).toBe('Sign in')
    expect(toMatchupBoard(espnLeague, null).oppName).toBeNull()
  })

  it('ranks starters by points, not who just ticked', () => {
    const ticking: Matchup = {
      ...matchup,
      starters: [
        { playerId: '1', name: 'Jahmyr Gibbs', position: 'RB', nflTeam: 'DET', points: 24.6 },
        { playerId: '2', name: 'Josh Allen', position: 'QB', nflTeam: 'BUF', points: 18.2, tickDelta: 6.4 }
      ]
    }
    expect(liveScorers(ticking, 1).map((row) => row.name)).toEqual(['Jahmyr Gibbs'])
    expect(liveScorers(ticking, 1)[0]?.delta).toBeUndefined()
  })

  it('does not let injected last-tick chips override top points on the card', () => {
    const board = toMatchupBoard(league, {
      ...matchup,
      starters: [
        { playerId: '2', name: 'Josh Allen', position: 'QB', nflTeam: 'BUF', points: 18.2, tickDelta: 6.4 },
        { playerId: '1', name: 'Jahmyr Gibbs', position: 'RB', nflTeam: 'DET', points: 24.6 }
      ]
    })
    expect(board.lastScorers.map((row) => row.name)).toEqual([
      'Jahmyr Gibbs',
      'Josh Allen',
      'Derrick Henry'
    ])
  })
})

describe('upsertMatchupBoard', () => {
  it('replaces a board in place and appends an unknown key', () => {
    const first = toMatchupBoard(league, matchup)
    const updated = toMatchupBoard(league, { ...matchup, myPoints: 150 })
    const other = toMatchupBoard({ ...league, id: '2', name: 'Other' }, matchup)
    expect(upsertMatchupBoard([first], updated).map((row) => row.myPoints)).toEqual([150])
    expect(upsertMatchupBoard([first], other).map((row) => row.key)).toEqual(['sleeper:1', 'sleeper:2'])
  })
})

describe('applyCompanionHudPatch', () => {
  it('upserts the selected LEAGUES card from the live matchup without a boards payload', () => {
    const first = toMatchupBoard(league, matchup)
    const other = toMatchupBoard({ ...league, id: '2', name: 'Other' }, matchup)
    const current = {
      ...emptyAppState(),
      leagues: [league, { ...league, id: '2', name: 'Other' }],
      selectedLeagueKey: 'sleeper:1',
      boards: [first, other],
      matchup
    }
    const next = applyCompanionHudPatch(current, {
      matchup: { ...matchup, myPoints: 150.4, oppPoints: 131.2 },
      tape: [],
      nflTicker: [],
      pollingLive: true,
      overlayEditMode: false,
      lastUpdated: 9,
      pollMs: 12,
      liveCallMs: 40
    })
    expect(next.matchup?.myPoints).toBe(150.4)
    expect(next.pollingLive).toBe(true)
    expect(next.boards.map((row) => row.myPoints)).toEqual([150.4, 142.8])
    expect(next.boards[1]?.leagueName).toBe('Other')
  })

  it('does not clone the selected HUD roster onto another provider board', () => {
    const sleeper = toMatchupBoard(league, matchup)
    const espnLeague: League = { id: '543268341', name: 'Dawg Pound', provider: 'espn', season: '2025', week: 1 }
    const espnMatchup: Matchup = {
      ...matchup,
      myTeam: { id: '7', name: 'Dawg House', owner: 'Kevin', record: '1-0' },
      starters: [{ playerId: 'lamar', name: 'Lamar Jackson', position: 'QB', nflTeam: 'BAL', points: 26.8 }]
    }
    const espnBoard = toMatchupBoard(espnLeague, espnMatchup)
    const current = {
      ...emptyAppState(),
      leagues: [league, espnLeague],
      selectedLeagueKey: 'sleeper:1',
      boards: [sleeper, espnBoard],
      matchup: { ...matchup, myPoints: 150.4 }
    }
    const next = applyCompanionHudPatch(current, {
      matchup: { ...matchup, myPoints: 150.4, oppPoints: 131.2 },
      tape: [],
      nflTicker: [],
      pollingLive: true,
      overlayEditMode: false,
      lastUpdated: 9,
      pollMs: 12,
      liveCallMs: 40
    })
    expect(next.boards.find((row) => row.key === 'sleeper:1')?.myPoints).toBe(150.4)
    expect(next.boards.find((row) => row.key === 'espn:543268341')?.myName).toBe('Dawg House')
    expect(next.boards.find((row) => row.key === 'espn:543268341')?.lastScorers[0]?.playerId).toBe('lamar')
  })
})

describe('espnBoardUx', () => {
  const espnMatchup: Matchup = {
    myTeam: { id: '8', name: 'Team Etheridge', owner: 'KE', record: '1-0' },
    oppTeam: { id: '3', name: "Django Achane'd", owner: 'DA', record: '0-1' },
    myPoints: 0,
    oppPoints: 0,
    starters: [],
    bench: [],
    oppStarters: [],
    oppBench: []
  }

  it('signals auth-fail when cookies are missing or the last fetch was 401', () => {
    expect(
      espnBoardUx({
        provider: 'espn',
        espnConnected: false,
        espnNeedsRelogin: true,
        matchup: espnMatchup
      })
    ).toBe('auth-fail')
    expect(
      espnBoardUx({
        provider: 'espn',
        espnConnected: false,
        espnNeedsRelogin: false,
        matchup: espnMatchup
      })
    ).toBe('auth-fail')
    expect(espnIndicatorHealthy({ replay: false, espnConnected: false, espnNeedsRelogin: true })).toBe(false)
  })

  it('signals empty-roster when cookies are valid but the board has names without starters', () => {
    expect(
      espnBoardUx({
        provider: 'espn',
        espnConnected: true,
        espnNeedsRelogin: false,
        matchup: espnMatchup
      })
    ).toBe('empty-roster')
    expect(espnIndicatorHealthy({ replay: false, espnConnected: true, espnNeedsRelogin: false })).toBe(true)
  })

  it('signals healthy-lineup when cookies are valid and starters are named', () => {
    expect(
      espnBoardUx({
        provider: 'espn',
        espnConnected: true,
        espnNeedsRelogin: false,
        matchup: {
          ...espnMatchup,
          starters: [{ playerId: '3139477', name: 'Patrick Mahomes', position: 'QB', nflTeam: 'KC', points: 12 }]
        }
      })
    ).toBe('healthy-lineup')
    expect(
      espnBoardUx({
        provider: 'sleeper',
        espnConnected: false,
        espnNeedsRelogin: false,
        matchup: null
      })
    ).toBe('healthy-lineup')
  })
})

describe('overlayStartersBelong', () => {
  it('keeps same-league overlays and rejects a Sleeper lineup painted with ESPN player ids', () => {
    const prev = [{ playerId: '4046', name: 'Amon-Ra St. Brown', position: 'WR', nflTeam: 'DET' }]
    expect(overlayStartersBelong(prev, ['4046', '6794'])).toBe(true)
    expect(overlayStartersBelong(prev, ['4046'])).toBe(true)
    expect(overlayStartersBelong(prev, ['1', '3'])).toBe(false)
    expect(overlayStartersBelong(prev, [])).toBe(true)
    expect(overlayStartersBelong([], ['4046'])).toBe(false)
    expect(
      overlayStartersBelong(
        [{ playerId: '', name: '', position: '', nflTeam: '' }],
        ['3139477']
      )
    ).toBe(false)
  })

  it('treats blank ESPN starter slots as no lineup', () => {
    expect(
      matchupHasLineup({
        myTeam: { id: '1', name: 'Team Harrison', owner: 'TH', record: '0-0' },
        oppTeam: { id: '2', name: 'KDT', owner: 'KDT', record: '0-0' },
        myPoints: 0,
        oppPoints: 0,
        starters: [
          { playerId: '', name: '', position: '', nflTeam: '' },
          { playerId: '', name: '', position: '', nflTeam: '' }
        ],
        bench: [],
        oppStarters: [],
        oppBench: []
      })
    ).toBe(false)
    expect(
      matchupHasLineup({
        myTeam: { id: '8', name: 'Team Etheridge', owner: 'KE', record: '0-0' },
        oppTeam: { id: '2', name: 'KDT', owner: 'KDT', record: '0-0' },
        myPoints: 12,
        oppPoints: 9,
        starters: [{ playerId: '3139477', name: 'Patrick Mahomes', position: 'QB', nflTeam: 'KC', points: 12 }],
        bench: [],
        oppStarters: [],
        oppBench: []
      })
    ).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { playerProjectedFinal } from './winPct'
import { playerKickoff, shownPlayerPoints } from './playerPoints'
import type { NflTickerGame } from './types'

const game = (away: string, home: string, final = false): NflTickerGame => ({
  id: `${away}-${home}`,
  away,
  awayScore: final ? 24 : 7,
  home,
  homeScore: final ? 17 : 3,
  clock: final ? 'FINAL' : 'Q2 4:12',
  ...(final ? { final: true } : {})
})

const slate = ['DAL', 'NYG', 'GB', 'CHI', 'WAS', 'TEN', 'KC', 'DET']

describe('playerKickoff', () => {
  const ticker = [game('DAL', 'NYG', true), game('KC', 'DET')]

  it('treats a team on the slate and off the ticker as not started', () => {
    expect(playerKickoff('GB', ticker, slate)).toBe('pre')
    expect(playerKickoff('CHI', ticker, slate)).toBe('pre')
    expect(playerKickoff('WSH', ticker, slate)).toBe('pre')
  })

  it('treats a live or final ticker team as started, including a Thursday final', () => {
    expect(playerKickoff('DET', ticker, slate)).toBe('started')
    expect(playerKickoff('DAL', ticker, slate)).toBe('started')
    expect(playerKickoff('NYG', ticker, slate)).toBe('started')
  })

  it('treats a team missing from a full slate as a bye', () => {
    expect(playerKickoff('LV', ticker, slate)).toBe('bye')
  })

  it('does not invent a pregame dash without a slate or a team', () => {
    expect(playerKickoff('GB', ticker, [])).toBe('unknown')
    expect(playerKickoff('GB', ticker, undefined)).toBe('unknown')
    expect(playerKickoff('', ticker, slate)).toBe('unknown')
    expect(playerKickoff('FA', ticker, slate)).toBe('unknown')
    expect(playerKickoff(undefined, ticker, slate)).toBe('unknown')
  })

  it('keeps a postponed game that is still pre on the slate as not started', () => {
    expect(playerKickoff('TEN', ticker, slate)).toBe('pre')
  })
})

describe('shownPlayerPoints', () => {
  it('dashes a stored 0 before kickoff and shows 0.0 once the game has started', () => {
    expect(shownPlayerPoints(0, 'pre')).toBeNull()
    expect(shownPlayerPoints(0, 'started')).toBe(0)
    expect(shownPlayerPoints(undefined, 'started')).toBe(0)
    expect(shownPlayerPoints(13.4, 'started')).toBe(13.4)
    expect(shownPlayerPoints(-2, 'started')).toBe(-2)
  })

  it('leaves a bye on the stored chip, including a dash when no actual was posted', () => {
    expect(shownPlayerPoints(undefined, 'bye')).toBeUndefined()
    expect(shownPlayerPoints(0, 'bye')).toBe(0)
    expect(shownPlayerPoints(4.2, 'bye')).toBe(4.2)
  })

  it('leaves an unknown kickoff on the stored chip', () => {
    expect(shownPlayerPoints(0, 'unknown')).toBe(0)
    expect(shownPlayerPoints(undefined, 'unknown')).toBeUndefined()
  })

  it('does not change the actual a not-started player contributes to Est. win%', () => {
    const actual = 0
    expect(shownPlayerPoints(actual, 'pre')).toBeNull()
    expect(playerProjectedFinal({ actual, projected: 14.2, gameFinal: false })).toBe(14.2)
    expect(playerProjectedFinal({ actual, projected: 14.2, gameFinal: true })).toBe(0)
  })
})

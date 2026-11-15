import { describe, expect, it } from 'vitest'
import { espnTeamAbbr } from '../main/providers/espnAdapter'
import {
  POSSESSION_HOLD_MS,
  ballMarkForPlayer,
  nflBallReadingsFromPayload,
  possessionIsDead,
  stabilizeNflBall,
  type BallReading
} from './possession'
import type { NflBall } from './types'

const teams = (
  away: { id: string; abbr: string },
  home: { id: string; abbr: string }
): Record<string, unknown>[] => [
  { homeAway: 'away', id: away.id, team: { id: away.id, abbreviation: away.abbr } },
  { homeAway: 'home', id: home.id, team: { id: home.id, abbreviation: home.abbr } }
]

const event = (args: {
  id?: string
  state: string
  name?: string
  shortDetail?: string
  possession?: string
  redZone?: boolean
  omitSituation?: boolean
  competitors?: Record<string, unknown>[]
}): Record<string, unknown> => {
  const competition: Record<string, unknown> = {
    competitors: args.competitors ?? teams({ id: '8', abbr: 'DET' }, { id: '12', abbr: 'KC' })
  }
  if (!args.omitSituation) {
    competition.situation = {
      ...(args.possession != null ? { possession: args.possession } : {}),
      ...(args.redZone != null ? { isRedZone: args.redZone } : {}),
      down: 2,
      distance: 7,
      lastPlay: { text: 'Mahomes pass short right' }
    }
  }
  return {
    id: args.id ?? 'live-1',
    status: {
      type: {
        state: args.state,
        ...(args.name ? { name: args.name } : {}),
        ...(args.shortDetail ? { shortDetail: args.shortDetail } : {})
      }
    },
    competitions: [competition]
  }
}

const live = (overrides: Partial<Parameters<typeof event>[0]> = {}): unknown => ({
  events: [event({ state: 'in', shortDetail: 'Q2 4:12', possession: '8', ...overrides })]
})

const ball = (partial: Partial<NflBall> & Pick<NflBall, 'gameId' | 'offense' | 'defense'>): NflBall => ({
  redZone: false,
  seenAt: 0,
  ...partial
})

describe('nflBallReadingsFromPayload', () => {
  it('maps the possessing ESPN team id onto a normalized abbreviation', () => {
    const [reading] = nflBallReadingsFromPayload(live({ possession: '8', redZone: false }))
    expect(reading).toEqual({ gameId: 'live-1', kind: 'live', offense: 'DET', defense: 'KC', redZone: false })
  })

  it('normalizes scoreboard WSH to WAS so ESPN and Sleeper share one key', () => {
    const [reading] = nflBallReadingsFromPayload(
      live({
        possession: '28',
        competitors: teams({ id: '28', abbr: 'WSH' }, { id: '19', abbr: 'NYG' })
      })
    )
    expect(reading).toMatchObject({ kind: 'live', offense: 'WAS', defense: 'NYG' })
  })

  it('accepts an abbreviation when the header-style payload already has one', () => {
    const [reading] = nflBallReadingsFromPayload(
      live({
        possession: 'JAC',
        competitors: teams({ id: '30', abbr: 'JAX' }, { id: '4', abbr: 'CIN' })
      })
    )
    expect(reading).toMatchObject({ kind: 'live', offense: 'JAX', defense: 'CIN' })
  })

  it('reads the header API sports tree and treats a missing situation as a gap', () => {
    const readings = nflBallReadingsFromPayload({
      sports: [
        {
          leagues: [
            {
              events: [
                {
                  id: 'hdr-1',
                  status: 'in',
                  competitors: teams({ id: '14', abbr: 'LAR' }, { id: '25', abbr: 'SF' })
                }
              ]
            }
          ]
        }
      ]
    })
    expect(readings).toEqual([{ gameId: 'hdr-1', kind: 'gap' }])
  })

  it('clears on pre, final, halftime, and the break between quarters even if possession is still set', () => {
    expect(nflBallReadingsFromPayload(live({ state: 'pre', shortDetail: 'Sun 1:00' }))[0]).toMatchObject({
      kind: 'dead'
    })
    expect(nflBallReadingsFromPayload(live({ state: 'post', name: 'STATUS_FINAL', shortDetail: 'Final' }))[0]).toMatchObject({
      kind: 'dead'
    })
    expect(
      nflBallReadingsFromPayload(live({ name: 'STATUS_HALFTIME', shortDetail: 'Halftime', possession: '8' }))[0]
    ).toMatchObject({ kind: 'dead' })
    expect(
      nflBallReadingsFromPayload(live({ name: 'STATUS_END_PERIOD', shortDetail: 'End of 1st', possession: '12' }))[0]
    ).toMatchObject({ kind: 'dead' })
  })

  it('keeps the ball through a timeout and marks the red zone only when ESPN says so', () => {
    const timeout = nflBallReadingsFromPayload(live({ shortDetail: 'Q4 1:12', possession: '12', redZone: false }))[0]
    expect(timeout).toMatchObject({ kind: 'live', offense: 'KC', defense: 'DET', redZone: false })
    const red = nflBallReadingsFromPayload(live({ possession: '12', redZone: true }))[0]
    expect(red).toMatchObject({ kind: 'live', offense: 'KC', redZone: true })
  })

  it('treats a kickoff or punt with no possession token as a gap, not a team switch', () => {
    const kick = nflBallReadingsFromPayload(
      live({ shortDetail: 'Q3 15:00', possession: undefined, omitSituation: true })
    )[0]
    expect(kick).toEqual({ gameId: 'live-1', kind: 'gap' })
    const blank = nflBallReadingsFromPayload(live({ possession: undefined }))[0]
    expect(blank).toMatchObject({ kind: 'gap' })
  })

  it('follows a turnover as soon as the new team id is published', () => {
    const before = nflBallReadingsFromPayload(live({ possession: '8' }))[0]
    const after = nflBallReadingsFromPayload(live({ possession: '12' }))[0]
    expect(before).toMatchObject({ offense: 'DET' })
    expect(after).toMatchObject({ offense: 'KC', defense: 'DET' })
  })
})

describe('possessionIsDead', () => {
  it('leaves a live clock alone', () => {
    expect(possessionIsDead('in', 'STATUS_IN_PROGRESS Q2 4:12')).toBe(false)
    expect(possessionIsDead('in', 'OT 8:04')).toBe(false)
  })
})

describe('stabilizeNflBall', () => {
  const confirmed: NflBall[] = [ball({ gameId: 'live-1', offense: 'DET', defense: 'KC', redZone: true, seenAt: 1_000 })]

  it('holds the last ball, including red zone, through a short gap', () => {
    const gap: BallReading[] = [{ gameId: 'live-1', kind: 'gap' }]
    expect(stabilizeNflBall(confirmed, gap, 1_000 + POSSESSION_HOLD_MS)).toEqual(confirmed)
  })

  it('drops the ball once the gap outlasts the hold', () => {
    const gap: BallReading[] = [{ gameId: 'live-1', kind: 'gap' }]
    expect(stabilizeNflBall(confirmed, gap, 1_000 + POSSESSION_HOLD_MS + 1)).toEqual([])
  })

  it('clears immediately on halftime, between quarters, and final', () => {
    expect(stabilizeNflBall(confirmed, [{ gameId: 'live-1', kind: 'dead' }], 1_001)).toEqual([])
  })

  it('replaces the team as soon as a new live reading arrives', () => {
    const next = stabilizeNflBall(
      confirmed,
      [{ gameId: 'live-1', kind: 'live', offense: 'KC', defense: 'DET', redZone: false }],
      5_000
    )
    expect(next).toEqual([ball({ gameId: 'live-1', offense: 'KC', defense: 'DET', redZone: false, seenAt: 5_000 })])
  })

  it('does not keep a game that left the scoreboard', () => {
    expect(stabilizeNflBall(confirmed, [], 1_100)).toEqual([])
  })
})

describe('ballMarkForPlayer', () => {
  const balls: NflBall[] = [
    ball({ gameId: 'jax-cin', offense: 'JAX', defense: 'CIN', redZone: false }),
    ball({ gameId: 'det-kc', offense: 'DET', defense: 'KC', redZone: true }),
    ball({ gameId: 'was-nyg', offense: 'WAS', defense: 'NYG', redZone: false })
  ]

  it('marks ESPN and Sleeper skill players, kickers, and slot labels on the offense', () => {
    expect(espnTeamAbbr(30)).toBe('JAX')
    expect(ballMarkForPlayer({ position: 'QB', nflTeam: espnTeamAbbr(30) }, balls)).toBe('ball')
    expect(ballMarkForPlayer({ position: 'WR', nflTeam: 'JAC' }, balls)).toBe('ball')
    expect(ballMarkForPlayer({ position: 'K', nflTeam: 'JAX' }, balls)).toBe('ball')
    expect(ballMarkForPlayer({ position: 'FLEX', nflTeam: 'DET' }, balls)).toBe('redzone')
    expect(ballMarkForPlayer({ position: 'RB', nflTeam: 'DET' }, balls)).toBe('redzone')
    expect(ballMarkForPlayer({ position: 'WR', nflTeam: 'WSH' }, balls)).toBe('ball')
    expect(ballMarkForPlayer({ position: 'TE', nflTeam: 'WAS' }, balls)).toBe('ball')
    expect(ballMarkForPlayer({ position: 'WR', nflTeam: 'LA' }, balls)).toBeNull()
  })

  it('marks D/ST on defense, including the red zone, and not when that team has the ball', () => {
    expect(ballMarkForPlayer({ position: 'D/ST', nflTeam: 'KC' }, balls)).toBe('redzone')
    expect(ballMarkForPlayer({ position: 'DEF', nflTeam: 'CIN' }, balls)).toBe('ball')
    expect(ballMarkForPlayer({ position: 'LB', nflTeam: 'NYG' }, balls)).toBe('ball')
    expect(ballMarkForPlayer({ position: 'D/ST', nflTeam: 'DET' }, balls)).toBeNull()
    expect(ballMarkForPlayer({ position: 'DEF', nflTeam: 'JAX' }, balls)).toBeNull()
  })

  it('stays dark for the defense of the team with the ball, kickers on the other side, and non-playing teams', () => {
    expect(ballMarkForPlayer({ position: 'QB', nflTeam: 'KC' }, balls)).toBeNull()
    expect(ballMarkForPlayer({ position: 'K', nflTeam: 'NYG' }, balls)).toBeNull()
    expect(ballMarkForPlayer({ position: 'QB', nflTeam: 'PIT' }, balls)).toBeNull()
    expect(ballMarkForPlayer({ position: 'P', nflTeam: 'DET' }, balls)).toBeNull()
    expect(ballMarkForPlayer({ position: 'HC', nflTeam: 'DET' }, balls)).toBeNull()
    expect(ballMarkForPlayer({ position: 'QB', nflTeam: '' }, balls)).toBeNull()
    expect(ballMarkForPlayer({ position: 'QB', nflTeam: 'DET' }, [])).toBeNull()
  })
})

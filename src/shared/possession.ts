import type { NflBall } from './types'
import { nflTeamKey } from './winPct'

/**
 * How long a live game may omit `situation.possession` before the mark clears.
 * The scoreboard cache refreshes about every 10s while games are in progress,
 * so this covers a few blank polls (kickoff, punt, timeout) without keeping a
 * halftime or final reading around.
 */
export const POSSESSION_HOLD_MS = 45_000

export type BallReading =
  | { gameId: string; kind: 'dead' }
  | { gameId: string; kind: 'gap' }
  | { gameId: string; kind: 'live'; offense: string; defense: string; redZone: boolean }

/** What a roster row should draw. Null means no mark. */
export type BallMark = 'ball' | 'redzone'

const OFFENSE_POSITIONS = new Set([
  'QB',
  'RB',
  'WR',
  'TE',
  'FB',
  'K',
  'PK',
  'FLEX',
  'OP',
  'TQB',
  'RB/WR',
  'WR/TE',
  'WR/RB',
  'TE/WR',
  'RB/WR/TE',
  'W/R',
  'W/T',
  'Q/W/R/T',
  'ER'
])

/** Team defense and IDP slots. They are on the field when the other team has the ball. */
const DEFENSE_POSITIONS = new Set([
  'D/ST',
  'DST',
  'DEF',
  'D',
  'DP',
  'LB',
  'DB',
  'DL',
  'DE',
  'DT',
  'CB',
  'S',
  'IDP'
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const str = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim() !== '') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

const eventState = (event: Record<string, unknown>): string | undefined => {
  const status = event.status
  if (typeof status === 'string') return status
  if (!isRecord(status)) {
    const full = event.fullStatus
    if (!isRecord(full)) return undefined
    const type = isRecord(full.type) ? full.type : null
    const state = type?.state ?? full.state
    return typeof state === 'string' ? state : undefined
  }
  const type = isRecord(status.type) ? status.type : null
  const state = type?.state ?? status.state
  return typeof state === 'string' ? state : undefined
}

const collectEvents = (payload: unknown): Record<string, unknown>[] => {
  if (!isRecord(payload)) return []
  if (Array.isArray(payload.events)) return payload.events.filter(isRecord)
  const sports = Array.isArray(payload.sports) ? payload.sports : []
  const events: Record<string, unknown>[] = []
  for (const sport of sports) {
    if (!isRecord(sport)) continue
    for (const league of Array.isArray(sport.leagues) ? sport.leagues : []) {
      if (!isRecord(league)) continue
      for (const event of Array.isArray(league.events) ? league.events : []) {
        if (isRecord(event)) events.push(event)
      }
    }
  }
  return events
}

const statusText = (event: Record<string, unknown>): string => {
  const chunks: string[] = []
  const push = (value: unknown): void => {
    const text = str(value)
    if (text) chunks.push(text)
  }
  const status = isRecord(event.status) ? event.status : isRecord(event.fullStatus) ? event.fullStatus : null
  if (status) {
    const type = isRecord(status.type) ? status.type : null
    push(type?.name)
    push(type?.description)
    push(type?.detail)
    push(type?.shortDetail)
    push(status.detail)
    push(status.shortDetail)
  }
  push(event.summary)
  push(event.note)
  return chunks.join(' ')
}

/** Halftime, the break between quarters, and delays are not "on offense". */
export const possessionIsDead = (state: string | undefined, detail: string): boolean => {
  if (state !== 'in') return true
  if (/HALFTIME|END_PERIOD|DELAY|POSTPON|CANCEL|SUSPEND|RAIN_DELAY/i.test(detail)) return true
  if (/\bhalftime\b/i.test(detail)) return true
  if (/\bend of\b/i.test(detail)) return true
  if (/\bdelayed\b/i.test(detail)) return true
  if (/\brain delay\b/i.test(detail)) return true
  if (/\bsuspended\b/i.test(detail)) return true
  if (/\bpostponed\b/i.test(detail)) return true
  return false
}

const competitorsOf = (event: Record<string, unknown>): Record<string, unknown>[] => {
  if (Array.isArray(event.competitors)) return event.competitors.filter(isRecord)
  const competitions = Array.isArray(event.competitions) ? event.competitions : []
  const first = competitions.find(isRecord)
  if (first && Array.isArray(first.competitors)) return first.competitors.filter(isRecord)
  return []
}

const situationOf = (event: Record<string, unknown>): Record<string, unknown> | null => {
  const competitions = Array.isArray(event.competitions) ? event.competitions : []
  const first = competitions.find(isRecord)
  if (first && isRecord(first.situation)) return first.situation
  if (isRecord(event.situation)) return event.situation
  return null
}

const teamIds = (row: Record<string, unknown>): string[] => {
  const team = isRecord(row.team) ? row.team : null
  const ids = [str(team?.id), str(row.id)]
  return ids.filter((id): id is string => Boolean(id))
}

const teamAbbr = (row: Record<string, unknown>): string => {
  const direct = str(row.abbreviation)
  const team = isRecord(row.team) ? row.team : null
  return nflTeamKey(direct || str(team?.abbreviation) || str(team?.shortDisplayName) || '')
}

const redZoneOf = (situation: Record<string, unknown>): boolean =>
  situation.isRedZone === true || situation.isRedZone === 'true'

const readingFor = (event: Record<string, unknown>): BallReading | null => {
  const gameId = str(event.id)
  if (!gameId) return null
  const detail = statusText(event)
  if (possessionIsDead(eventState(event), detail)) return { gameId, kind: 'dead' }
  const situation = situationOf(event)
  const token = situation ? str(situation.possession) : undefined
  if (!situation || !token) return { gameId, kind: 'gap' }
  const competitors = competitorsOf(event)
  const byId = /^\d+$/.test(token) ? competitors.find((row) => teamIds(row).includes(token)) : undefined
  const abbrKey = nflTeamKey(token)
  const byAbbr = byId ?? competitors.find((row) => teamAbbr(row) === abbrKey)
  const offense = byAbbr ? teamAbbr(byAbbr) : ''
  if (!offense) return { gameId, kind: 'gap' }
  const defense = competitors.map(teamAbbr).find((abbr) => abbr && abbr !== offense) ?? ''
  return {
    gameId,
    kind: 'live',
    offense,
    defense,
    redZone: redZoneOf(situation)
  }
}

/**
 * One reading per scoreboard event.
 * `live` is a team with the ball. `dead` is pre, final, halftime, or between quarters
 * and clears immediately. `gap` is still in progress but ESPN omitted possession.
 */
export const nflBallReadingsFromPayload = (payload: unknown): BallReading[] => {
  const out: BallReading[] = []
  for (const event of collectEvents(payload)) {
    const reading = readingFor(event)
    if (reading) out.push(reading)
  }
  return out
}

/** Keep the last confirmed ball through a short gap. Drop it on a dead ball or when the game leaves the slate. */
export const stabilizeNflBall = (
  previous: readonly NflBall[],
  readings: readonly BallReading[],
  now: number
): NflBall[] => {
  const prior = new Map(previous.map((row) => [row.gameId, row]))
  const out: NflBall[] = []
  for (const reading of readings) {
    switch (reading.kind) {
      case 'dead':
        break
      case 'live':
        out.push({
          gameId: reading.gameId,
          offense: reading.offense,
          defense: reading.defense,
          redZone: reading.redZone,
          seenAt: now
        })
        break
      case 'gap': {
        const held = prior.get(reading.gameId)
        if (held && now - held.seenAt <= POSSESSION_HOLD_MS) out.push(held)
        break
      }
      default: {
        const _never: never = reading
        void _never
      }
    }
  }
  return out
}

/**
 * Skill players and kickers light up when their NFL team has the ball.
 * D/ST and IDP light up when the other team has it.
 * ESPN slot labels (FLEX, D/ST) and Sleeper labels (DEF, JAX/WAS) both go through here.
 */
export const ballMarkForPlayer = (
  player: { position?: string; nflTeam?: string },
  balls: readonly NflBall[]
): BallMark | null => {
  const team = nflTeamKey(player.nflTeam)
  if (!team) return null
  const position = (player.position ?? '').trim().toUpperCase()
  if (OFFENSE_POSITIONS.has(position)) {
    const row = balls.find((ball) => ball.offense === team)
    if (!row) return null
    return row.redZone ? 'redzone' : 'ball'
  }
  if (DEFENSE_POSITIONS.has(position)) {
    const row = balls.find((ball) => ball.defense === team)
    if (!row) return null
    return row.redZone ? 'redzone' : 'ball'
  }
  return null
}

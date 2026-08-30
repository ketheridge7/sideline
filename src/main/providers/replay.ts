import { app } from 'electron'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { League, Matchup, NflState, Transaction } from '@shared/types'
import type { CachedPlayer, SleeperLeague, SleeperLeagueUser, SleeperMatchup, SleeperNflState, SleeperRoster, SleeperTransaction, SleeperUser } from './sleeperClient'
import { toEspnMatchup, toEspnTransactions, toEspnLeague } from './espnAdapter'
import { toLeagues, toMatchup, toNflState, toTransactions } from './sleeperAdapter'

export const isReplayMode = (): boolean => process.env.SIDELINE_REPLAY === '1'

type ReplayBundle = {
  nfl: SleeperNflState
  sleeperUser: SleeperUser
  sleeperLeagues: SleeperLeague[]
  sleeperRosters: SleeperRoster[]
  sleeperUsers: SleeperLeagueUser[]
  sleeperMatchups: SleeperMatchup[]
  sleeperTransactions: SleeperTransaction[]
  sleeperPlayers: Record<string, CachedPlayer>
  espnLeague: unknown
  espnTransactions: unknown
}

let bundle: ReplayBundle | null = null
let tick = 0

const fixturesDir = (): string => {
  if (app.isPackaged) return join(process.resourcesPath, 'fixtures')
  return join(process.cwd(), 'fixtures')
}

const readJson = <T>(name: string): T => {
  return JSON.parse(readFileSync(join(fixturesDir(), name), 'utf8')) as T
}

export const loadReplayBundle = (): ReplayBundle => {
  if (bundle) return bundle
  bundle = {
    nfl: readJson('nfl-state.json'),
    sleeperUser: readJson('sleeper-user.json'),
    sleeperLeagues: readJson('sleeper-leagues.json'),
    sleeperRosters: readJson('sleeper-rosters.json'),
    sleeperUsers: readJson('sleeper-users.json'),
    sleeperMatchups: readJson('sleeper-matchups.json'),
    sleeperTransactions: readJson('sleeper-transactions.json'),
    sleeperPlayers: readJson('sleeper-players.json'),
    espnLeague: readJson('espn-league.json'),
    espnTransactions: readJson('espn-transactions.json')
  }
  return bundle
}

const bump = (value: number): number => {
  const extra = Math.min(tick * 0.35, 18) + (tick % 3) * 0.15
  return Math.round((value + extra) * 100) / 100
}

export const replayNfl = (): NflState => {
  const raw = { ...loadReplayBundle().nfl, season_type: 'regular' }
  return toNflState(raw)
}

export const replaySleeperLeagues = (nfl: NflState): League[] => {
  return toLeagues(loadReplayBundle().sleeperLeagues, nfl.leagueSeason, nfl.displayWeek)
}

export const replaySleeperMatchup = (): Matchup | null => {
  const data = loadReplayBundle()
  tick += 1
  const matchups = data.sleeperMatchups.map((row) => ({
    ...row,
    points: bump(row.points ?? 0),
    custom_points: null
  }))
  return toMatchup({
    userId: data.sleeperUser.user_id,
    rosters: data.sleeperRosters,
    users: data.sleeperUsers,
    matchups,
    players: data.sleeperPlayers
  })
}

export const replaySleeperTransactions = (): Transaction[] => {
  const data = loadReplayBundle()
  return toTransactions(data.sleeperTransactions, data.sleeperPlayers)
}

export const replayEspnLeague = (nfl: NflState): League => {
  const data = loadReplayBundle()
  return toEspnLeague({
    leagueId: '90664721',
    payload: data.espnLeague,
    leagueSeason: nfl.leagueSeason,
    displayWeek: nfl.displayWeek
  })
}

export const replayEspnMatchup = (): Matchup | null => {
  const data = loadReplayBundle()
  tick += 1
  const payload = JSON.parse(JSON.stringify(data.espnLeague)) as {
    schedule?: Array<{ home?: { totalPointsLive?: number }; away?: { totalPointsLive?: number } }>
  }
  const game = payload.schedule?.[0]
  if (game?.home) game.home.totalPointsLive = bump(game.home.totalPointsLive ?? 0)
  if (game?.away) game.away.totalPointsLive = bump(game.away.totalPointsLive ?? 0)
  return toEspnMatchup({
    payload,
    cookies: { espn_s2: 'replay', SWID: '{11111111-1111-1111-1111-111111111111}' },
    displayWeek: 14
  })
}

export const replayEspnTransactions = (): Transaction[] => {
  return toEspnTransactions(loadReplayBundle().espnTransactions)
}

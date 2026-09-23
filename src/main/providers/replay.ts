import type { League, Matchup, NflState, NflTickerGame, TapeEvent, Transaction } from '@shared/types'
import { demoRequested } from '../demoMode'
import {
  FEATURED_LEAGUE_KEY,
  REPLAY_SEASON,
  REPLAY_WEEK,
  replayBoardExtra,
  replayMatchupFor,
  replaySeedTape as seedTape,
  replayTickerGames,
  replayTransactionsFor,
  replayWorldLeagues
} from './replayWorld'

export { FEATURED_LEAGUE_KEY }

export const isReplayMode = (): boolean => demoRequested(process.env, process.argv)

let tick = 0

export const replayTickCount = (): number => tick

export const bumpReplayTick = (): number => {
  tick += 1
  return tick
}

export const resetReplayTick = (): void => {
  tick = 0
}

export const replayNfl = (): NflState => ({
  week: REPLAY_WEEK,
  displayWeek: REPLAY_WEEK,
  season: REPLAY_SEASON,
  leagueSeason: REPLAY_SEASON,
  seasonType: 'regular'
})

export const replaySleeperLeagues = (nfl: NflState): League[] =>
  replayWorldLeagues(nfl.displayWeek).filter((row) => row.provider === 'sleeper')

export const replayEspnLeagues = (nfl: NflState): League[] =>
  replayWorldLeagues(nfl.displayWeek).filter((row) => row.provider === 'espn')

export const replayEspnLeague = (nfl: NflState): League => replayEspnLeagues(nfl)[0]

export const replayMatchup = (league: League): Matchup | null => replayMatchupFor(league, tick)

export const replaySleeperMatchup = (league?: League): Matchup | null => {
  const row = league ?? replaySleeperLeagues(replayNfl())[0]
  if (!row) return null
  return replayMatchupFor(row, tick)
}

export const replayEspnMatchup = (league?: League): Matchup | null => {
  const row = league ?? replayEspnLeagues(replayNfl())[0]
  if (!row) return null
  return replayMatchupFor(row, tick)
}

export const replaySleeperTransactions = (league?: League): Transaction[] => {
  const row = league ?? replaySleeperLeagues(replayNfl())[0]
  if (!row) return []
  return replayTransactionsFor(row, tick)
}

export const replayEspnTransactions = (league?: League): Transaction[] => {
  const row = league ?? replayEspnLeagues(replayNfl())[0]
  if (!row) return []
  return replayTransactionsFor(row, tick)
}

export const replayTransactions = (league: League): Transaction[] => replayTransactionsFor(league, tick)

export const replayNflTicker = (): NflTickerGame[] => replayTickerGames(tick)

export const replaySeedTape = (): TapeEvent[] => seedTape()

export const replayBoardMeta = (league: League) => replayBoardExtra(league, tick)

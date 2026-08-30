export type CachedPlayer = {
  name: string
  position: string
  nflTeam: string
  status?: string
}

export type SleeperUser = {
  user_id: string
  username?: string
  display_name?: string
}

export type SleeperNflState = {
  week: number
  display_week: number
  season: string
  league_season: string
  season_type: string
}

export type SleeperLeague = {
  league_id: string
  name: string
  season: string
}

export type SleeperRoster = {
  roster_id: number
  owner_id: string | null
  co_owners?: string[] | null
  players?: string[] | null
  starters?: string[] | null
  settings?: {
    wins?: number
    losses?: number
    ties?: number
  }
}

export type SleeperLeagueUser = {
  user_id: string
  display_name?: string
  metadata?: {
    team_name?: string
  } | null
}

export type SleeperMatchup = {
  roster_id: number
  matchup_id: number | null
  points?: number
  custom_points?: number | null
  starters?: string[]
  players?: string[]
  players_points?: Record<string, number>
  starters_points?: number[]
}

export type SleeperTransaction = {
  transaction_id: string
  type: string
  status?: string
  status_updated?: number
  created?: number
  adds?: Record<string, number> | null
  drops?: Record<string, number> | null
}

const BASE = 'https://api.sleeper.app/v1'

const getJson = async <T>(path: string): Promise<T> => {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    throw new Error(`Sleeper ${path} failed (${res.status})`)
  }
  return (await res.json()) as T
}

export const getNflState = (): Promise<SleeperNflState> => getJson('/state/nfl')

export const getUser = (username: string): Promise<SleeperUser> =>
  getJson(`/user/${encodeURIComponent(username)}`)

export const getUserLeagues = (userId: string, season: string): Promise<SleeperLeague[]> =>
  getJson(`/user/${encodeURIComponent(userId)}/leagues/nfl/${encodeURIComponent(season)}`)

export const getLeague = (leagueId: string): Promise<SleeperLeague> =>
  getJson(`/league/${encodeURIComponent(leagueId)}`)

export const getRosters = (leagueId: string): Promise<SleeperRoster[]> =>
  getJson(`/league/${encodeURIComponent(leagueId)}/rosters`)

export const getLeagueUsers = (leagueId: string): Promise<SleeperLeagueUser[]> =>
  getJson(`/league/${encodeURIComponent(leagueId)}/users`)

export const getMatchups = (leagueId: string, week: number): Promise<SleeperMatchup[]> =>
  getJson(`/league/${encodeURIComponent(leagueId)}/matchups/${week}`)

export const getTransactions = (leagueId: string, week: number): Promise<SleeperTransaction[]> =>
  getJson(`/league/${encodeURIComponent(leagueId)}/transactions/${week}`)

export const getPlayersNfl = (): Promise<Record<string, unknown>> => getJson('/players/nfl')

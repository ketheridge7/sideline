import type { NflTickerGame } from './types'
import { nflTeamKey } from './winPct'

/**
 * Whether this player's NFL game has kicked off, from the scoreboard Sideline
 * already polls. The ticker lists games that are live or final. The slate lists
 * every team with a game this week, including ones still in `pre`.
 */
export type PlayerKickoff = 'pre' | 'started' | 'bye' | 'unknown'

export const playerKickoff = (
  nflTeam: string | undefined,
  games: readonly NflTickerGame[] | undefined,
  slate: readonly string[] | undefined
): PlayerKickoff => {
  const key = nflTeamKey(nflTeam)
  if (!key || key === 'FA') return 'unknown'
  const started = (games ?? []).some((game) => nflTeamKey(game.home) === key || nflTeamKey(game.away) === key)
  if (started) return 'started'
  if (!slate || slate.length === 0) return 'unknown'
  const scheduled = new Set(slate.map((team) => nflTeamKey(team)).filter((team) => team !== ''))
  return scheduled.has(key) ? 'pre' : 'bye'
}

/**
 * Points chip for one player. The stored `points` stay on the matchup, so a
 * team total and Est. win% still count a not-started player as 0.
 *
 * `pre` is a dash even when the provider stored 0.
 * `started` is the number, including 0.0. A missing actual becomes 0.0.
 * `bye` and `unknown` keep the stored value: a missing score stays a dash,
 * and a stored 0 stays 0.0 when kickoff state is not reliable.
 */
export const shownPlayerPoints = (
  points: number | null | undefined,
  kickoff: PlayerKickoff
): number | null | undefined => {
  switch (kickoff) {
    case 'pre':
      return null
    case 'started':
      return typeof points === 'number' && Number.isFinite(points) ? points : 0
    case 'bye':
    case 'unknown':
      return points
    default: {
      const _never: never = kickoff
      return _never
    }
  }
}

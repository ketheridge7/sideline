import { createContext, useContext, type JSX, type ReactNode } from 'react'
import { ballMarkForPlayer, type BallMark } from '@shared/possession'
import { playerKickoff, shownPlayerPoints } from '@shared/playerPoints'
import type { NflBall, NflTickerGame } from '@shared/types'

export type PlayerGameState = {
  games: readonly NflTickerGame[]
  slate: readonly string[]
  ball: readonly NflBall[]
  marks: boolean
}

const EMPTY_GAME: PlayerGameState = { games: [], slate: [], ball: [], marks: true }

const PlayerGameContext = createContext<PlayerGameState>(EMPTY_GAME)

export const PlayerGameProvider = ({
  games,
  slate,
  ball = [],
  marks = true,
  children
}: {
  games: readonly NflTickerGame[]
  slate: readonly string[]
  ball?: readonly NflBall[]
  marks?: boolean
  children: ReactNode
}): JSX.Element => (
  <PlayerGameContext.Provider value={{ games, slate, ball, marks }}>{children}</PlayerGameContext.Provider>
)

/** Chip value for one player. Empty context keeps the stored points. */
export const useShownPlayerPoints = (
  nflTeam: string | undefined,
  points: number | null | undefined
): number | null | undefined => {
  const { games, slate } = useContext(PlayerGameContext)
  return shownPlayerPoints(points, playerKickoff(nflTeam, games, slate))
}

/** Leather football when this player's NFL team is on the field right now. */
export const useBallMark = (player: { position?: string; nflTeam?: string } | undefined): BallMark | null => {
  const { ball, marks } = useContext(PlayerGameContext)
  if (!marks || !player) return null
  return ballMarkForPlayer(player, ball)
}

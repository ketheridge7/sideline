import { createContext, useContext, type JSX, type ReactNode } from 'react'
import { playerKickoff, shownPlayerPoints } from '@shared/playerPoints'
import type { NflTickerGame } from '@shared/types'

export type PlayerGameState = {
  games: readonly NflTickerGame[]
  slate: readonly string[]
}

const EMPTY_GAME: PlayerGameState = { games: [], slate: [] }

const PlayerGameContext = createContext<PlayerGameState>(EMPTY_GAME)

export const PlayerGameProvider = ({
  games,
  slate,
  children
}: {
  games: readonly NflTickerGame[]
  slate: readonly string[]
  children: ReactNode
}): JSX.Element => <PlayerGameContext.Provider value={{ games, slate }}>{children}</PlayerGameContext.Provider>

/** Chip value for one player. Empty context keeps the stored points. */
export const useShownPlayerPoints = (
  nflTeam: string | undefined,
  points: number | null | undefined
): number | null | undefined => {
  const { games, slate } = useContext(PlayerGameContext)
  return shownPlayerPoints(points, playerKickoff(nflTeam, games, slate))
}

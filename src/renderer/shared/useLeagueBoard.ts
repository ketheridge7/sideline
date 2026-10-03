import { useEffect, useState } from 'react'
import type { LeagueBoardSnapshot } from '@shared/types'

/** League-wide snapshot. Kept off useSideline so it cannot merge into the HUD matchup. */
export const useLeagueBoard = (): LeagueBoardSnapshot | null => {
  const [board, setBoard] = useState<LeagueBoardSnapshot | null>(null)

  useEffect(() => {
    if (!window.sideline) return
    return window.sideline.onLeagueBoard(setBoard)
  }, [])

  return board
}

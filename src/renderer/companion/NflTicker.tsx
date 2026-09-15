import type { JSX } from 'react'
import type { NflTickerGame } from '@shared/types'

export const NflTicker = ({
  games,
  variant = 'companion'
}: {
  games: NflTickerGame[]
  variant?: 'companion' | 'overlay'
}): JSX.Element | null => {
  if (games.length === 0) return null
  const loop = [...games, ...games]
  let shell: string
  switch (variant) {
    case 'overlay':
      shell = 'flex h-8 shrink-0 items-center gap-3 overflow-hidden bg-black/55 px-3'
      break
    case 'companion':
      shell = 'flex h-9 shrink-0 items-center gap-3 overflow-hidden border-t border-line bg-bg px-3'
      break
    default: {
      const _never: never = variant
      shell = _never
    }
  }
  return (
    <div className={shell} data-nfl-ticker="on-air">
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="tape-crawl gap-8 pr-8 font-cond text-sm font-bold uppercase tracking-wide">
          {loop.map((game, index) => (
            <span key={`${game.id}:${index}`} className="shrink-0 tabular-nums">
              {game.away} {game.awayScore} {game.home} {game.homeScore}{' '}
              <span className={game.final ? 'text-air' : 'text-muted'}>{game.clock}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

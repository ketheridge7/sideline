import type { JSX } from 'react'
import type { NflTickerGame } from '@shared/types'

export const NflTicker = ({ games }: { games: NflTickerGame[] }): JSX.Element | null => {
  if (games.length === 0) return null
  const loop = [...games, ...games]
  return (
    <div
      className="flex h-9 shrink-0 items-center gap-3 overflow-hidden border-t border-line bg-bg px-3"
      data-nfl-ticker="on-air"
    >
      <span className="flex shrink-0 items-center gap-1.5 font-cond text-[11px] font-extrabold uppercase tracking-[0.18em] text-air">
        <span className="live-dot inline-block h-1.5 w-1.5 bg-air" aria-hidden="true" />
        On air
      </span>
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

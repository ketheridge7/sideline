import { useMemo, type JSX } from 'react'
import type { AppState } from '@shared/types'
import { formatDelta, formatScore } from '../shared/format'
import { ProviderBadge } from '../shared/ProviderBadge'
import { Sparkline } from '../shared/Sparkline'
import { Settings2 } from 'lucide-react'

const api = (): NonNullable<Window['sideline']> => {
  if (!window.sideline) throw new Error('Sideline preload missing')
  return window.sideline
}

export const Watchlist = ({
  state,
  history,
  onBoards
}: {
  state: AppState
  history: Record<string, number[]>
  onBoards: () => void
}): JSX.Element => {
  const channels = useMemo(() => {
    const pinned = new Set(state.pinnedLeagueKeys)
    const boards = pinned.size > 0 ? state.boards.filter((row) => pinned.has(row.key)) : state.boards
    return boards
  }, [state.boards, state.pinnedLeagueKeys])

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-card">
      <div className="border-b border-line px-3 py-2 font-cond text-[11px] font-bold uppercase tracking-[0.2em] text-muted">
        My leagues
      </div>
      <div className="min-h-0 flex-1 overflow-auto" role="tablist">
        {channels.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted">Pin a Sunday board, then it lands here.</p>
        ) : (
          channels.map((board) => {
            const selected = state.selectedLeagueKey === board.key
            const delta = Math.round((board.myPoints - board.oppPoints) * 100) / 100
            const spark = history[board.key] ?? []
            return (
              <button
                key={board.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => void api().selectLeague(board.key)}
                className={`relative flex w-full cursor-pointer flex-col gap-0.5 border-b border-line px-3 py-2.5 text-left ${
                  selected ? 'bg-bg' : 'opacity-60 hover:opacity-100'
                }`}
              >
                {selected ? (
                  <span className="absolute inset-y-0 left-0 w-0.5 bg-you" aria-hidden="true" />
                ) : null}
                <div className="flex items-center gap-1.5">
                  <ProviderBadge provider={board.provider} stamp />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{board.leagueName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-cond text-sm font-bold tabular-nums">
                    {formatScore(board.myPoints)}
                    <span className="mx-1 text-[10px] font-medium text-muted">vs</span>
                    {formatScore(board.oppPoints)}
                  </span>
                  <Sparkline values={spark} positive={delta >= 0} />
                  <span
                    className={`ml-auto font-cond text-xs font-bold tabular-nums ${
                      delta > 0 ? 'text-lime' : delta < 0 ? 'text-air' : 'text-muted'
                    }`}
                  >
                    {formatDelta(delta)}
                  </span>
                </div>
              </button>
            )
          })
        )}
      </div>
      <button
        type="button"
        onClick={onBoards}
        className="flex cursor-pointer items-center gap-2 border-t border-line px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-muted hover:text-text"
      >
        <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
        Manage leagues
      </button>
    </aside>
  )
}

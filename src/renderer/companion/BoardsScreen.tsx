import type { JSX } from 'react'
import { Pin, Users } from 'lucide-react'
import { parseLeagueKey, type AppState, type MatchupBoard } from '@shared/types'
import { boardChanceToWin, matchupWinPctSource } from '@shared/display'
import { formatScore, overlayName } from '../shared/format'
import { LeadBar } from '../shared/LeadBar'
import { ProviderBadge } from '../shared/ProviderBadge'
import { LiveScoringRail } from './LiveScoringRail'

const api = (): NonNullable<Window['sideline']> => {
  if (!window.sideline) throw new Error('Sideline preload missing')
  return window.sideline
}

const BoardCard = ({
  board,
  selected,
  pinned,
  onOpen,
  onPin,
  onRemove
}: {
  board: MatchupBoard
  selected: boolean
  pinned: boolean
  onOpen: () => void
  onPin: () => void
  onRemove?: () => void
}): JSX.Element => {
  const leadMine = board.myPoints >= board.oppPoints
  return (
    <article
      className={`flex flex-col border bg-card p-4 ${selected ? 'border-you' : 'border-line'}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <ProviderBadge provider={board.provider} stamp />
        <span className="min-w-0 flex-1 truncate font-cond text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
          {board.leagueName}
        </span>
        {board.size ? (
          <span className="flex items-center gap-1 font-cond text-[10px] font-bold uppercase tracking-wide text-muted">
            <Users className="h-3 w-3" aria-hidden="true" />
            {board.size}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onPin}
          className={`cursor-pointer p-1 ${pinned ? 'text-you' : 'text-muted hover:text-text'}`}
          aria-label={pinned ? `Unpin ${board.leagueName}` : `Pin ${board.leagueName}`}
          aria-pressed={pinned}
        >
          <Pin className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      <button type="button" onClick={onOpen} className="cursor-pointer text-left">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <div className="text-center">
            <div className="truncate text-[12px] font-medium text-lime">{board.myName}</div>
            <div className={`font-cond text-4xl font-extrabold leading-none tabular-nums ${leadMine ? 'text-you' : 'text-them'}`}>
              {formatScore(board.myPoints)}
            </div>
          </div>
          <div className="pb-1 font-cond text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Vs</div>
          <div className="text-center">
            <div className="truncate text-[12px] font-medium text-muted">{board.oppName ?? 'BYE'}</div>
            <div
              className={`font-cond text-4xl font-extrabold leading-none tabular-nums ${
                leadMine ? 'text-them' : 'text-you'
              }`}
            >
              {formatScore(board.oppPoints)}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <LeadBar
            mine={board.myPoints}
            opp={board.oppPoints}
            chance={boardChanceToWin(board)}
            source={matchupWinPctSource(board)}
            compact
          />
        </div>
        {board.lastScorers.length > 0 ? (
          <div className="mt-3">
            <div className="mb-1 font-cond text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
              Top scorers
            </div>
            <div className="flex flex-wrap gap-1.5">
              {board.lastScorers.map((chip) => (
                <div key={chip.playerId} className="border border-line bg-bg px-1.5 py-1">
                  <div className="flex items-center gap-1">
                    <span className="font-cond text-[9px] font-bold uppercase text-muted">{chip.position}</span>
                    <span className="text-[11px]">{overlayName(chip.name)}</span>
                  </div>
                  <div className="font-cond text-xs font-bold tabular-nums">
                    {formatScore(chip.points)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="mt-3 cursor-pointer self-end text-[11px] uppercase tracking-wide text-muted hover:text-air"
        >
          Remove
        </button>
      ) : null}
    </article>
  )
}

export const BoardsScreen = ({
  state,
  onOpenBoard
}: {
  state: AppState
  onOpenBoard: () => void
}): JSX.Element => {
  const pinned = new Set(state.pinnedLeagueKeys)

  const handlePin = (key: string): void => {
    const next = pinned.has(key)
      ? state.pinnedLeagueKeys.filter((row) => row !== key)
      : [...state.pinnedLeagueKeys, key]
    void api().setPinned(next)
  }

  if (state.leagues.length === 0) {
    return (
      <div className="p-8 text-sm text-muted">
        Connect Sleeper or ESPN, then your leagues will land here. Pin the Sunday boards you want in the
        watchlist.
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-line px-5 py-2 text-[11px] uppercase tracking-[0.16em] text-muted">
        <span>{state.boards.length} matchups</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {state.boards.map((board) => (
            <BoardCard
              key={board.key}
              board={board}
              selected={state.selectedLeagueKey === board.key}
              pinned={pinned.has(board.key)}
              onOpen={() => {
                void api().selectLeague(board.key)
                onOpenBoard()
              }}
              onPin={() => handlePin(board.key)}
              onRemove={
                board.provider === 'espn' && !state.replay
                  ? () => {
                      const parsed = parseLeagueKey(board.key)
                      if (parsed) void api().removeEspnLeague(parsed.id)
                    }
                  : undefined
              }
            />
          ))}
        </div>
      </div>
      </div>
      <LiveScoringRail events={state.tape} onOpenBoard={onOpenBoard} />
    </div>
  )
}

import { useEffect, useState, type JSX } from 'react'
import type { LeagueBoardSnapshot, LeaguePair } from '@shared/types'
import { matchupChanceToWin, matchupWinPctSource } from '@shared/display'
import { HudScoreboard } from '../shared/HudScoreboard'
import { BoardRails } from '../shared/LineupRow'
import { LeadBar } from '../shared/LeadBar'
import { formatScore } from '../shared/format'
import { chromePillClass } from './chrome'

export type LeagueScan = { view: 'list' | 'detail'; index: number }

/** Arrow keys move the list. Enter opens a pairing. Escape steps back to the list, then to Mine. */
export const applyLeagueScanKey = (state: LeagueScan, key: string, count: number): LeagueScan | 'mine' => {
  switch (key) {
    case 'Escape':
      return state.view === 'detail' ? { view: 'list', index: state.index } : 'mine'
    case 'ArrowDown':
      if (state.view === 'detail' || count <= 0) return state
      return { view: 'list', index: Math.min(count - 1, state.index + 1) }
    case 'ArrowUp':
      if (state.view === 'detail' || count <= 0) return state
      return { view: 'list', index: Math.max(0, state.index - 1) }
    case 'Enter':
      if (state.view === 'detail' || count <= 0) return state
      return { view: 'detail', index: Math.min(state.index, count - 1) }
    default:
      return state
  }
}

const typingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement

const LeftCount = ({ count, starters }: { count: number; starters: number }): JSX.Element | null => {
  if (starters <= 0) return null
  return <div className="mt-1 font-cond text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{count} left</div>
}

const PairRow = ({
  pair,
  selected,
  pollingLive,
  onOpen
}: {
  pair: LeaguePair
  selected: boolean
  pollingLive: boolean
  onOpen: () => void
}): JSX.Element => {
  const bye = !pair.matchup.oppTeam
  const live = pollingLive && !bye && !pair.matchup.scoresFinal
  const chance = matchupChanceToWin(pair.matchup)
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onOpen}
      data-league-pair={pair.id}
      data-league-bye={bye ? 'true' : 'false'}
      data-league-mine={pair.mine ? 'true' : 'false'}
      className={`relative w-full cursor-pointer border-b border-line px-5 py-3 text-left ${
        selected ? 'bg-bg' : 'hover:bg-white/[0.03]'
      }`}
    >
      {selected ? <span className="absolute inset-y-0 left-0 w-0.5 bg-you" aria-hidden="true" /> : null}
      <div className="mb-2 flex items-center gap-2">
        {pair.mine ? (
          <span className="font-cond text-[10px] font-bold uppercase tracking-[0.16em] text-lime">Mine</span>
        ) : (
          <span className="font-cond text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Matchup</span>
        )}
        {live ? (
          <span className="inline-flex items-center gap-1 font-cond text-[10px] font-bold uppercase tracking-[0.16em] text-lime" data-live-dot="true">
            <span className="h-1.5 w-1.5 rounded-full bg-lime" aria-hidden="true" />
            Live
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
        <div className="min-w-0 text-center">
          <div className={`truncate text-[13px] font-medium ${pair.mine ? 'text-lime' : 'text-text'}`}>
            {pair.matchup.myTeam.name}
          </div>
          <div className="font-cond text-3xl font-extrabold leading-none tabular-nums">{formatScore(pair.matchup.myPoints)}</div>
          <LeftCount count={pair.left} starters={pair.matchup.starters.length} />
        </div>
        <div className="pt-4 font-cond text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Vs</div>
        <div className="min-w-0 text-center">
          <div className={`truncate text-[13px] font-medium ${bye ? 'text-muted' : 'text-text'}`}>
            {pair.matchup.oppTeam?.name ?? 'BYE'}
          </div>
          <div className="font-cond text-3xl font-extrabold leading-none tabular-nums">
            {bye ? '—' : formatScore(pair.matchup.oppPoints)}
          </div>
          <LeftCount count={pair.oppLeft} starters={pair.matchup.oppStarters.length} />
        </div>
      </div>
      {bye ? null : (
        <div className="mt-3">
          <LeadBar
            mine={pair.matchup.myPoints}
            opp={pair.matchup.oppPoints}
            chance={chance}
            source={matchupWinPctSource(pair.matchup)}
            compact
          />
        </div>
      )}
    </button>
  )
}

const Skeleton = (): JSX.Element => (
  <div className="space-y-px px-5 py-4" data-league-status="loading" aria-busy="true">
    {[0, 1, 2].map((row) => (
      <div key={row} className="animate-pulse border-b border-line py-4">
        <div className="mx-auto h-3 w-24 rounded-full bg-white/[0.06]" />
        <div className="mt-3 grid grid-cols-2 gap-8">
          <div className="h-8 rounded bg-white/[0.06]" />
          <div className="h-8 rounded bg-white/[0.06]" />
        </div>
      </div>
    ))}
  </div>
)

export const LeagueScoreboard = ({
  board,
  onMine
}: {
  board: LeagueBoardSnapshot | null
  onMine: () => void
}): JSX.Element => {
  const [scan, setScan] = useState<LeagueScan>({ view: 'list', index: 0 })
  const pairs = board?.pairs ?? []
  const count = pairs.length

  useEffect(() => {
    setScan((current) => {
      if (count <= 0) return { view: 'list', index: 0 }
      const index = Math.min(current.index, count - 1)
      return current.index === index ? current : { ...current, index }
    })
  }, [count])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent): void => {
      if (typingTarget(event.target)) return
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter' && event.key !== 'Escape') {
        return
      }
      const next = applyLeagueScanKey(scan, event.key, count)
      if (next === 'mine') {
        event.preventDefault()
        onMine()
        return
      }
      if (next === scan) return
      event.preventDefault()
      setScan(next)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [count, onMine, scan])

  const selected = pairs[scan.index] ?? null
  const showSkeleton = !board || (board.status === 'loading' && pairs.length === 0)

  if (scan.view === 'detail' && selected) {
    const bye = !selected.matchup.oppTeam
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-league-board="detail" data-league-pair={selected.id}>
        <div className="flex items-center gap-3 border-b border-line px-5 py-2">
          <button
            type="button"
            onClick={() => setScan({ view: 'list', index: scan.index })}
            className={chromePillClass(false, 'compact')}
          >
            All matchups
          </button>
          <span className="font-cond text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Read only</span>
        </div>
        <HudScoreboard
          matchup={selected.matchup}
          showOwners={board?.provider !== 'sleeper'}
          neutralSides={!selected.mine}
        />
        <BoardRails
          mine={selected.matchup.starters}
          opp={selected.matchup.oppStarters}
          mineBench={selected.matchup.bench}
          oppBench={bye ? [] : selected.matchup.oppBench}
          oppMissing={bye}
          emphasizeMine={selected.mine}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-league-board="list">
      <p className="border-b border-line px-5 py-2 text-[11px] uppercase tracking-[0.16em] text-muted">
        Every matchup this week. The overlay stays on yours.
      </p>
      {board?.status === 'error' && !board.needsSignIn ? (
        <p className="border-b border-air/40 bg-air/10 px-5 py-2 text-sm text-air" data-league-status="error">
          {board.error ?? 'Could not load the rest of the league.'}
        </p>
      ) : null}
      {showSkeleton ? (
        <Skeleton />
      ) : pairs.length === 0 ? (
        board?.needsSignIn ? null : (
          <p className="px-5 py-8 text-sm text-muted" data-league-status="empty">
            No matchups this week.
          </p>
        )
      ) : (
        <div className="min-h-0 flex-1 overflow-auto" role="listbox" aria-label="League matchups">
          {pairs.map((pair, index) => (
            <PairRow
              key={pair.id}
              pair={pair}
              selected={index === scan.index}
              pollingLive={Boolean(board?.pollingLive)}
              onOpen={() => setScan({ view: 'detail', index })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

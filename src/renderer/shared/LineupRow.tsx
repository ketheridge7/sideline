import { useEffect, useReducer, useState, type JSX, type PointerEvent } from 'react'
import type { Player } from '@shared/types'
import { nflTeamLabel, visibleInjury } from '@shared/display'
import {
  applyBenchDismiss,
  benchFootCopy,
  BOARD_ROSTER_PAD_X,
  BOARD_ROSTER_PAD_Y,
  canOpenBench,
  displayableBenchPlayers,
  lineupPositionLabel,
  type BenchSide
} from './benchPopover'
import { BenchFootStack, dismissBenchPointer } from './BenchFoot'
import { overlayName } from './format'
import { HUD_FROST } from './HudChrome'
import { LastTickMark, ScoreTick } from './ScoreTick'

export const HudRail = ({
  players,
  you
}: {
  players: Player[]
  you?: boolean
}): JSX.Element => (
  <StarterColumn players={players} you={you} hud compact />
)

export const BoardRosterColumn = ({
  you,
  starters,
  bench,
  rows,
  open,
  missing,
  onOpenChange,
  onFocus
}: {
  you?: boolean
  starters: Player[]
  bench: Player[]
  rows: number
  open: boolean
  missing?: boolean
  onOpenChange: (open: boolean) => void
  onFocus: () => void
}): JSX.Element => {
  const visibleBench = displayableBenchPlayers(bench)
  const copy = benchFootCopy(visibleBench.length, missing)
  const side: BenchSide = you ? 'mine' : 'opp'
  const headerClass = you
    ? 'mb-2 shrink-0 font-cond text-xs font-bold uppercase tracking-[0.18em] text-lime'
    : 'mb-2 shrink-0 text-right font-cond text-xs font-bold uppercase tracking-[0.18em] text-them'

  const onPointerDownCapture = (event: PointerEvent<HTMLDivElement>): void => {
    onFocus()
    if (dismissBenchPointer(event, open)) onOpenChange(false)
  }

  return (
    <div
      className="relative h-full min-h-0 min-w-0 overflow-hidden"
      data-bench-column={side}
      onFocusCapture={onFocus}
      onPointerDownCapture={onPointerDownCapture}
    >
      <div
        className={`flex h-full min-h-0 flex-col ${BOARD_ROSTER_PAD_X} ${BOARD_ROSTER_PAD_Y}`}
        data-bench-body=""
      >
        <h2 className={headerClass}>Starters</h2>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <StarterColumn players={starters} you={you} rows={rows} />
        </div>
        <BenchFootStack
          you={you}
          open={open}
          copy={copy}
          onToggle={() => onOpenChange(!open)}
          onFocus={onFocus}
        >
          {visibleBench.map((player) => (
            <LineupRow key={player.playerId} player={player} you={you} fixed />
          ))}
        </BenchFootStack>
      </div>
    </div>
  )
}

export const BoardRails = ({
  mine,
  opp,
  mineBench = [],
  oppBench = [],
  oppMissing = false
}: {
  mine: Player[]
  opp: Player[]
  mineBench?: Player[]
  oppBench?: Player[]
  oppMissing?: boolean
}): JSX.Element => {
  const rows = Math.max(mine.length, opp.length, 1)
  const [open, dispatch] = useReducer(applyBenchDismiss, { mine: false, opp: false })
  const [lastFocused, setLastFocused] = useState<BenchSide>('mine')
  const mineCopy = benchFootCopy(displayableBenchPlayers(mineBench).length)
  const oppCopy = benchFootCopy(displayableBenchPlayers(oppBench).length, oppMissing)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return
      }
      if (!open.mine && !open.opp) return
      event.stopPropagation()
      dispatch({ type: 'esc', lastFocused })
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [lastFocused, open.mine, open.opp])

  return (
    <section className="grid min-h-0 flex-1 grid-cols-2 grid-rows-1 overflow-hidden">
      <BoardRosterColumn
        you
        starters={mine}
        bench={mineBench}
        rows={rows}
        open={open.mine}
        onOpenChange={(next) => {
          if (next === open.mine) return
          if (next) dispatch({ type: 'toggle', side: 'mine', allowed: canOpenBench(mineCopy) })
          else dispatch({ type: 'outside', side: 'mine' })
        }}
        onFocus={() => setLastFocused('mine')}
      />
      <BoardRosterColumn
        starters={opp}
        bench={oppBench}
        rows={rows}
        open={open.opp}
        missing={oppMissing}
        onOpenChange={(next) => {
          if (next === open.opp) return
          if (next) dispatch({ type: 'toggle', side: 'opp', allowed: canOpenBench(oppCopy) })
          else dispatch({ type: 'outside', side: 'opp' })
        }}
        onFocus={() => setLastFocused('opp')}
      />
    </section>
  )
}

const StarterColumn = ({
  players,
  you,
  hud,
  compact,
  rows
}: {
  players: Player[]
  you?: boolean
  hud?: boolean
  compact?: boolean
  rows?: number
}): JSX.Element => {
  const count = Math.max(rows ?? players.length, 1)
  return (
    <div
      className={`${hud ? 'hud-rail' : ''} flex h-full min-h-0 min-w-0 flex-col`}
      data-hud-rail={you ? 'mine' : 'opp'}
    >
      {Array.from({ length: count }, (_, index) => (
        <LineupRow
          key={players[index]?.playerId ?? `${you ? 'mine' : 'opp'}-${index}`}
          player={players[index]}
          compact={compact}
          you={you}
          hud={hud}
        />
      ))}
    </div>
  )
}

export const LineupRow = ({
  player,
  compact,
  tv,
  you,
  hud,
  fixed
}: {
  player?: Player
  compact?: boolean
  tv?: boolean
  you?: boolean
  hud?: boolean
  fixed?: boolean
}): JSX.Element => {
  const rowClass = hud
    ? 'lineup-row hud-rail-row'
    : `lineup-row ${compact ? (tv ? 'h-8' : 'h-[22px]') : fixed ? 'h-11' : 'min-h-11 flex-1'}`
  if (!player) {
    return <div className={rowClass} data-lineup-row="empty" />
  }
  const name = compact ? overlayName(player.name) : player.name
  const team = nflTeamLabel(player.nflTeam)
  const injury = visibleInjury(player.status)
  const posClass = hud
    ? 'hud-type-pos'
    : `font-cond font-bold uppercase tracking-wide text-muted ${
        compact ? (tv ? 'text-xs' : 'text-[10px]') : 'text-sm'
      }`
  const nameClass = hud
    ? 'hud-type-player min-w-0 truncate'
    : `min-w-0 truncate ${
        compact ? (tv ? 'text-base' : 'text-[11px]') : 'font-cond text-base font-semibold uppercase tracking-wide'
      }`
  const ptsClass = hud
    ? 'hud-type-pts w-full'
    : `w-full font-cond font-bold ${compact ? (tv ? 'text-lg' : 'text-[13px]') : 'text-xl'}`
  return (
    <div className={rowClass} data-lineup-row={you ? 'mine' : 'opp'}>
      <span className={`lineup-row-pos ${posClass}`} data-lineup-col="pos">
        {lineupPositionLabel(player.position)}
      </span>
      <span className={`lineup-row-name ${nameClass}`} data-lineup-col="name">
        {name}
        {injury ? <span className="ml-1 text-[10px] font-semibold uppercase text-air">{injury}</span> : null}
        {!compact && player.lastPlay ? (
          <span className="ml-1.5 text-[10px] font-normal uppercase tracking-wide text-muted">{player.lastPlay}</span>
        ) : null}
        {!compact ? (
          <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted">{team}</span>
        ) : null}
      </span>
      <span className="lineup-row-pts" data-lineup-col="pts">
        {!compact ? <LastTickMark value={player.points} /> : null}
        <ScoreTick value={player.points} restColor={HUD_FROST} align="right" className={ptsClass} />
      </span>
    </div>
  )
}

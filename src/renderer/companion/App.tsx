import { useEffect, useState, type JSX } from 'react'
import { bugReportActiveView } from '@shared/bugReport'
import {
  acceleratorFromEvent,
  actionForAccelerator,
  isGlobalAccelerator,
  shortcutMapFromSettings,
  type ShortcutAction
} from '@shared/shortcuts'
import { useSideline, useToasts } from '../shared/useSideline'
import { BoardScreen } from './BoardScreen'
import { BoardsScreen } from './BoardsScreen'
import { ConnectScreen } from './ConnectScreen'
import { OverlayStudio } from './OverlayStudio'
import { TopBar, type Screen } from './TopBar'

const HISTORY = 12
const STATUS_TOAST = 'sideline:'

const api = (): NonNullable<Window['sideline']> => {
  if (!window.sideline) throw new Error('Sideline preload missing')
  return window.sideline
}

const runCompanionShortcut = (action: ShortcutAction, overlayEditMode: boolean): void => {
  switch (action) {
    case 'overlay':
      void api().toggleOverlay()
      return
    case 'overlayDisplay':
      void api().cycleOverlayDisplay()
      return
    case 'nextLeague':
      void api().cycleLeague(1)
      return
    case 'prevLeague':
      void api().cycleLeague(-1)
      return
    case 'overlayEdit':
      void api().setOverlayEditMode(!overlayEditMode)
      return
    default: {
      const _never: never = action
      return _never
    }
  }
}

const pushHistory = (
  prev: Record<string, number[]>,
  boards: { key: string; myPoints: number; oppPoints: number }[]
): Record<string, number[]> => {
  const next = { ...prev }
  for (const board of boards) {
    const delta = Math.round((board.myPoints - board.oppPoints) * 100) / 100
    const series = next[board.key] ?? []
    if (series[series.length - 1] === delta) continue
    next[board.key] = [...series, delta].slice(-HISTORY)
  }
  return next
}

export const App = (): JSX.Element => {
  const state = useSideline()
  const toasts = useToasts()
  const [screen, setScreen] = useState<Screen>('board')
  const [studioOpen, setStudioOpen] = useState(false)
  const [history, setHistory] = useState<Record<string, number[]>>({})
  const ready = state.sleeperConnected || state.espnConnected || state.replay
  const tapeToasts = toasts.filter((toast) => !toast.id.startsWith(STATUS_TOAST))
  const statusToast = toasts.find((toast) => toast.id.startsWith(STATUS_TOAST)) ?? null

  useEffect(() => {
    if (state.boards.length === 0) return
    setHistory((prev) => pushHistory(prev, state.boards))
  }, [state.boards])

  useEffect(() => {
    const shortcuts = shortcutMapFromSettings(state)
    const handleKey = (event: KeyboardEvent): void => {
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return
      }
      const accelerator = acceleratorFromEvent(event)
      if (!accelerator) return
      const action = actionForAccelerator(shortcuts, accelerator)
      if (!action) return
      if (isGlobalAccelerator(shortcuts[action])) return
      event.preventDefault()
      runCompanionShortcut(action, state.overlayEditMode)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [
    state.overlayHotkey,
    state.overlayEditHotkey,
    state.overlayDisplayHotkey,
    state.nextLeagueHotkey,
    state.prevLeagueHotkey,
    state.overlayEditMode
  ])

  useEffect(() => {
    if (!state.overlayVisible) setStudioOpen(false)
  }, [state.overlayVisible])

  const handleStudio = (open: boolean): void => {
    if (open && !state.overlayVisible) return
    setStudioOpen(open)
  }

  return (
    <div className="relative flex h-full flex-col bg-bg text-text">
      <TopBar state={state} screen={ready ? screen : 'connect'} onScreen={(next) => setScreen(next)} />
      {state.error ? (
        <div className="border-b border-air/40 bg-air/10 px-5 py-2 text-sm text-air">{state.error}</div>
      ) : null}
      <div className="flex min-h-0 flex-1">
        <main
          className={`min-h-0 min-w-0 flex-1 ${
            ready && (screen === 'board' || screen === 'boards') ? 'overflow-hidden' : 'overflow-auto'
          }`}
        >
          {!ready || screen === 'connect' ? (
            <ConnectScreen
              state={state}
              onOpenBoards={() => setScreen('boards')}
              activeView={bugReportActiveView(ready ? screen : 'connect', state.overlayVisible)}
            />
          ) : null}
          {ready && screen === 'boards' ? (
            <BoardsScreen state={state} onOpenBoard={() => setScreen('board')} />
          ) : null}
          {ready && screen === 'board' ? (
            <BoardScreen
              state={state}
              toasts={tapeToasts}
              history={history}
              studioOpen={studioOpen}
              onStudio={handleStudio}
              onBoards={() => setScreen('boards')}
            />
          ) : null}
        </main>
        {studioOpen && state.overlayVisible ? (
          <OverlayStudio state={state} onClose={() => handleStudio(false)} />
        ) : null}
      </div>
      {statusToast ? (
        <div
          className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border border-line bg-card px-3 py-2 text-xs text-muted"
          role="status"
        >
          {statusToast.body}
        </div>
      ) : null}
    </div>
  )
}

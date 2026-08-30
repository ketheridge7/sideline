import { useEffect, useState, type JSX } from 'react'
import { BoardScreen } from './BoardScreen'
import { BoardsScreen } from './BoardsScreen'
import { ConnectScreen } from './ConnectScreen'
import { OverlayStudio } from './OverlayStudio'
import { TopBar, type Screen } from './TopBar'
import { useSideline, useToasts } from '../shared/useSideline'

const HISTORY = 12

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

  useEffect(() => {
    if (state.boards.length === 0) return
    setHistory((prev) => pushHistory(prev, state.boards))
  }, [state.boards])

  return (
    <div className="relative flex h-full flex-col bg-bg text-text">
      <TopBar
        state={state}
        screen={ready ? screen : 'connect'}
        studioOpen={studioOpen}
        onScreen={(next) => setScreen(next)}
        onStudio={setStudioOpen}
      />
      {state.error ? (
        <div className="border-b border-air/40 bg-air/10 px-5 py-2 text-sm text-air">{state.error}</div>
      ) : null}
      <div className="flex min-h-0 flex-1">
        <main
          className={`min-h-0 min-w-0 flex-1 ${
            ready && (screen === 'board' || screen === 'boards') ? 'overflow-hidden' : 'overflow-auto'
          }`}
        >
          {!ready || screen === 'connect' ? <ConnectScreen state={state} /> : null}
          {ready && screen === 'boards' ? (
            <BoardsScreen state={state} onOpenBoard={() => setScreen('board')} />
          ) : null}
          {ready && screen === 'board' ? (
            <BoardScreen
              state={state}
              toasts={toasts}
              history={history}
              studioOpen={studioOpen}
              onStudio={setStudioOpen}
              onBoards={() => setScreen('boards')}
            />
          ) : null}
        </main>
        {studioOpen ? (
          <OverlayStudio state={state} onClose={() => setStudioOpen(false)} />
        ) : null}
      </div>
    </div>
  )
}

import { useState, type JSX } from 'react'
import { BoardScreen } from './BoardScreen'
import { BoardsScreen } from './BoardsScreen'
import { ConnectScreen } from './ConnectScreen'
import { OverlayStudio } from './OverlayStudio'
import { TopBar, type Screen } from './TopBar'
import { useSideline, useToasts } from '../shared/useSideline'

export const App = (): JSX.Element => {
  const state = useSideline()
  const toasts = useToasts()
  const [screen, setScreen] = useState<Screen>('board')
  const [studioOpen, setStudioOpen] = useState(false)
  const ready = state.sleeperConnected || state.espnConnected || state.replay

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
            ready && screen === 'board' ? 'overflow-hidden' : 'overflow-auto'
          }`}
        >
          {!ready || screen === 'connect' ? <ConnectScreen state={state} /> : null}
          {ready && screen === 'boards' ? <BoardsScreen state={state} /> : null}
          {ready && screen === 'board' ? (
            <BoardScreen
              state={state}
              toasts={toasts}
              studioOpen={studioOpen}
              onStudio={setStudioOpen}
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

import type { JSX } from 'react'
import type { AppState } from '@shared/types'
import { espnIndicatorHealthy } from '@shared/display'

export const ProviderHealth = ({ state }: { state: AppState }): JSX.Element => {
  const espnHealthy = espnIndicatorHealthy({
    replay: state.replay,
    espnConnected: state.espnConnected,
    espnNeedsRelogin: state.espnNeedsRelogin
  })
  return (
    <div
      className="flex shrink-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
      data-provider-health
    >
      <span
        className={`flex items-center gap-1 ${state.sleeperConnected ? 'text-sleeper' : 'text-muted'}`}
        data-sleeper-health={state.sleeperConnected ? 'connected' : 'disconnected'}
        title={state.sleeperConnected ? 'Sleeper connected' : 'Sleeper not connected'}
      >
        <span className={`h-1.5 w-1.5 ${state.sleeperConnected ? 'bg-sleeper' : 'bg-line'}`} />
        SL
      </span>
      <span
        className={`flex items-center gap-1 ${espnHealthy ? 'text-espn' : 'text-muted'}`}
        data-espn-health={espnHealthy ? 'healthy' : 'unhealthy'}
        title={espnHealthy ? 'ESPN session healthy' : 'ESPN sign in needed'}
      >
        <span className={`h-1.5 w-1.5 ${espnHealthy ? 'bg-espn' : 'bg-line'}`} />
        ES
      </span>
    </div>
  )
}

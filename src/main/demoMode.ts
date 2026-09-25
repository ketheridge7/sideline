/** Launch flag for Replay. `npm run replay` sets `SIDELINE_REPLAY=1`; a manual launch passes this flag. */
export const DEMO_FLAG = '--sideline-replay'

type Env = Record<string, string | undefined>

export const demoRequested = (env: Env, argv: readonly string[]): boolean =>
  env.SIDELINE_REPLAY === '1' || argv.includes(DEMO_FLAG)

/** Marketing captures hold Replay on its pinned frame so every still shows the same Sunday (`npm run replay:capture`). */
export const holdRequested = (env: Env): boolean => env.SIDELINE_REPLAY_HOLD === '1'

export type DemoSwitchPlan = 'noop' | 'dev-hint' | 'relaunch'

/**
 * Demo and live never share a process: every poller cache, tape, and HUD memory
 * starts clean on the other side of a relaunch. An electron-vite dev server dies
 * with its child, so a dev checkout gets a hint instead of a relaunch.
 */
export const demoSwitchPlan = (opts: { enabled: boolean; active: boolean; devServer: boolean }): DemoSwitchPlan => {
  if (opts.enabled === opts.active) return 'noop'
  if (opts.devServer) return 'dev-hint'
  return 'relaunch'
}

export const demoRelaunchArgs = (argv: readonly string[], enabled: boolean): string[] => {
  const rest = argv.slice(1).filter((arg) => arg !== DEMO_FLAG)
  return enabled ? [...rest, DEMO_FLAG] : rest
}

export const demoDevHint = (enabled: boolean): string =>
  enabled
    ? 'Dev checkout: quit Sideline, then run `npm run replay` to arm Replay.'
    : 'Dev checkout: quit Sideline, then run `npm run dev` to go back to live.'

export const DEMO_LOCKED_MESSAGE =
  'Replay is a demo mode. Relaunch Sideline normally to use your live leagues.'

export type RendererRole = 'companion' | 'overlay'

export const RENDERER_RELOAD_LIMIT = 3
export const RENDERER_RELOAD_WINDOW_MS = 60_000

export const rendererGonePlan = (opts: {
  reason: string
  quitting: boolean
  reloadsInWindow: number
  maxReloads: number
}): 'ignore' | 'reload' | 'stop' => {
  if (opts.quitting || opts.reason === 'clean-exit') return 'ignore'
  if (opts.reloadsInWindow >= opts.maxReloads) return 'stop'
  return 'reload'
}

export type RendererRecovery = {
  noteGone: (details: { reason: string; exitCode: number }) => void
  noteUnresponsive: () => void
}

export const createRendererRecovery = (opts: {
  role: RendererRole
  quitting: () => boolean
  isDestroyed: () => boolean
  reload: () => void
  forceClickThrough?: () => void
  log: (
    level: 'warn' | 'error',
    message: string,
    extra?: { reason?: string; exitCode?: number }
  ) => void
  now?: () => number
  maxReloads?: number
  windowMs?: number
}): RendererRecovery => {
  const now = (): number => (opts.now ? opts.now() : Date.now())
  const maxReloads = opts.maxReloads ?? RENDERER_RELOAD_LIMIT
  const windowMs = opts.windowMs ?? RENDERER_RELOAD_WINDOW_MS
  let reloads = 0
  let windowStartedAt = now()

  const clickThrough = (): void => {
    if (opts.role === 'overlay') opts.forceClickThrough?.()
  }

  return {
    noteGone: (details) => {
      const at = now()
      if (at - windowStartedAt > windowMs) {
        reloads = 0
        windowStartedAt = at
      }
      const plan = rendererGonePlan({
        reason: details.reason,
        quitting: opts.quitting(),
        reloadsInWindow: reloads,
        maxReloads
      })
      switch (plan) {
        case 'ignore':
          return
        case 'stop':
          clickThrough()
          opts.log('error', `${opts.role} renderer crashed repeatedly`, {
            reason: details.reason,
            exitCode: details.exitCode
          })
          return
        case 'reload':
          clickThrough()
          opts.log('error', `${opts.role} renderer gone`, {
            reason: details.reason,
            exitCode: details.exitCode
          })
          reloads += 1
          if (!opts.isDestroyed()) opts.reload()
          return
        default: {
          const _never: never = plan
          void _never
        }
      }
    },
    noteUnresponsive: () => {
      opts.log('warn', `${opts.role} renderer unresponsive`)
      clickThrough()
    }
  }
}

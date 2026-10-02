import { OVERLAY_PRESET_IDS, type OverlayPresetId } from '@shared/overlayLayout'
import type { AppState, OverlayHudState } from '@shared/types'
import { overlayHudUnchanged, toOverlayHud } from '@shared/types'

export const STALE_MS = 120_000

/** A bad SSE frame must not wipe the HUD. Null means keep whatever is on screen. */
export const sseHudPayload = (data: string): OverlayHudState | null => {
  try {
    const parsed = JSON.parse(data) as unknown
    if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) return null
    return parsed as OverlayHudState
  } catch {
    return null
  }
}

/** First silence reconnects the stream. A second silence reloads the page. */
export const overlayWatchdogPlan = (reconnects: number): 'reconnect' | 'reload' =>
  reconnects < 1 ? 'reconnect' : 'reload'

export type OverlaySurface = 'desktop' | 'obs' | 'tv'

const searchParams = (search: string): URLSearchParams =>
  new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

export const eventsPathFromSearch = (search: string): string => {
  const k = searchParams(search).get('k')
  return k ? `/events?k=${encodeURIComponent(k)}` : '/events'
}

export const overlaySurface = (search: string): OverlaySurface => {
  const params = searchParams(search)
  if (params.get('tv') === '1') return 'tv'
  if (params.get('surface') === 'obs') return 'obs'
  return 'desktop'
}

export const isTvOverlay = (search: string): boolean => overlaySurface(search) === 'tv'

export const overlayAllowsEdit = (search: string, hasPreload: boolean): boolean => {
  if (!hasPreload) return false
  return overlaySurface(search) === 'desktop'
}

export const canvasInsetPct = (surface: OverlaySurface): number => (surface === 'tv' ? 4 : 0)

/** Marketing stills freeze a Studio preset (`?preset=3`) without writing settings. */
export const overlayPresetFromSearch = (search: string): OverlayPresetId | null => {
  const raw = searchParams(search).get('preset')
  if (!raw || !(OVERLAY_PRESET_IDS as readonly string[]).includes(raw)) return null
  return raw as OverlayPresetId
}

export const subscribeHud = (onState: (hud: OverlayHudState) => void): (() => void) => {
  let prev: OverlayHudState | null = null
  const emit = (hud: OverlayHudState): void => {
    if (prev && overlayHudUnchanged(prev, hud)) return
    prev = hud
    onState(hud)
  }
  if (window.sideline) {
    const unsub = window.sideline.onHud((hud: OverlayHudState) => emit(hud))
    void window.sideline.getState().then((state: AppState) => {
      if (prev) return
      emit(toOverlayHud(state))
    })
    return unsub
  }

  let lastBeat = Date.now()
  let reconnects = 0
  let source: EventSource | null = null

  const mark = (): void => {
    lastBeat = Date.now()
    reconnects = 0
  }
  const detach = (): void => {
    if (!source) return
    source.onerror = null
    source.onmessage = null
    source.close()
    source = null
  }
  const recover = (): void => {
    const plan = overlayWatchdogPlan(reconnects)
    if (plan === 'reload') {
      window.location.reload()
      return
    }
    reconnects += 1
    lastBeat = Date.now()
    attach()
  }
  const attach = (): void => {
    detach()
    const next = new EventSource(eventsPathFromSearch(window.location.search))
    source = next
    next.onmessage = (event) => {
      mark()
      const hud = sseHudPayload(event.data)
      if (hud) emit(hud)
    }
    next.addEventListener('ping', mark)
    next.onerror = () => {
      if (next.readyState === EventSource.CLOSED) recover()
    }
  }
  attach()

  const watchdog = window.setInterval(() => {
    if (Date.now() - lastBeat > STALE_MS) recover()
  }, 15_000)

  return () => {
    window.clearInterval(watchdog)
    detach()
  }
}

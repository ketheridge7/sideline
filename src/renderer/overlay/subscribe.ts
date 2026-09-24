import { OVERLAY_PRESET_IDS, type OverlayPresetId } from '@shared/overlayLayout'
import type { AppState, OverlayHudState } from '@shared/types'
import { emptyAppState, overlayHudUnchanged, toOverlayHud } from '@shared/types'

export const STALE_MS = 120_000

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
  const source = new EventSource(eventsPathFromSearch(window.location.search))
  const mark = (): void => {
    lastBeat = Date.now()
  }
  source.onmessage = (event) => {
    mark()
    try {
      emit(JSON.parse(event.data) as OverlayHudState)
    } catch {
      emit(toOverlayHud(emptyAppState()))
    }
  }
  source.addEventListener('ping', mark)
  source.onerror = () => {
    if (source.readyState === EventSource.CLOSED) window.location.reload()
  }

  const watchdog = window.setInterval(() => {
    if (Date.now() - lastBeat > STALE_MS) window.location.reload()
  }, 15_000)

  return () => {
    window.clearInterval(watchdog)
    source.close()
  }
}

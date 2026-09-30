export const STUDIO_HISTORY_LIMIT = 60
/** Edits with the same key inside this window fold into one undo step (a slider drag, a color drag). */
export const STUDIO_HISTORY_MERGE_MS = 800

export type StudioHistory<T> = {
  past: T[]
  present: T
  future: T[]
  lastKey: string | null
  lastAt: number
}

export const createHistory = <T>(present: T): StudioHistory<T> => ({
  past: [],
  present,
  future: [],
  lastKey: null,
  lastAt: 0
})

export const commitHistory = <T>(
  history: StudioHistory<T>,
  next: T,
  options: { key?: string | null; at?: number } = {}
): StudioHistory<T> => {
  const key = options.key ?? null
  const at = options.at ?? Date.now()
  const merge = key != null && key === history.lastKey && at - history.lastAt <= STUDIO_HISTORY_MERGE_MS
  if (merge) return { ...history, present: next, future: [], lastAt: at }
  return {
    past: [...history.past, history.present].slice(-STUDIO_HISTORY_LIMIT),
    present: next,
    future: [],
    lastKey: key,
    lastAt: at
  }
}

export const canUndo = <T>(history: StudioHistory<T>): boolean => history.past.length > 0
export const canRedo = <T>(history: StudioHistory<T>): boolean => history.future.length > 0

export const undoHistory = <T>(history: StudioHistory<T>): StudioHistory<T> => {
  if (history.past.length === 0) return history
  const previous = history.past[history.past.length - 1]
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    lastKey: null,
    lastAt: 0
  }
}

export const redoHistory = <T>(history: StudioHistory<T>): StudioHistory<T> => {
  if (history.future.length === 0) return history
  const [next, ...rest] = history.future
  return {
    past: [...history.past, history.present].slice(-STUDIO_HISTORY_LIMIT),
    present: next,
    future: rest,
    lastKey: null,
    lastAt: 0
  }
}

/**
 * Adopts a value that changed outside the Studio (overlay edit-mode drag, another window).
 * An echo of the present is ignored so the undo stack does not grow on every save round-trip.
 */
export const syncHistory = <T>(
  history: StudioHistory<T>,
  external: T,
  same: (left: T, right: T) => boolean
): StudioHistory<T> => {
  if (same(history.present, external)) return history
  return { ...history, present: external, lastKey: null, lastAt: 0 }
}

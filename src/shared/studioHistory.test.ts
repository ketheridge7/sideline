import { describe, expect, it } from 'vitest'
import {
  canRedo,
  canUndo,
  commitHistory,
  createHistory,
  redoHistory,
  STUDIO_HISTORY_LIMIT,
  STUDIO_HISTORY_MERGE_MS,
  syncHistory,
  undoHistory
} from './studioHistory'

const same = (left: number, right: number): boolean => left === right

describe('studio history', () => {
  it('undoes and redoes single commits', () => {
    let history = createHistory(0)
    expect(canUndo(history)).toBe(false)
    history = commitHistory(history, 1, { at: 1000 })
    history = commitHistory(history, 2, { at: 5000 })
    expect(history.present).toBe(2)
    history = undoHistory(history)
    expect(history.present).toBe(1)
    expect(canRedo(history)).toBe(true)
    history = undoHistory(history)
    expect(history.present).toBe(0)
    expect(undoHistory(history)).toBe(history)
    history = redoHistory(redoHistory(history))
    expect(history.present).toBe(2)
    expect(redoHistory(history)).toBe(history)
  })

  it('folds a slider drag with one key into one undo step', () => {
    let history = createHistory(0)
    for (let step = 1; step <= 10; step += 1) {
      history = commitHistory(history, step, { key: 'slider:x', at: 1000 + step * 50 })
    }
    expect(history.past).toEqual([0])
    expect(undoHistory(history).present).toBe(0)
  })

  it('starts a new step after the merge window or a different key', () => {
    let history = createHistory(0)
    history = commitHistory(history, 1, { key: 'a', at: 1000 })
    history = commitHistory(history, 2, { key: 'a', at: 1000 + STUDIO_HISTORY_MERGE_MS + 1 })
    history = commitHistory(history, 3, { key: 'b', at: 1000 + STUDIO_HISTORY_MERGE_MS + 2 })
    expect(history.past).toEqual([0, 1, 2])
  })

  it('does not merge across an undo', () => {
    let history = createHistory(0)
    history = commitHistory(history, 1, { key: 'a', at: 1000 })
    history = undoHistory(history)
    history = commitHistory(history, 5, { key: 'a', at: 1010 })
    expect(history.past).toEqual([0])
    expect(canRedo(history)).toBe(false)
  })

  it('caps the stack', () => {
    let history = createHistory(0)
    for (let step = 1; step <= STUDIO_HISTORY_LIMIT + 20; step += 1) history = commitHistory(history, step, { at: step * 10_000 })
    expect(history.past).toHaveLength(STUDIO_HISTORY_LIMIT)
  })

  it('adopts outside changes without adding undo steps, and ignores echoes', () => {
    let history = commitHistory(createHistory(0), 1, { at: 1000 })
    expect(syncHistory(history, 1, same)).toBe(history)
    history = syncHistory(history, 7, same)
    expect(history.present).toBe(7)
    expect(history.past).toEqual([0])
  })
})

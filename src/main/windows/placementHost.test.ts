import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  screen: {
    getAllDisplays: () => [],
    getPrimaryDisplay: () => ({ id: 1, bounds: { x: 0, y: 0, width: 1, height: 1 }, workArea: { x: 0, y: 0, width: 1, height: 1 }, scaleFactor: 1 }),
    on: vi.fn(),
    removeListener: vi.fn()
  }
}))

import {
  listenForDisplayChanges,
  resetPlacementHostForTests,
  trackPlacementBinding
} from './placementHost'
import type { DisplayChangeReason } from '../windowPlacement'

afterEach(() => {
  resetPlacementHostForTests()
})

describe('display change events', () => {
  it('re-anchors live windows on display-added, display-removed, and display-metrics-changed', () => {
    const seen: DisplayChangeReason[] = []
    const listeners = new Map<string, () => void>()
    trackPlacementBinding('companion', {
      applySaved: () => undefined,
      reconcile: (reason) => {
        seen.push(reason)
      },
      flush: () => undefined,
      dispose: () => undefined
    })
    listenForDisplayChanges({
      on: (event, listener) => {
        listeners.set(event, listener)
      },
      removeListener: (event) => {
        listeners.delete(event)
      }
    })
    listeners.get('display-added')?.()
    listeners.get('display-removed')?.()
    listeners.get('display-metrics-changed')?.()
    expect(seen).toEqual(['added', 'removed', 'metrics'])
    resetPlacementHostForTests()
    listeners.get('display-removed')?.()
    expect(seen).toEqual(['added', 'removed', 'metrics'])
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { writeFileSync } from 'fs'
import { join } from 'path'

vi.mock('electron', () => {
  const fs = require('fs') as typeof import('fs')
  const os = require('os') as typeof import('os')
  const path = require('path') as typeof import('path')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sideline-proj-'))
  return { app: { getPath: () => dir } }
})

import { app } from 'electron'
import {
  hydrateSleeperProjectionsFromDisk,
  peekSleeperProjectionPts,
  resetSleeperProjectionsCache
} from './sleeperProjections'

afterEach(() => {
  resetSleeperProjectionsCache()
})

const week = { season: '2026', week: 3, seasonType: 'regular' }

const writeDisk = (players: Record<string, Record<string, number>>): void => {
  writeFileSync(
    join(app.getPath('userData'), 'sideline-sleeper-projections.json'),
    JSON.stringify({ fetchedAt: Date.now(), ...week, players })
  )
}

describe('peekSleeperProjectionPts', () => {
  it('returns the league scoring column and memoizes the map per kind', () => {
    writeDisk({ '4046': { pts_ppr: 17.49, pts_half_ppr: 14.32, pts_std: 11.15 } })
    hydrateSleeperProjectionsFromDisk(week)
    const half = peekSleeperProjectionPts('half_ppr')
    expect(half).toEqual({ '4046': 14.32 })
    expect(peekSleeperProjectionPts('half_ppr')).toBe(half)
    expect(peekSleeperProjectionPts('std')).toEqual({ '4046': 11.15 })
    expect(peekSleeperProjectionPts()).toEqual({ '4046': 17.49 })
  })

  it('drops the memo when the projection rows change', () => {
    writeDisk({ '1': { pts_ppr: 10 } })
    hydrateSleeperProjectionsFromDisk(week)
    const first = peekSleeperProjectionPts('ppr')
    resetSleeperProjectionsCache()
    writeDisk({ '1': { pts_ppr: 12 } })
    hydrateSleeperProjectionsFromDisk(week)
    const second = peekSleeperProjectionPts('ppr')
    expect(second).not.toBe(first)
    expect(second).toEqual({ '1': 12 })
  })
})

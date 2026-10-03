import { afterEach, describe, expect, it, vi } from 'vitest'
import { writeFileSync } from 'fs'
import { join } from 'path'

const projections = vi.hoisted(() => ({ getWeekProjectionFile: vi.fn() }))

vi.mock('./sleeperClient', async () => {
  const actual = await vi.importActual<typeof import('./sleeperClient')>('./sleeperClient')
  return { ...actual, getWeekProjectionFile: projections.getWeekProjectionFile }
})

vi.mock('electron', () => {
  const fs = require('fs') as typeof import('fs')
  const os = require('os') as typeof import('os')
  const path = require('path') as typeof import('path')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sideline-proj-'))
  return { app: { getPath: () => dir } }
})

import { app } from 'electron'
import {
  getSleeperProjectionPts,
  hydrateSleeperProjectionsFromDisk,
  peekSleeperProjectionPts,
  peekSleeperUnprojectedIds,
  resetSleeperProjectionsCache,
  sleeperProjectionsSettled
} from './sleeperProjections'

afterEach(async () => {
  resetSleeperProjectionsCache()
  await sleeperProjectionsSettled()
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

  it('does not let an older week fetch overwrite the newer week', async () => {
    let releaseOld: (value: unknown) => void = () => undefined
    let releaseNew: (value: unknown) => void = () => undefined
    const olderWeek = new Promise((resolve) => {
      releaseOld = resolve
    })
    const newerWeek = new Promise((resolve) => {
      releaseNew = resolve
    })
    projections.getWeekProjectionFile.mockImplementation((_season: string, week: number) =>
      week === 3 ? olderWeek : newerWeek
    )
    const older = getSleeperProjectionPts({ season: '2026', week: 3, seasonType: 'regular' })
    const newer = getSleeperProjectionPts({ season: '2026', week: 4, seasonType: 'regular' })
    releaseNew({ players: { '1': { pts_ppr: 9 } }, unprojected: ['5927'] })
    await newer
    expect(peekSleeperProjectionPts()).toEqual({ '1': 9 })
    expect(peekSleeperUnprojectedIds()).toEqual(new Set(['5927']))
    releaseOld({ players: { '1': { pts_ppr: 1 } }, unprojected: [] })
    await older
    expect(peekSleeperProjectionPts()).toEqual({ '1': 9 })
    expect([...peekSleeperUnprojectedIds()!]).toEqual(['5927'])
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
    expect(peekSleeperUnprojectedIds()).toEqual(new Set())
  })

  it('keeps ids that the file listed with no fantasy points', () => {
    writeFileSync(
      join(app.getPath('userData'), 'sideline-sleeper-projections.json'),
      JSON.stringify({
        fetchedAt: Date.now(),
        ...week,
        players: { '8228': { pts_ppr: 18.58 } },
        unprojected: ['5927', '13286']
      })
    )
    hydrateSleeperProjectionsFromDisk(week)
    expect(peekSleeperProjectionPts()).toEqual({ '8228': 18.58 })
    expect(peekSleeperUnprojectedIds()).toEqual(new Set(['5927', '13286']))
    expect(peekSleeperUnprojectedIds()).toBe(peekSleeperUnprojectedIds())
  })
})

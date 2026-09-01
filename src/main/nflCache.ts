import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import type { NflState } from '@shared/types'
import { espnLeaguesFromDiskPayload, espnScoresFromDiskPayload, espnTeamsFromDiskPayload, lastHudFromDiskPayload, matchupsFromDiskPayload, nflFromDiskPayload, sleeperLeaguesFromDiskPayload, sleeperRostersFromDiskPayload, NFL_DISK_STALE_MS, type LastHudSnapshot, type EspnLeaguesDiskRow, type EspnScoreDiskRow, type MatchupsDiskSnapshot, type SleeperLeaguesDiskRow, type SleeperRosterDiskRow } from './pollTargets'

const nflPath = (): string => join(app.getPath('userData'), 'sideline-nfl.json')
const espnTeamsPath = (): string => join(app.getPath('userData'), 'sideline-espn-teams.json')
const lastHudPath = (): string => join(app.getPath('userData'), 'sideline-last-hud.json')
const espnScoresPath = (): string => join(app.getPath('userData'), 'sideline-espn-scores.json')
const sleeperRostersPath = (): string => join(app.getPath('userData'), 'sideline-sleeper-rosters.json')
const sleeperLeaguesPath = (): string => join(app.getPath('userData'), 'sideline-sleeper-leagues.json')
const espnLeaguesPath = (): string => join(app.getPath('userData'), 'sideline-espn-leagues.json')
const matchupsPath = (): string => join(app.getPath('userData'), 'sideline-matchups.json')

const ensureUserData = (): string => {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export const readNflDisk = (): NflState | null => {
  try {
    return nflFromDiskPayload(JSON.parse(readFileSync(nflPath(), 'utf8')), Date.now())
  } catch {
    return null
  }
}

export const readNflDiskStale = (): NflState | null => {
  try {
    return nflFromDiskPayload(JSON.parse(readFileSync(nflPath(), 'utf8')), Date.now(), NFL_DISK_STALE_MS)
  } catch {
    return null
  }
}

const writeJson = (path: string, payload: unknown): void => {
  try {
    ensureUserData()
    void writeFile(path, JSON.stringify(payload)).catch(() => undefined)
  } catch {
    // live path must not fail if userData is unwritable
  }
}

export const writeNflDisk = (nfl: NflState): void => {
  writeJson(nflPath(), { at: Date.now(), nfl })
}

export const readEspnTeamsDisk = (): Record<string, Record<string, unknown>[]> | null => {
  try {
    return espnTeamsFromDiskPayload(JSON.parse(readFileSync(espnTeamsPath(), 'utf8')), Date.now())
  } catch {
    return null
  }
}

export const writeEspnTeamsDisk = (byId: Record<string, Record<string, unknown>[]>): void => {
  writeJson(espnTeamsPath(), { at: Date.now(), byId })
}

export const readLastHud = (): LastHudSnapshot | null => {
  try {
    return lastHudFromDiskPayload(JSON.parse(readFileSync(lastHudPath(), 'utf8')), Date.now())
  } catch {
    return null
  }
}

export const writeLastHud = (snap: LastHudSnapshot): void => {
  writeJson(lastHudPath(), {
    at: Date.now(),
    displayWeek: snap.displayWeek,
    selectedKey: snap.selectedKey,
    matchup: snap.matchup
  })
}

export const readEspnScoresDisk = (): Record<string, EspnScoreDiskRow> | null => {
  try {
    return espnScoresFromDiskPayload(JSON.parse(readFileSync(espnScoresPath(), 'utf8')), Date.now())
  } catch {
    return null
  }
}

export const writeEspnScoresDisk = (byId: Record<string, EspnScoreDiskRow>): void => {
  writeJson(espnScoresPath(), { at: Date.now(), byId })
}

export const readSleeperRostersDisk = (): Record<string, SleeperRosterDiskRow> | null => {
  try {
    return sleeperRostersFromDiskPayload(JSON.parse(readFileSync(sleeperRostersPath(), 'utf8')), Date.now())
  } catch {
    return null
  }
}

export const writeSleeperRostersDisk = (byId: Record<string, SleeperRosterDiskRow>): void => {
  writeJson(sleeperRostersPath(), { at: Date.now(), byId })
}

export const readSleeperLeaguesDisk = (): SleeperLeaguesDiskRow | null => {
  try {
    return sleeperLeaguesFromDiskPayload(JSON.parse(readFileSync(sleeperLeaguesPath(), 'utf8')), Date.now())
  } catch {
    return null
  }
}

export const writeSleeperLeaguesDisk = (row: SleeperLeaguesDiskRow): void => {
  writeJson(sleeperLeaguesPath(), { at: Date.now(), username: row.username, season: row.season, leagues: row.leagues })
}

export const readEspnLeaguesDisk = (): EspnLeaguesDiskRow | null => {
  try {
    return espnLeaguesFromDiskPayload(JSON.parse(readFileSync(espnLeaguesPath(), 'utf8')), Date.now())
  } catch {
    return null
  }
}

export const writeEspnLeaguesDisk = (row: EspnLeaguesDiskRow): void => {
  writeJson(espnLeaguesPath(), { at: Date.now(), season: row.season, ids: row.ids, leagues: row.leagues })
}

export const readMatchupsDisk = (): MatchupsDiskSnapshot | null => {
  try {
    return matchupsFromDiskPayload(JSON.parse(readFileSync(matchupsPath(), 'utf8')), Date.now())
  } catch {
    return null
  }
}

export const writeMatchupsDisk = (row: MatchupsDiskSnapshot): void => {
  writeJson(matchupsPath(), { at: Date.now(), week: row.week, byKey: row.byKey })
}

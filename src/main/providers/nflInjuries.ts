import { visibleInjury } from '@shared/display'
import type { CachedPlayer } from './sleeperClient'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

export const injuryKey = (name: string, team: string): string =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, '')}|${team.toUpperCase()}`

const statusFromRow = (row: Record<string, unknown>): string | undefined => {
  const type = isRecord(row.type) ? row.type : null
  const details = isRecord(row.details) ? row.details : null
  const fantasy = details && isRecord(details.fantasyStatus) ? details.fantasyStatus : null
  return str(type?.abbreviation) || str(fantasy?.abbreviation) || str(row.status)
}

export const injuryMapFromPayload = (payload: unknown): Map<string, string> => {
  const out = new Map<string, string>()
  if (!isRecord(payload)) return out
  for (const teamBag of asArray(payload.injuries)) {
    if (!isRecord(teamBag)) continue
    for (const row of asArray(teamBag.injuries)) {
      if (!isRecord(row)) continue
      const athlete = isRecord(row.athlete) ? row.athlete : null
      const team = isRecord(athlete?.team) ? athlete.team : isRecord(teamBag.team) ? teamBag.team : null
      const name = str(athlete?.displayName) || [str(athlete?.firstName), str(athlete?.lastName)].filter(Boolean).join(' ')
      const abbr = str(team?.abbreviation)
      const raw = statusFromRow(row)
      const label = visibleInjury(raw)
      if (!name || !abbr || !label) continue
      out.set(injuryKey(name, abbr), raw ?? label)
    }
  }
  return out
}

export const applyInjuryMap = (
  players: Record<string, CachedPlayer>,
  injuries: Map<string, string>
): Record<string, CachedPlayer> => {
  if (injuries.size === 0) return players
  const next: Record<string, CachedPlayer> = { ...players }
  for (const [id, player] of Object.entries(players)) {
    const hit = injuries.get(injuryKey(player.name, player.nflTeam))
    if (!hit) continue
    next[id] = { ...player, status: hit }
  }
  return next
}

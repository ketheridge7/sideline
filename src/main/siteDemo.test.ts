import { describe, expect, it } from 'vitest'
import { leagueKey } from '@shared/types'
import { matchupChanceToWin } from '@shared/display'
import { formatScore, overlayName } from '../renderer/shared/format'
import { COMPANION_LEAGUES, DEMO_WEEK, HERO_HUD, THEM_STARTERS, YOU_STARTERS } from '../../site/lib/demo'
import { FEATURED_LEAGUE_KEY, REPLAY_WEEK, replayMatchupFor, replayWorldLeagues } from './providers/replayWorld'

describe('site demo constants match the pinned Replay frame', () => {
  const leagues = replayWorldLeagues(REPLAY_WEEK)
  const featured = leagues.find((row) => leagueKey(row.provider, row.id) === FEATURED_LEAGUE_KEY)!
  const matchup = replayMatchupFor(featured, 0)!

  it('agrees on the featured matchup, score, and win%', () => {
    expect(DEMO_WEEK).toBe(REPLAY_WEEK)
    expect(HERO_HUD.league).toBe(featured.name)
    expect(HERO_HUD.you).toMatchObject({ team: matchup.myTeam.name, manager: matchup.myTeam.owner, record: matchup.myTeam.record })
    expect(HERO_HUD.them).toMatchObject({ team: matchup.oppTeam?.name, manager: matchup.oppTeam?.owner, record: matchup.oppTeam?.record })
    expect(HERO_HUD.you.score).toBe(formatScore(matchup.myPoints))
    expect(HERO_HUD.them.score).toBe(formatScore(matchup.oppPoints))
    expect(HERO_HUD.you.winPct).toBe(Math.round(matchupChanceToWin(matchup)!.mine * 100))
  })

  it('agrees on both starting lineups', () => {
    const rows = (players: typeof matchup.starters) =>
      players.map((row) => ({ pos: row.position, name: overlayName(row.name), nfl: row.nflTeam, pts: formatScore(row.points ?? 0) }))
    expect(YOU_STARTERS).toEqual(rows(matchup.starters))
    expect(THEM_STARTERS).toEqual(rows(matchup.oppStarters))
  })

  it('agrees on the six MY LEAGUES rows', () => {
    expect(COMPANION_LEAGUES).toEqual(
      leagues.map((league) => {
        const row = replayMatchupFor(league, 0)!
        return { name: league.name, provider: league.provider, you: formatScore(row.myPoints), them: formatScore(row.oppPoints) }
      })
    )
  })
})

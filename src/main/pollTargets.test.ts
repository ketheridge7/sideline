import { describe, expect, it } from 'vitest'
import { emptyAppState, type League } from '@shared/types'
import { defaultSettings } from '@shared/settings'
import {
  asNflState,
  cacheFresh,
  espnTeamsFromDiskPayload,
  espnScoresFromDiskPayload,
  lastHudFromDiskPayload,
  nflFromDiskPayload,
  sleeperRostersFromDiskPayload,
  sleeperRosterOverlayPlan,
  sleeperOverlayRosterSwrPlan,
  sleeperColdHudPlan,
  sleeperHudScorePlan,
  sleeperOverlayMissPlan,
  sleeperRosterDiskPlan,
  sleeperPrevMatchup,
  sleeperUserSwrPlan,
  sleeperUserFetchJoinPlan,
  sleeperUserFromSettings,
  sleeperUserHudPlan,
  sleeperLeaguesFromDiskPayload,
  espnLeaguesFromDiskPayload,
  espnLeaguesCachePlan,
  espnDiscoverySwrPlan,
  mergeProviderLeagues,
  holdForSelectedLive,
  matchupsFromDiskPayload,
  isLiveLeagueId,
  recentLiveCallMs,
  restLeaguesToPrefetch,
  restPrefetchColdPlan,
  restPrefetchAwaitPlan,
  restPrefetchGate,
  gamedayLiveTick,
  scoreboardPollLive,
  restSettleSchedulePlan,
  restConcurrency,
  restScoreTimeoutMs,
  restScoreFetchPriority,
  REST_LIVE_CONCURRENCY,
  REST_IDLE_CONCURRENCY,
  restMatchupFlightKey,
  restHudJoinPlan,
  warmupLeaguesFromDisk,
  warmupMatchupFromDisk,
  warmupNflCachePlan,
  stripReplayLeagueKeys,
  espnLeagueIdsToDiscover,
  espnFanExtraIds,
  espnScoreOverlayPlan,
  espnScoreKickOrder,
  liveScorePriority,
  sleeperIdentityPriority,
  sleeperIdentityTimeoutMs,
  hudScoreFetchTimeoutMs,
  espnLiveFullSwrPlan,
  espnDeferredBoxscoreDrainPlan,
  espnScoreRefreshKey,
  espnBoxscoreSwrFreshPlan,
  espnBoxscoreRecoverStale,
  espnDeferredBoxscorePriority,
  espnFullSwrPaintPlan,
  espnTeamIdLookupPlan,
  espnLiveOverlayCachePlan,
  espnLiveDiskHydratePlan,
  espnTeamsHydrateAfterScorePlan,
  espnHudFromScorePlan,
  espnOverlayPtsPlan,
  espnBoxscoreSwrPtsPlan,
  espnTxKickOrder,
  espnTxCookieRetryPlan,
  espnScoreOnLiveFail,
  selectedFallbackPlan,
  firstListHudPlan,
  firstListHudKickPlan,
  selectedFallbackFetchPlan,
  sleeperPlayerDumpPlan,
  lastHudDiskPlan,
  liveDiskPersistPlan,
  broadcastOrderPlan,
  companionStatePlan,
  companionFlagsUnchanged,
  companionBoardsUnchanged,
  overlayHudPushPlan,
  earlyDiskHudPlan,
  matchupsPersistPlan,
  liveMatchupsPersistPlan,
  matchupsPersistSig,
  espnHudCookiePlan,
  espnHudLikelyPrivate,
  espnUncachedDiscoveryPlan,
  espnCookieRetryAfterScorePlan,
  sleeperLeaguesLoadPlan,
  sleeperLeaguesSwrPlan,
  leagueListFetchPlan,
  matchupsDiskHydratePlan,
  sleeperNamesKickPlan,
  playerDumpDiskPlan,
  sleeperScoreNamePlan,
  sleeperTxNamePlan,
  afterSelectedSettlePlan,
  swrAfterRestPrefetchPlan,
  nflScoreboardKickPlan,
  nflScoreboardSettleOrder,
  leagueListSettlePlan,
  nflStateSwrPlan,
  nflTickStartPlan,
  espnCookieSwrPlan,
  restTxKickPlan,
  tapeFetchPriority,
  backgroundGetPriority,
  sleeperFatSwrPlan,
  sleeperFatSwrPartsPlan,
  sleeperRestNameHydratePlan,
  selectedFallbackJoinPlan,
  sleeperCdnBustToken,
  sleeperMatchupsHoldKey,
  sleeperIdentityHoldKey,
  sleeperMatchupsReusePlan,
  sleeperMatchupsRestJoinHudPlan,
  espnCompactLiveHoldKey,
  espnHoldStaleKeys,
  espnCompactLiveJoinPlan,
  seedScoreboardState,
  peekSettled,
  nflWeekShifted,
  weekShiftKickOrder,
  NFL_DISK_STALE_MS,
  calendarNflFallback,
  nflCalendarSeed,
  espnTeamIdFromMatchup,
  espnTeamIdOf,
  espnTeamFetchKey,
  espnTeamsKickPlan,
  mapSettledLimit,
  splitBoardTargets,
  splitHotCold,
  stubLeagueFromKey,
  hudHintKey,
  pickSelectedLeagueKey,
  settleMatchupPlan,
  seedHudMatchupPlan,
  refreshJoinPlan,
  espnConnectedPlan,
  espnCookiePrimePlan,
  settleSelectedKeyPlan
} from './pollTargets'

describe('calendarNflFallback', () => {
  it('uses the prior calendar year in January and the current year after March', () => {
    expect(calendarNflFallback(new Date('2026-08-31T12:00:00-05:00'))).toEqual({
      week: 1,
      displayWeek: 1,
      season: '2026',
      leagueSeason: '2026',
      seasonType: 'pre'
    })
    expect(calendarNflFallback(new Date('2027-01-15T12:00:00-05:00'))).toEqual({
      week: 1,
      displayWeek: 1,
      season: '2026',
      leagueSeason: '2026',
      seasonType: 'regular'
    })
    expect(calendarNflFallback(new Date('2026-09-14T12:00:00-05:00'))).toEqual({
      week: 1,
      displayWeek: 1,
      season: '2026',
      leagueSeason: '2026',
      seasonType: 'regular'
    })
  })

  it('prefers last-HUD week on a calendar seed so scoring can start without /state/nfl', () => {
    expect(nflCalendarSeed(new Date('2026-08-31T12:00:00-05:00'))).toEqual({
      week: 1,
      displayWeek: 1,
      season: '2026',
      leagueSeason: '2026',
      seasonType: 'pre'
    })
    expect(nflCalendarSeed(new Date('2026-08-31T12:00:00-05:00'), 2)).toEqual({
      week: 2,
      displayWeek: 2,
      season: '2026',
      leagueSeason: '2026',
      seasonType: 'pre'
    })
  })
})

describe('warmupNflCachePlan', () => {
  it('uses calendar week when NFL disk is missing so matchupCache can hydrate before the first poll', () => {
    expect(warmupNflCachePlan({ hasNflDisk: true, replay: false })).toBe('disk')
    expect(warmupNflCachePlan({ hasNflDisk: false, replay: false })).toBe('calendar')
    expect(warmupNflCachePlan({ hasNflDisk: false, replay: true })).toBe('skip')
    expect(warmupNflCachePlan({ hasNflDisk: true, replay: true })).toBe('disk')
  })
})

describe('asNflState', () => {
  it('accepts a complete NFL state and rejects junk', () => {
    expect(
      asNflState({
        week: 1,
        displayWeek: 1,
        season: '2026',
        leagueSeason: '2026',
        seasonType: 'regular'
      })
    ).toEqual({
      week: 1,
      displayWeek: 1,
      season: '2026',
      leagueSeason: '2026',
      seasonType: 'regular'
    })
    expect(asNflState({ week: 1 })).toBeNull()
    expect(asNflState({ week: 1, season: '2026' })).toEqual({
      week: 1,
      displayWeek: 1,
      season: '2026',
      leagueSeason: '2026',
      seasonType: 'regular'
    })
    expect(asNflState(null)).toBeNull()
    expect(
      asNflState({
        week: '1',
        displayWeek: '1',
        season: 2026,
        leagueSeason: 2026,
        seasonType: 'regular'
      })
    ).toEqual({
      week: 1,
      displayWeek: 1,
      season: '2026',
      leagueSeason: '2026',
      seasonType: 'regular'
    })
  })

  it('trusts a disk snapshot inside 12 hours and rejects an older one', () => {
    const nfl = {
      week: 1,
      displayWeek: 1,
      season: '2026',
      leagueSeason: '2026',
      seasonType: 'regular'
    }
    const now = 1_000_000
    expect(nflFromDiskPayload({ at: now - 11 * 60 * 60 * 1000, nfl }, now)).toEqual(nfl)
    expect(nflFromDiskPayload({ at: now - 13 * 60 * 60 * 1000, nfl }, now)).toBeNull()
    expect(nflFromDiskPayload({ at: now - 13 * 60 * 60 * 1000, nfl }, now, NFL_DISK_STALE_MS)).toEqual(nfl)
    expect(nflFromDiskPayload({ at: now - 9 * 24 * 60 * 60 * 1000, nfl }, now, NFL_DISK_STALE_MS)).toBeNull()
    expect(nflFromDiskPayload({ at: now, nfl: { week: 1 } }, now)).toBeNull()
  })
})

describe('espnScoreOverlayPlan', () => {
  it('overlays a same-week cache and only full-refreshes when the 30s boxscore is stale', () => {
    expect(espnScoreOverlayPlan(undefined, 1, 1_000_000, 30_000)).toEqual({ overlay: false, refreshFull: true })
    expect(espnScoreOverlayPlan({ week: 2, at: 1_000_000 }, 1, 1_000_000, 30_000)).toEqual({
      overlay: false,
      refreshFull: true
    })
    expect(espnScoreOverlayPlan({ week: 1, at: 990_000 }, 1, 1_000_000, 30_000)).toEqual({
      overlay: true,
      refreshFull: false
    })
    expect(espnScoreOverlayPlan({ week: 1, at: 960_000 }, 1, 1_000_000, 30_000)).toEqual({
      overlay: true,
      refreshFull: true
    })
  })
})

describe('espnScoreKickOrder', () => {
  it('kicks mMatchupScore first when there is no boxscore overlay', () => {
    expect(espnScoreKickOrder({ hasOverlay: false })).toBe('full-then-live')
  })

  it('kicks mLiveScoring first when last lineup or boxscore can overlay compact live', () => {
    expect(espnScoreKickOrder({ hasOverlay: true })).toBe('live-then-full')
  })
})

describe('liveScorePriority', () => {
  it('marks only the selected HUD scoring GET as Chromium high priority', () => {
    expect(liveScorePriority(true)).toBe('high')
    expect(liveScorePriority(false)).toBeUndefined()
  })
})

describe('restScoreFetchPriority', () => {
  it('marks rest compact scoring low while games are in so it cannot occupy HTTP/2 over HUD', () => {
    expect(restScoreFetchPriority(true)).toBe('low')
    expect(restScoreFetchPriority(false)).toBeUndefined()
  })
})

describe('sleeperIdentityPriority', () => {
  it('keeps cold HUD /rosters and /users below high /matchups', () => {
    expect(sleeperIdentityPriority(true)).toBe('low')
    expect(sleeperIdentityPriority(false)).toBeUndefined()
  })

  it('keeps rest /rosters, /users, and GET /user below HUD /matchups while games are in', () => {
    expect(sleeperIdentityPriority(false, true)).toBe('low')
    expect(sleeperIdentityPriority(false, false)).toBeUndefined()
  })
})

describe('sleeperIdentityTimeoutMs', () => {
  it('aborts cold HUD /rosters, /users, and GET /user at the live poll interval', () => {
    expect(sleeperIdentityTimeoutMs(true, 3_000, 5_000)).toBe(3_000)
    expect(sleeperIdentityTimeoutMs(false, 3_000, 5_000)).toBe(5_000)
  })

  it('aborts rest /rosters, /users, and GET /user at the live poll interval while games are in', () => {
    expect(sleeperIdentityTimeoutMs(false, 3_000, 5_000, true)).toBe(3_000)
    expect(sleeperIdentityTimeoutMs(false, 3_000, 5_000, false)).toBe(5_000)
  })
})

describe('hudScoreFetchTimeoutMs', () => {
  it('aborts HUD scoring at the live poll interval so a hung GET cannot pile into the next tick', () => {
    expect(hudScoreFetchTimeoutMs(3_000)).toBe(3_000)
  })
})

describe('espnLiveFullSwrPlan', () => {
  it('defers mMatchupScore SWR so it cannot start beside compact mLiveScoring', () => {
    expect(
      espnLiveFullSwrPlan({ needsFull: true, liveFailed: false, hasOverlay: true, hud: true })
    ).toBe('defer')
    expect(
      espnLiveFullSwrPlan({ needsFull: false, liveFailed: false, hasOverlay: true, hud: true })
    ).toBe('skip')
    expect(
      espnLiveFullSwrPlan({ needsFull: false, liveFailed: true, hasOverlay: true, hud: true })
    ).toBe('skip')
  })

  it('recovers the selected HUD boxscore immediately when compact live fails or there is no overlay', () => {
    expect(
      espnLiveFullSwrPlan({ needsFull: true, liveFailed: true, hasOverlay: true, hud: true })
    ).toBe('recover')
    expect(
      espnLiveFullSwrPlan({ needsFull: true, liveFailed: false, hasOverlay: false, hud: true })
    ).toBe('recover')
  })

  it('defers rest-of-board mMatchupScore so a true-cold pin cannot pile 40KB beside HUD', () => {
    expect(
      espnLiveFullSwrPlan({ needsFull: true, liveFailed: false, hasOverlay: false, hud: false })
    ).toBe('defer')
    expect(
      espnLiveFullSwrPlan({ needsFull: true, liveFailed: true, hasOverlay: true, hud: false })
    ).toBe('defer')
  })

  it('skips deferred mMatchupScore on a gameday tick so 40KB cannot occupy the rest pool', () => {
    expect(
      espnLiveFullSwrPlan({
        needsFull: true,
        liveFailed: false,
        hasOverlay: true,
        hud: true,
        gamesIn: true
      })
    ).toBe('skip')
    expect(
      espnLiveFullSwrPlan({
        needsFull: true,
        liveFailed: false,
        hasOverlay: false,
        hud: false,
        gamesIn: true
      })
    ).toBe('skip')
    expect(
      espnLiveFullSwrPlan({
        needsFull: true,
        liveFailed: true,
        hasOverlay: true,
        hud: true,
        gamesIn: true
      })
    ).toBe('recover')
    expect(
      espnLiveFullSwrPlan({
        needsFull: false,
        liveFailed: false,
        hasOverlay: true,
        hud: true,
        gamesIn: true,
        compactIsStub: true
      })
    ).toBe('recover')
  })

  it('recovers HUD mScoreboard when overlay cache has no named starters', () => {
    expect(
      espnLiveFullSwrPlan({
        needsFull: false,
        liveFailed: false,
        hasOverlay: true,
        hud: true,
        gamesIn: true,
        hasNamedLineup: false
      })
    ).toBe('recover')
    expect(
      espnLiveFullSwrPlan({
        needsFull: false,
        liveFailed: false,
        hasOverlay: true,
        hud: true,
        gamesIn: true,
        hasNamedLineup: true
      })
    ).toBe('skip')
  })
})

describe('espnDeferredBoxscoreDrainPlan', () => {
  it('holds leftover idle mMatchupScore ids on a live tick so fat SWR cannot drain 40KB beside HUD', () => {
    expect(espnDeferredBoxscoreDrainPlan(true)).toBe('hold')
    expect(espnDeferredBoxscoreDrainPlan(false)).toBe('drain')
  })
})

describe('espnScoreRefreshKey', () => {
  it('lets rest deferred mMatchupScore join an in-flight HUD recover for the same auth and team filter', () => {
    const publicHud = espnScoreRefreshKey({
      leagueId: '99',
      week: 1,
      hasCookies: false,
      hud: true,
      teamId: 7
    })
    const authHud = espnScoreRefreshKey({
      leagueId: '99',
      week: 1,
      hasCookies: true,
      hud: true,
      teamId: 7
    })
    const publicRest = espnScoreRefreshKey({
      leagueId: '99',
      week: 1,
      hasCookies: false,
      hud: false,
      teamId: 7
    })
    const weekWide = espnScoreRefreshKey({
      leagueId: '99',
      week: 1,
      hasCookies: true,
      hud: true,
      teamId: null
    })
    expect(publicHud).toBe(publicRest)
    expect(publicHud).not.toBe(authHud)
    expect(authHud).not.toBe(weekWide)
  })
})

describe('espnBoxscoreSwrFreshPlan', () => {
  it('skips a second mMatchupScore when HUD recover already wrote this week', () => {
    expect(
      espnBoxscoreSwrFreshPlan({
        cachedWeek: 1,
        week: 1,
        cachedAt: 1_000,
        now: 2_000,
        ttlMs: 30_000
      })
    ).toBe('use-cache')
    expect(
      espnBoxscoreSwrFreshPlan({
        cachedWeek: 1,
        week: 1,
        cachedAt: 1_000,
        now: 40_000,
        ttlMs: 30_000
      })
    ).toBe('fetch')
    expect(
      espnBoxscoreSwrFreshPlan({
        cachedWeek: 1,
        week: 2,
        cachedAt: 1_000,
        now: 2_000,
        ttlMs: 30_000
      })
    ).toBe('fetch')
  })
})

describe('espnBoxscoreRecoverStale', () => {
  it('drops a public recover after a cookie compact retry starts', () => {
    expect(espnBoxscoreRecoverStale({ startedGen: 1, currentGen: 1 })).toBe(false)
    expect(espnBoxscoreRecoverStale({ startedGen: 1, currentGen: 2 })).toBe(true)
  })
})

describe('espnDeferredBoxscorePriority', () => {
  it('keeps deferred mMatchupScore below the next compact scoring GET', () => {
    expect(espnDeferredBoxscorePriority()).toBe('low')
  })
})

describe('espnFullSwrPaintPlan', () => {
  const hud = {
    myTeam: { id: '1', name: 'Mine', owner: 'Me', record: '1-0' },
    oppTeam: { id: '2', name: 'Yours', owner: 'You', record: '0-1' },
    myPoints: 12.5,
    oppPoints: 9,
    starters: [],
    bench: [],
    oppStarters: [],
    oppBench: []
  }

  it('keeps compact live scores when a deferred boxscore has no live overlay', () => {
    expect(
      espnFullSwrPaintPlan({ prev: hud, overlaid: { ...hud, myPoints: 14 }, parsed: { ...hud, myPoints: 0 } })
        ?.myPoints
    ).toBe(14)
    expect(espnFullSwrPaintPlan({ prev: hud, overlaid: null, parsed: { ...hud, myPoints: 0 } })).toBeNull()
    expect(espnFullSwrPaintPlan({ prev: null, overlaid: null, parsed: hud })).toBe(hud)
    const etheridge = {
      ...hud,
      myTeam: { id: '8', name: 'Team Etheridge', owner: 'Kevin', record: '1-0' },
      starters: [{ playerId: '3139477', name: 'Patrick Mahomes', position: 'QB', nflTeam: 'KC', points: 12 }]
    }
    expect(
      espnFullSwrPaintPlan({
        prev: hud,
        overlaid: hud,
        parsed: etheridge
      })
    ).toBe(etheridge)
  })
})

describe('espnTeamIdLookupPlan', () => {
  it('prefers a SWID-matched team over last HUD numeric id; empty lineups stay on the week filter', () => {
    expect(
      espnTeamIdLookupPlan({
        swidTeamId: 8,
        fromMatchup: 1,
        matchupHasLineup: true,
        memoryHasTeams: true
      })
    ).toBe('swid')
    expect(
      espnTeamIdLookupPlan({ fromMatchup: 7, matchupHasLineup: true, memoryHasTeams: true })
    ).toBe('matchup')
    expect(
      espnTeamIdLookupPlan({ fromMatchup: 1, matchupHasLineup: false, memoryHasTeams: true })
    ).toBe('memory')
    expect(espnTeamIdLookupPlan({ fromMatchup: undefined, memoryHasTeams: true })).toBe('memory')
    expect(espnTeamIdLookupPlan({ fromMatchup: undefined, memoryHasTeams: false })).toBe('week-filter')
    expect(
      espnTeamIdLookupPlan({ fromMatchup: 1, matchupHasLineup: false, memoryHasTeams: false })
    ).toBe('week-filter')
  })
})

describe('espnLiveOverlayCachePlan', () => {
  it('overlays compact mLiveScoring onto last HUD instead of merging the in-memory boxscore', () => {
    expect(espnLiveOverlayCachePlan({ cachedAtKick: true, cachedAfterLive: true })).toBe('at-kick')
    expect(espnLiveOverlayCachePlan({ cachedAtKick: false, cachedAfterLive: true })).toBe('after-live')
    expect(espnLiveOverlayCachePlan({ cachedAtKick: false, cachedAfterLive: false })).toBe('matchup')
    expect(
      espnLiveOverlayCachePlan({ cachedAtKick: true, cachedAfterLive: true, hasPrevMatchup: true })
    ).toBe('matchup')
  })
})

describe('espnLiveDiskHydratePlan', () => {
  it('does not parse ESPN scores disk beside mLiveScoring, including overlay onto last HUD', () => {
    expect(espnLiveDiskHydratePlan({ cachedAtKick: true })).toBe('skip')
    expect(espnLiveDiskHydratePlan({ cachedAtKick: false })).toBe('after-live')
    expect(espnLiveDiskHydratePlan({ cachedAtKick: false, hasPrevMatchup: true })).toBe('skip')
  })
})

describe('espnTeamsHydrateAfterScorePlan', () => {
  it('does not parse ESPN teams disk before overlay paint', () => {
    expect(
      espnTeamsHydrateAfterScorePlan({ overlayFromMatchup: true, memoryHasTeams: false })
    ).toBe('skip')
    expect(
      espnTeamsHydrateAfterScorePlan({ overlayFromMatchup: false, memoryHasTeams: true })
    ).toBe('skip')
    expect(
      espnTeamsHydrateAfterScorePlan({ overlayFromMatchup: false, memoryHasTeams: false })
    ).toBe('after-live')
    expect(
      espnTeamsHydrateAfterScorePlan({ overlayFromMatchup: false, memoryHasTeams: false, hasTeamId: true })
    ).toBe('skip')
  })
})

describe('espnHudFromScorePlan', () => {
  it('overlays onto last scores only for a live-only payload, not a cached boxscore', () => {
    expect(espnHudFromScorePlan({ hasPrevMatchup: true, overlayFromMatchup: true })).toBe('overlay-matchup')
    expect(espnHudFromScorePlan({ hasPrevMatchup: true, overlayFromMatchup: false })).toBe('parse-payload')
    expect(espnHudFromScorePlan({ hasPrevMatchup: false, overlayFromMatchup: true })).toBe('parse-payload')
    expect(espnHudFromScorePlan({ hasPrevMatchup: false, overlayFromMatchup: false })).toBe('parse-payload')
    expect(
      espnHudFromScorePlan({ hasPrevMatchup: true, overlayFromMatchup: true, prevHasLineup: false })
    ).toBe('parse-payload')
  })
})

describe('espnOverlayPtsPlan', () => {
  it('trusts compact mLiveScoring overlay and maxes a deferred boxscore against last HUD', () => {
    expect(espnOverlayPtsPlan(true)).toBe('trust-live')
    expect(espnOverlayPtsPlan(false)).toBe('max-prev')
  })
})

describe('espnBoxscoreSwrPtsPlan', () => {
  it('merges compact live onto deferred mMatchupScore; recover paints boxscore; otherwise keeps last HUD', () => {
    expect(espnBoxscoreSwrPtsPlan({ hasCompactLive: true, recover: false })).toBe('merge-compact')
    expect(espnBoxscoreSwrPtsPlan({ hasCompactLive: true, recover: true })).toBe('merge-compact')
    expect(espnBoxscoreSwrPtsPlan({ hasCompactLive: false, recover: true })).toBe('boxscore')
    expect(espnBoxscoreSwrPtsPlan({ hasCompactLive: false, recover: false })).toBe('keep-prev')
  })
})

describe('espnTxKickOrder', () => {
  it('returns mTransactions2 first and only SWR-refreshes kona when cookies exist', () => {
    expect(espnTxKickOrder(true)).toBe('tx-then-swr-activity')
    expect(espnTxKickOrder(false)).toBe('tx-only')
  })
})

describe('espnTxCookieRetryPlan', () => {
  it('does not wait on cookie IPC; retries private tape only when the peek had no session', () => {
    expect(espnTxCookieRetryPlan({ cookiePlan: 'cached', peekedCookies: true })).toBe('skip-retry')
    expect(espnTxCookieRetryPlan({ cookiePlan: 'kick-then-refresh', peekedCookies: true })).toBe(
      'skip-retry'
    )
    expect(espnTxCookieRetryPlan({ cookiePlan: 'kick-then-refresh', peekedCookies: false })).toBe(
      'retry-when-cookies'
    )
    expect(espnTxCookieRetryPlan({ cookiePlan: 'await-cookies', peekedCookies: false })).toBe(
      'skip-retry'
    )
    expect(
      espnTxCookieRetryPlan({ cookiePlan: 'kick-then-refresh', peekedCookies: false, publicHit: true })
    ).toBe('skip-retry')
  })
})

describe('selectedFallbackPlan', () => {
  it('kicks the selected live GET only when the HUD hint did not cover that league', () => {
    expect(
      selectedFallbackPlan({ hasSelected: true, selectedReady: false, earlyTriedSame: false })
    ).toBe('kick')
    expect(
      selectedFallbackPlan({ hasSelected: true, selectedReady: true, earlyTriedSame: false })
    ).toBe('skip')
    expect(
      selectedFallbackPlan({ hasSelected: true, selectedReady: false, earlyTriedSame: true })
    ).toBe('skip')
    expect(
      selectedFallbackPlan({ hasSelected: false, selectedReady: false, earlyTriedSame: false })
    ).toBe('skip')
  })
})

describe('firstListHudPlan', () => {
  it('starts scoring from the first league list that returns when there is no HUD hint', () => {
    expect(firstListHudPlan({ hasHint: false, hasHud: false })).toBe('kick-on-list')
    expect(firstListHudPlan({ hasHint: true, hasHud: false })).toBe('skip')
    expect(firstListHudPlan({ hasHint: false, hasHud: true })).toBe('skip')
  })
})

describe('firstListHudKickPlan', () => {
  it('kicks only the first list that has a live league and skips the other provider', () => {
    expect(
      firstListHudKickPlan({ alreadyKicked: false, hasHud: false, hasLiveLeague: true })
    ).toBe('kick')
    expect(
      firstListHudKickPlan({ alreadyKicked: true, hasHud: false, hasLiveLeague: true })
    ).toBe('skip')
    expect(
      firstListHudKickPlan({ alreadyKicked: false, hasHud: true, hasLiveLeague: true })
    ).toBe('skip')
    expect(
      firstListHudKickPlan({ alreadyKicked: false, hasHud: false, hasLiveLeague: false })
    ).toBe('skip')
  })
})

describe('selectedFallbackFetchPlan', () => {
  it('uses kick-then-refresh cookies for ESPN and waits on the Sleeper user when needed', () => {
    expect(selectedFallbackFetchPlan('espn')).toBe('espn-cookies')
    expect(selectedFallbackFetchPlan('sleeper')).toBe('sleeper')
  })
})

describe('selectedFallbackJoinPlan', () => {
  it('does not join a rest-priority compact GET for selected HUD', () => {
    expect(selectedFallbackJoinPlan(true)).toBe('kick')
    expect(selectedFallbackJoinPlan(false)).toBe('kick')
  })
})

describe('restHudJoinPlan', () => {
  it('lets rest join an in-flight HUD compact GET and starts HUD when rest is already in flight', () => {
    expect(restHudJoinPlan({ hasInFlight: false, inFlightIsHud: false, hud: true })).toBe('kick')
    expect(restHudJoinPlan({ hasInFlight: true, inFlightIsHud: true, hud: true })).toBe('join')
    expect(restHudJoinPlan({ hasInFlight: true, inFlightIsHud: false, hud: true })).toBe('kick')
    expect(restHudJoinPlan({ hasInFlight: true, inFlightIsHud: true, hud: false })).toBe('join')
    expect(restHudJoinPlan({ hasInFlight: true, inFlightIsHud: false, hud: false })).toBe('join')
  })
})

describe('restPrefetchGate', () => {
  it('starts rest after HUD when a hint key exists (selected, last HUD, or pin); otherwise waits for discovery', () => {
    expect(restPrefetchGate('sleeper:11')).toBe('now')
    expect(restPrefetchGate('espn:899513')).toBe('now')
    expect(restPrefetchGate(null)).toBe('after-selected')
  })
})

describe('swrAfterRestPrefetchPlan', () => {
  it('holds the player dump and league SWR until rest-of-board scoring finishes when rest was kicked', () => {
    expect(swrAfterRestPrefetchPlan(true)).toBe('after-rest')
    expect(swrAfterRestPrefetchPlan(false)).toBe('now')
  })
})

describe('nflScoreboardKickPlan', () => {
  it('holds the 251KB NFL scoreboard until pinned rest scoring finishes, not cold boards', () => {
    expect(nflScoreboardKickPlan()).toBe('after-pinned')
    expect(nflScoreboardKickPlan(false)).toBe('after-pinned')
  })

  it('starts the scoreboard after HUD on a gameday tick so a Sunday open does not wait on pinned boards', () => {
    expect(nflScoreboardKickPlan(true)).toBe('after-hud')
    expect(nflScoreboardSettleOrder('after-hud')).toBe('before-lists')
    expect(nflScoreboardSettleOrder('after-pinned')).toBe('after-pinned-rest')
  })
})

describe('leagueListSettlePlan', () => {
  it('peeks last LEAGUES on a live tick instead of awaiting discovery or cookie IPC', () => {
    expect(leagueListSettlePlan({ liveTick: true, hasLastLeagues: true })).toBe('peek-last')
    expect(leagueListSettlePlan({ liveTick: true, hasLastLeagues: false })).toBe('await')
    expect(leagueListSettlePlan({ liveTick: false, hasLastLeagues: true })).toBe('await')
    expect(
      leagueListSettlePlan({ liveTick: true, hasLastLeagues: true, waitForBoards: true })
    ).toBe('await')
  })
})

describe('nflStateSwrPlan', () => {
  it('does not start GET /state/nfl beside HUD scoring when the 60s cache is fresh', () => {
    expect(nflStateSwrPlan({ fresh: true })).toBe('return')
    expect(nflStateSwrPlan({ fresh: false })).toBe('swr')
  })

  it('skips /state/nfl on live ticks when the cached week already matches the calendar', () => {
    expect(
      nflStateSwrPlan({ fresh: false, liveTick: true, cachedWeek: 1, calendarWeek: 1 })
    ).toBe('return')
    expect(
      nflStateSwrPlan({ fresh: false, liveTick: true, cachedWeek: 18, calendarWeek: 1 })
    ).toBe('swr')
    expect(
      nflStateSwrPlan({ fresh: false, liveTick: false, cachedWeek: 1, calendarWeek: 1 })
    ).toBe('swr')
  })
})

describe('nflTickStartPlan', () => {
  it('peeks cached NFL week synchronously so scoring GETs are not gated on an await', () => {
    expect(nflTickStartPlan()).toBe('peek')
  })
})

describe('espnCookieSwrPlan', () => {
  it('does not start cookie IPC beside HUD scoring when the 60s session cache is fresh', () => {
    expect(espnCookieSwrPlan({ fresh: true })).toBe('return')
    expect(espnCookieSwrPlan({ fresh: false })).toBe('swr')
  })

  it('skips cookie IPC on live ticks when espn_s2 is already cached', () => {
    expect(espnCookieSwrPlan({ fresh: false, liveTick: true, hasSession: true })).toBe('return')
    expect(espnCookieSwrPlan({ fresh: false, liveTick: true, hasSession: false })).toBe('swr')
    expect(espnCookieSwrPlan({ fresh: false, liveTick: false, hasSession: true })).toBe('swr')
  })
})

describe('restTxKickPlan', () => {
  it('starts selected and pinned transactions after pinned scoring while idle, and skips them while games are live', () => {
    expect(restTxKickPlan()).toBe('after-pinned')
    expect(restTxKickPlan(false)).toBe('after-pinned')
    expect(restTxKickPlan(true)).toBe('skip')
  })
})

describe('tapeFetchPriority', () => {
  it('keeps waiver tape below the next compact scoring GET', () => {
    expect(tapeFetchPriority()).toBe('low')
  })
})

describe('backgroundGetPriority', () => {
  it('keeps identity, discovery, and NFL state SWR below compact scoring', () => {
    expect(backgroundGetPriority()).toBe('low')
  })
})

describe('sleeperFatSwrPlan', () => {
  it('holds GET /user, roster SWR, and /players/nfl until transactions return', () => {
    expect(sleeperFatSwrPlan()).toBe('after-tx')
  })
})

describe('sleeperFatSwrPartsPlan', () => {
  it('skips league discovery, roster SWR, GET /user, and the player dump while games are live', () => {
    expect(sleeperFatSwrPartsPlan({ liveTick: false, hasPlayerPeek: true })).toEqual({
      user: true,
      roster: true,
      names: true,
      leagues: true
    })
    expect(sleeperFatSwrPartsPlan({ liveTick: true, hasPlayerPeek: true })).toEqual({
      user: false,
      roster: false,
      names: false,
      leagues: false
    })
    expect(sleeperFatSwrPartsPlan({ liveTick: true, hasPlayerPeek: false })).toEqual({
      user: false,
      roster: false,
      names: false,
      leagues: false
    })
  })

  it('still kicks league discovery on a live tick when Sleeper or ESPN has no list in memory', () => {
    expect(
      sleeperFatSwrPartsPlan({
        liveTick: true,
        hasPlayerPeek: true,
        hasSleeperLeagues: false,
        hasEspnLeagues: true
      }).leagues
    ).toBe(true)
    expect(
      sleeperFatSwrPartsPlan({
        liveTick: true,
        hasPlayerPeek: true,
        hasSleeperLeagues: true,
        hasEspnLeagues: false
      }).leagues
    ).toBe(true)
    expect(
      sleeperFatSwrPartsPlan({
        liveTick: true,
        hasPlayerPeek: true,
        hasSleeperLeagues: true,
        hasEspnLeagues: true
      }).leagues
    ).toBe(false)
  })
})

describe('espnScoreOnLiveFail', () => {
  it('keeps the cached overlay on screen and does not hold the HUD on the full boxscore', () => {
    const cached = { schedule: [{ matchupPeriodId: 1 }] }
    const pending = Promise.resolve({ schedule: [] })
    expect(espnScoreOnLiveFail(cached, pending)).toEqual({ payload: cached, pendingFull: pending })
    expect(espnScoreOnLiveFail(cached, null)).toEqual({ payload: cached, pendingFull: null })
  })
})

describe('lastHudDiskPlan', () => {
  it('reads last HUD from disk once, then peeks memory on later ticks', () => {
    expect(lastHudDiskPlan(false)).toBe('disk')
    expect(lastHudDiskPlan(true)).toBe('memory')
  })
})

describe('liveDiskPersistPlan', () => {
  it('does not JSON.stringify last HUD, ESPN boxscore, Sleeper rosters, or LEAGUES matchups before overlay paint', () => {
    expect(liveDiskPersistPlan()).toBe('after-paint')
  })
})

describe('broadcastOrderPlan', () => {
  it('pushes overlay HUD before the companion AppState clone', () => {
    expect(broadcastOrderPlan()).toBe('hud-then-state')
  })
})

describe('companionStatePlan', () => {
  it('patches live scores without cloning overlay layout or connection flags', () => {
    expect(
      companionStatePlan({ overlaySkipped: false, flagsUnchanged: true, boardsUnchanged: true })
    ).toBe('hud')
  })

  it('sends a 3-field tick when overlay skipped and boards/flags did not change', () => {
    expect(
      companionStatePlan({ overlaySkipped: true, flagsUnchanged: true, boardsUnchanged: true })
    ).toBe('tick')
  })

  it('patches boards without cloning HUD matchup when rest LEAGUES change', () => {
    expect(
      companionStatePlan({ overlaySkipped: true, flagsUnchanged: true, boardsUnchanged: false })
    ).toBe('boards')
  })

  it('still clones AppState when connection or overlay window flags change', () => {
    expect(
      companionStatePlan({ overlaySkipped: true, flagsUnchanged: false, boardsUnchanged: true })
    ).toBe('after-hud')
    expect(
      companionStatePlan({ overlaySkipped: false, flagsUnchanged: false, boardsUnchanged: true })
    ).toBe('after-hud')
  })
})

describe('companionFlagsUnchanged', () => {
  it('ignores lastUpdated so a no-op 3s tick does not clone AppState', () => {
    const prev = emptyAppState()
    expect(companionFlagsUnchanged(prev, { ...prev, lastUpdated: 2, pollMs: 12, liveCallMs: 40 })).toBe(
      true
    )
  })

  it('treats a pairing-code rotation as a companion clone', () => {
    const prev = emptyAppState()
    expect(companionFlagsUnchanged(prev, { ...prev, overlayPairingCode: '418302' })).toBe(false)
  })
})

describe('companionBoardsUnchanged', () => {
  it('treats a new boards array as a boards patch', () => {
    const prev = emptyAppState()
    expect(companionBoardsUnchanged(prev, { ...prev, boards: [] })).toBe(false)
  })
})

describe('overlayHudPushPlan', () => {
  it('skips overlay IPC when HUD scores, tape, and ticker did not change', () => {
    expect(overlayHudPushPlan(true)).toBe('skip')
    expect(overlayHudPushPlan(false)).toBe('push')
  })
})

describe('earlyDiskHudPlan', () => {
  it('skips a last-HUD rebroadcast when scores are already on screen', () => {
    expect(earlyDiskHudPlan({ hasDiskHud: true, alreadyShowing: true })).toBe('skip')
    expect(earlyDiskHudPlan({ hasDiskHud: false, alreadyShowing: false })).toBe('skip')
    expect(earlyDiskHudPlan({ hasDiskHud: true, alreadyShowing: false })).toBe('paint')
  })
})

describe('matchupsPersistPlan', () => {
  it('skips a matchup disk write when the score line is unchanged', () => {
    const sig = matchupsPersistSig(1, [
      { key: 'espn:2', myPoints: 10, oppPoints: 8, starterSig: 'a:1' },
      { key: 'sleeper:1', myPoints: 12, oppPoints: 9, starterSig: 'b:2' }
    ])
    expect(sig).toBe(
      matchupsPersistSig(1, [
        { key: 'sleeper:1', myPoints: 12, oppPoints: 9, starterSig: 'b:2' },
        { key: 'espn:2', myPoints: 10, oppPoints: 8, starterSig: 'a:1' }
      ])
    )
    expect(matchupsPersistPlan(sig, sig)).toBe('skip')
    expect(matchupsPersistPlan(sig, '')).toBe('write')
  })
})

describe('liveMatchupsPersistPlan', () => {
  it('skips rewriting matchup, ESPN boxscore/teams, and Sleeper roster snapshots on a gameday tick', () => {
    expect(liveMatchupsPersistPlan(true)).toBe('skip')
    expect(liveMatchupsPersistPlan(false)).toBe('after-paint')
  })
})

describe('sleeperPlayerDumpPlan', () => {
  it('reuses a warm peek, joins an in-flight dump, and cools down after a failure', () => {
    expect(
      sleeperPlayerDumpPlan({ peekedCount: 12, inflight: false, lastFailAt: null, now: 1_000, cooldownMs: 60_000 })
    ).toBe('peek')
    expect(
      sleeperPlayerDumpPlan({ peekedCount: 0, inflight: true, lastFailAt: null, now: 1_000, cooldownMs: 60_000 })
    ).toBe('join-inflight')
    expect(
      sleeperPlayerDumpPlan({ peekedCount: 0, inflight: false, lastFailAt: 950_000, now: 1_000_000, cooldownMs: 60_000 })
    ).toBe('skip-cooldown')
    expect(
      sleeperPlayerDumpPlan({ peekedCount: 0, inflight: false, lastFailAt: 900_000, now: 1_000_000, cooldownMs: 60_000 })
    ).toBe('fetch')
    expect(
      sleeperPlayerDumpPlan({
        peekedCount: 12,
        cacheFresh: false,
        liveTick: true,
        inflight: false,
        lastFailAt: null,
        now: 1_000,
        cooldownMs: 60_000
      })
    ).toBe('peek')
    expect(
      sleeperPlayerDumpPlan({
        peekedCount: 0,
        liveTick: true,
        inflight: false,
        lastFailAt: null,
        now: 1_000,
        cooldownMs: 60_000
      })
    ).toBe('peek')
    expect(
      sleeperPlayerDumpPlan({
        peekedCount: 12,
        cacheFresh: false,
        liveTick: false,
        inflight: false,
        lastFailAt: null,
        now: 1_000,
        cooldownMs: 60_000
      })
    ).toBe('fetch')
  })
})

describe('espnTeamsFromDiskPayload', () => {
  it('trusts owner maps for a week and rejects junk or stale files', () => {
    const now = 1_000_000
    const byId = { '899513': [{ id: 1, primaryOwner: '{abc}' }] }
    expect(espnTeamsFromDiskPayload({ at: now, byId }, now)).toEqual(byId)
    expect(espnTeamsFromDiskPayload({ at: now - 8 * 24 * 60 * 60 * 1000, byId }, now)).toBeNull()
    expect(espnTeamsFromDiskPayload({ at: now, byId: { '1': 'nope' } }, now)).toBeNull()
  })
})

describe('espnScoresFromDiskPayload', () => {
  it('trusts a same-week boxscore snapshot and rejects stale or junk files', () => {
    const now = 1_000_000
    const payload = { schedule: [{ matchupPeriodId: 1, home: { teamId: 7 } }] }
    expect(espnScoresFromDiskPayload({ at: now, byId: { '99': { week: 1, payload } } }, now)).toEqual({
      '99': { week: 1, payload }
    })
    expect(
      espnScoresFromDiskPayload({ at: now - 13 * 60 * 60 * 1000, byId: { '99': { week: 1, payload } } }, now)
    ).toBeNull()
    expect(espnScoresFromDiskPayload({ at: now, byId: { '99': { week: 1, payload: [] } } }, now)).toBeNull()
    expect(espnScoresFromDiskPayload({ at: now, byId: { '99': { week: '1', payload } } }, now)).toEqual({
      '99': { week: 1, payload }
    })
  })
})

describe('sleeperRostersFromDiskPayload', () => {
  it('trusts roster+user snapshots and rejects stale or incomplete files', () => {
    const now = 1_000_000
    const rosters = [{ roster_id: 1, owner_id: 'u1' }]
    const users = [{ user_id: 'u1', display_name: 'Me' }]
    const parsed = sleeperRostersFromDiskPayload({ at: now, byId: { abc: { rosters, users } } }, now)
    expect(parsed?.abc.rosters).toEqual([
      {
        roster_id: 1,
        owner_id: 'u1',
        co_owners: null,
        players: undefined,
        starters: undefined,
        settings: undefined
      }
    ])
    expect(parsed?.abc.users).toEqual([{ user_id: 'u1', display_name: 'Me', metadata: null }])
    expect(
      sleeperRostersFromDiskPayload(
        { at: now - 13 * 60 * 60 * 1000, byId: { abc: { rosters, users } } },
        now
      )
    ).toBeNull()
    expect(
      sleeperRostersFromDiskPayload({ at: now, byId: { abc: { rosters: [], users } } }, now)
    ).toBeNull()
    expect(
      sleeperRostersFromDiskPayload({ at: now, byId: { abc: { rosters, users: [{ display_name: 'x' }] } } }, now)
    ).toBeNull()
    expect(
      sleeperRostersFromDiskPayload(
        {
          at: now,
          byId: {
            abc: {
              rosters: [{ roster_id: '1', owner_id: 11 }],
              users: [{ user_id: 11, display_name: 'Me' }]
            }
          }
        },
        now
      )
    ).toEqual({
      abc: {
        rosters: [
          {
            roster_id: 1,
            owner_id: '11',
            co_owners: null,
            players: undefined,
            starters: undefined,
            settings: undefined
          }
        ],
        users: [{ user_id: '11', display_name: 'Me', metadata: null }]
      }
    })
  })
})

describe('sleeperRosterOverlayPlan', () => {
  it('overlays cached rosters and refreshes when the 5 min TTL has elapsed', () => {
    expect(sleeperRosterOverlayPlan(undefined, 1000, 300_000)).toEqual({ overlay: false, refresh: true })
    expect(sleeperRosterOverlayPlan({ at: 1000 }, 2000, 300_000)).toEqual({ overlay: true, refresh: false })
    expect(sleeperRosterOverlayPlan({ at: 1000 }, 1000 + 300_000, 300_000)).toEqual({ overlay: true, refresh: true })
  })
})

describe('sleeperOverlayRosterSwrPlan', () => {
  it('holds roster/user GETs off the scoring path until rest-of-board finishes', () => {
    expect(sleeperOverlayRosterSwrPlan(true)).toBe('defer')
    expect(sleeperOverlayRosterSwrPlan(false)).toBe('skip')
  })
})

describe('sleeperColdHudPlan', () => {
  it('overlays /matchups onto last HUD when rosters are not cached yet', () => {
    expect(sleeperColdHudPlan(true)).toBe('overlay-then-identity')
    expect(sleeperColdHudPlan(false)).toBe('await-all')
  })
})

describe('sleeperHudScorePlan', () => {
  it('overlays last HUD before rebuilding from roster disk and the player dump', () => {
    expect(sleeperHudScorePlan({ hasPrevMatchup: true, hasRosterCache: true })).toBe('overlay-prev')
    expect(sleeperHudScorePlan({ hasPrevMatchup: true, hasRosterCache: false })).toBe('overlay-prev')
    expect(sleeperHudScorePlan({ hasPrevMatchup: false, hasRosterCache: true })).toBe('rebuild-cached')
    expect(sleeperHudScorePlan({ hasPrevMatchup: false, hasRosterCache: false })).toBe('await-all')
  })
})

describe('sleeperOverlayMissPlan', () => {
  it('keeps last HUD when /matchups is empty so identity GETs cannot follow a CDN miss', () => {
    expect(sleeperOverlayMissPlan({ hasOverlay: true, matchupCount: 2, hasPrev: true })).toBe('overlay')
    expect(sleeperOverlayMissPlan({ hasOverlay: false, matchupCount: 0, hasPrev: true })).toBe('keep-prev')
    expect(sleeperOverlayMissPlan({ hasOverlay: false, matchupCount: 2, hasPrev: true })).toBe('rebuild')
    expect(sleeperOverlayMissPlan({ hasOverlay: false, matchupCount: 0, hasPrev: false })).toBe('rebuild')
  })
})

describe('sleeperRosterDiskPlan', () => {
  it('does not parse sleeper roster disk beside a true-cold /matchups GET', () => {
    expect(sleeperRosterDiskPlan('await-all')).toBe('skip')
    expect(sleeperRosterDiskPlan('overlay-prev')).toBe('after-fetch')
    expect(sleeperRosterDiskPlan('rebuild-cached')).toBe('after-fetch')
  })
})

describe('sleeperPrevMatchup', () => {
  const hud = {
    myTeam: { id: '1', name: 'Mine', owner: 'Me', record: '0-0' },
    oppTeam: null,
    myPoints: 10,
    oppPoints: 0,
    starters: [],
    bench: [],
    oppStarters: [],
    oppBench: []
  }
  const cached = { ...hud, myPoints: 8 }

  it('uses the selected HUD when the week still matches', () => {
    expect(
      sleeperPrevMatchup({
        leagueKey: 'sleeper:1',
        selectedKey: 'sleeper:1',
        hud,
        hudWeek: 1,
        week: 1,
        cached
      })
    ).toBe(hud)
  })

  it('uses matchupCache for rest-of-board and after a week mismatch', () => {
    expect(
      sleeperPrevMatchup({
        leagueKey: 'sleeper:2',
        selectedKey: 'sleeper:1',
        hud,
        hudWeek: 1,
        week: 1,
        cached
      })
    ).toBe(cached)
    expect(
      sleeperPrevMatchup({
        leagueKey: 'sleeper:1',
        selectedKey: 'sleeper:1',
        hud,
        hudWeek: 1,
        week: 2,
        cached
      })
    ).toBe(cached)
    expect(
      sleeperPrevMatchup({
        leagueKey: 'sleeper:1',
        selectedKey: 'sleeper:1',
        hud,
        hudWeek: 1,
        week: 1,
        cached: null
      })
    ).toBe(hud)
  })
})

describe('sleeperUserSwrPlan', () => {
  it('uses a persisted user_id without GET /user until after rest scoring', () => {
    expect(sleeperUserSwrPlan({ hasVerifiedUser: true, hasCachedId: true })).toBe('return')
    expect(sleeperUserSwrPlan({ hasVerifiedUser: false, hasCachedId: true })).toBe('defer-swr')
    expect(sleeperUserSwrPlan({ hasVerifiedUser: false, hasCachedId: false })).toBe('await-fetch')
  })
})

describe('sleeperUserFetchJoinPlan', () => {
  it('joins an in-flight GET /user so idle SWR cannot open a second lookup', () => {
    expect(sleeperUserFetchJoinPlan(false)).toBe('kick')
    expect(sleeperUserFetchJoinPlan(true)).toBe('join')
  })
})

describe('sleeperUserFromSettings', () => {
  it('hydrates a Sleeper user from the persisted id so /matchups can start without GET /user', () => {
    expect(sleeperUserFromSettings({ username: 'bob', userId: '12345' })).toEqual({
      user_id: '12345',
      username: 'bob'
    })
    expect(sleeperUserFromSettings({ username: 'bob', userId: null })).toBeNull()
    expect(sleeperUserFromSettings({ username: null, userId: '12345' })).toBeNull()
  })
})

describe('sleeperUserHudPlan', () => {
  it('does not await GET /user before HUD when the id is already peeked or the HUD is ESPN', () => {
    expect(sleeperUserHudPlan({ sleeperHud: true, hasUser: true })).toBe('now')
    expect(sleeperUserHudPlan({ sleeperHud: false, hasUser: false })).toBe('now')
    expect(sleeperUserHudPlan({ sleeperHud: true, hasUser: false })).toBe('await-user')
  })

  it('does not await GET /user before HUD when last scores can overlay /matchups', () => {
    expect(sleeperUserHudPlan({ sleeperHud: true, hasUser: false, hasPrevMatchup: true })).toBe('now')
  })
})

describe('holdForSelectedLive', () => {
  it('only blocks the next poll on the selected live GET when the HUD is empty or the caller asked to wait', () => {
    expect(holdForSelectedLive({ hasHud: true, waitForBoards: false, replay: false })).toBe(false)
    expect(holdForSelectedLive({ hasHud: false, waitForBoards: false, replay: false })).toBe(true)
    expect(holdForSelectedLive({ hasHud: true, waitForBoards: true, replay: false })).toBe(true)
    expect(holdForSelectedLive({ hasHud: true, waitForBoards: false, replay: true })).toBe(true)
  })
})

describe('espnHudCookiePlan', () => {
  it('starts ESPN scoring immediately when cookies are cached', () => {
    expect(espnHudCookiePlan({ cookieCacheReady: true, likelyPrivate: true })).toBe('cached')
    expect(espnHudCookiePlan({ cookieCacheReady: true, likelyPrivate: false })).toBe('cached')
  })

  it('awaits in-flight cookie IPC for a likely-private league instead of a 401 then retry', () => {
    expect(espnHudCookiePlan({ cookieCacheReady: false, likelyPrivate: true })).toBe('await-cookies')
  })

  it('kicks a public GET first when the league is not known to be private', () => {
    expect(espnHudCookiePlan({ cookieCacheReady: false, likelyPrivate: false })).toBe('kick-then-refresh')
  })
})

describe('espnHudLikelyPrivate', () => {
  it('does not treat ESPN league ids or an ESPN HUD hint as a private session', () => {
    expect(espnHudLikelyPrivate({ espnConnected: false, hasCookies: false })).toBe(false)
    expect(espnHudLikelyPrivate({ espnConnected: true, hasCookies: false })).toBe(true)
    expect(espnHudLikelyPrivate({ espnConnected: false, hasCookies: true })).toBe(true)
  })
})

describe('espnUncachedDiscoveryPlan', () => {
  it('uses public known-id leagues without waiting on cookie IPC', () => {
    expect(espnUncachedDiscoveryPlan(2)).toBe('use-first')
    expect(espnUncachedDiscoveryPlan(0)).toBe('await-cookies')
  })

  it('is the same plan for HUD, rest boards, and a week-shift re-kick', () => {
    expect(espnHudCookiePlan({ cookieCacheReady: true, likelyPrivate: true })).toBe('cached')
    expect(espnHudCookiePlan({ cookieCacheReady: false, likelyPrivate: false })).toBe(
      'kick-then-refresh'
    )
    expect(espnHudCookiePlan({ cookieCacheReady: false, likelyPrivate: true })).toBe('await-cookies')
    expect(espnUncachedDiscoveryPlan(1)).toBe('use-first')
  })
})

describe('espnCookieRetryAfterScorePlan', () => {
  it('does not re-GET compact live after a public scoring HTTP hit', () => {
    expect(espnCookieRetryAfterScorePlan({ compactHit: true })).toBe('skip')
    expect(espnCookieRetryAfterScorePlan({ compactHit: false })).toBe('retry-auth')
    expect(espnCookieRetryAfterScorePlan({ compactHit: true, parsedHasLineup: true })).toBe('skip')
    expect(espnCookieRetryAfterScorePlan({ compactHit: true, parsedHasLineup: false })).toBe('retry-auth')
  })
})

describe('sleeperLeaguesLoadPlan', () => {
  it('returns a disk/memory list without waiting on GET /user', () => {
    expect(sleeperLeaguesLoadPlan({ hasFreshCache: true, hasStaleCache: true })).toBe('return-cache')
    expect(sleeperLeaguesLoadPlan({ hasFreshCache: false, hasStaleCache: true })).toBe('return-stale-swr')
    expect(sleeperLeaguesLoadPlan({ hasFreshCache: false, hasStaleCache: false })).toBe('await-user')
  })
})

describe('sleeperLeaguesSwrPlan', () => {
  it('returns a stale league list immediately on pin/reconnect; only a cold connect awaits GET /leagues', () => {
    expect(sleeperLeaguesSwrPlan('return-cache', false)).toBe('return')
    expect(sleeperLeaguesSwrPlan('return-stale-swr', false)).toBe('defer-swr')
    expect(sleeperLeaguesSwrPlan('return-stale-swr', true)).toBe('defer-swr')
    expect(sleeperLeaguesSwrPlan('await-user', false)).toBe('defer-swr')
    expect(sleeperLeaguesSwrPlan('await-user', true)).toBe('await-fetch')
  })
})

describe('leagueListFetchPlan', () => {
  it('starts GET /leagues and ESPN mSettings after the HUD scoring GET when a hint exists', () => {
    expect(leagueListFetchPlan(true)).toBe('after-hud')
    expect(leagueListFetchPlan(false)).toBe('now')
  })
})

describe('matchupsDiskHydratePlan', () => {
  it('defers sideline-matchups.json parse until after HUD paint when a live hint exists', () => {
    expect(matchupsDiskHydratePlan(true)).toBe('after-hud')
    expect(matchupsDiskHydratePlan(false)).toBe('now')
  })

  it('skips matchup-disk parse on live ticks when last HUD is already on screen', () => {
    expect(matchupsDiskHydratePlan(true, true)).toBe('skip')
    expect(matchupsDiskHydratePlan(false, true)).toBe('now')
    expect(matchupsDiskHydratePlan(true, false)).toBe('after-hud')
  })
})

describe('sleeperNamesKickPlan', () => {
  it('does not start /players/nfl on a live tick when the daily map is empty', () => {
    expect(sleeperNamesKickPlan(12)).toBe('now')
    expect(sleeperNamesKickPlan(0)).toBe('defer')
  })
})

describe('playerDumpDiskPlan', () => {
  it('peeks memory, defers a cold disk parse until idle, and skips the dump on a live tick', () => {
    expect(playerDumpDiskPlan(true)).toBe('memory')
    expect(playerDumpDiskPlan(false)).toBe('disk')
    expect(playerDumpDiskPlan(true, true)).toBe('memory')
    expect(playerDumpDiskPlan(false, true)).toBe('skip')
    expect(playerDumpDiskPlan(true, false)).toBe('memory')
  })
})

describe('sleeperScoreNamePlan', () => {
  it('does not parse sleeper-players.json beside /matchups when the name map is not in memory', () => {
    expect(sleeperScoreNamePlan(true)).toBe('memory')
    expect(sleeperScoreNamePlan(false)).toBe('empty')
  })
})

describe('sleeperTxNamePlan', () => {
  it('does not parse sleeper-players.json before GET /transactions, and skips the dump on a live tick', () => {
    expect(sleeperTxNamePlan(true)).toBe('memory')
    expect(sleeperTxNamePlan(false)).toBe('after-fetch')
    expect(sleeperTxNamePlan(true, true)).toBe('memory')
    expect(sleeperTxNamePlan(false, true)).toBe('empty')
  })
})

describe('afterSelectedSettlePlan', () => {
  it('holds cold player dump, league SWR, ESPN discovery, NFL scoreboard, and rest prefetch until the selected live GET returns; dump, discovery, and the scoreboard then wait for rest scoring; dump waits for transactions after that', () => {
    expect(afterSelectedSettlePlan({ hasSelectedHint: true, holdSelected: false })).toBe('after-selected')
    expect(afterSelectedSettlePlan({ hasSelectedHint: true, holdSelected: true })).toBe('now')
    expect(afterSelectedSettlePlan({ hasSelectedHint: false, holdSelected: false })).toBe('now')
  })
})

describe('sleeperRestNameHydratePlan', () => {
  it('does not wait on /players/nfl before rest publish or tape', () => {
    expect(sleeperRestNameHydratePlan()).toBe('after-publish')
  })
})

describe('sleeperCdnBustToken', () => {
  it('holds a stable token for one poll interval so in-flight matchup GETs still coalesce', () => {
    expect(sleeperCdnBustToken(9_000, 3_000)).toBe('3')
    expect(sleeperCdnBustToken(11_999, 3_000)).toBe('3')
    expect(sleeperCdnBustToken(12_000, 3_000)).toBe('4')
  })
})

describe('sleeperMatchupsHoldKey', () => {
  it('reuses the same league week only at the same fetch priority', () => {
    const base = { leagueId: '123', week: 1 }
    expect(sleeperMatchupsHoldKey({ ...base, priority: 'high' })).toBe(
      sleeperMatchupsHoldKey({ ...base, priority: 'high' })
    )
    expect(sleeperMatchupsHoldKey({ ...base, priority: 'high' })).not.toBe(
      sleeperMatchupsHoldKey({ ...base, priority: 'low' })
    )
    expect(sleeperMatchupsHoldKey(base)).not.toBe(sleeperMatchupsHoldKey({ ...base, priority: 'high' }))
  })
})

describe('sleeperIdentityHoldKey', () => {
  it('does not let a rest low identity GET satisfy a different priority', () => {
    expect(sleeperIdentityHoldKey({ leagueId: '123', priority: 'low' })).toBe(
      sleeperIdentityHoldKey({ leagueId: '123', priority: 'low' })
    )
    expect(sleeperIdentityHoldKey({ leagueId: '123', priority: 'low' })).not.toBe(
      sleeperIdentityHoldKey({ leagueId: '123' })
    )
  })
})

describe('sleeperMatchupsReusePlan', () => {
  it('joins an in-flight HUD /matchups after the 3s bust rolls', () => {
    expect(
      sleeperMatchupsReusePlan({ hasHold: false, holdBust: '', bust: '4', settled: false })
    ).toBe('kick')
    expect(
      sleeperMatchupsReusePlan({ hasHold: true, holdBust: '4', bust: '4', settled: true })
    ).toBe('join')
    expect(
      sleeperMatchupsReusePlan({ hasHold: true, holdBust: '3', bust: '4', settled: false })
    ).toBe('join')
    expect(
      sleeperMatchupsReusePlan({ hasHold: true, holdBust: '3', bust: '4', settled: true })
    ).toBe('kick')
  })
})

describe('sleeperMatchupsRestJoinHudPlan', () => {
  it('lets rest reuse the selected HUD /matchups GET', () => {
    expect(sleeperMatchupsRestJoinHudPlan({ hudHold: false })).toBe('own')
    expect(sleeperMatchupsRestJoinHudPlan({ hudHold: true })).toBe('join')
  })
})

describe('espnCompactLiveHoldKey', () => {
  it('does not share public compact live with an authenticated team filter', () => {
    const base = { leagueId: '899513', week: 1, bust: '4' }
    expect(
      espnCompactLiveHoldKey({ ...base, hasCookies: false, teamId: null })
    ).not.toBe(espnCompactLiveHoldKey({ ...base, hasCookies: true, teamId: 1 }))
    expect(espnCompactLiveHoldKey({ ...base, hasCookies: true, teamId: 1 })).toBe(
      espnCompactLiveHoldKey({ ...base, hasCookies: true, teamId: 1 })
    )
  })
})

describe('espnHoldStaleKeys', () => {
  it('drops previous 3s bust buckets for the same league/auth/team and keeps other leagues', () => {
    const keep = espnCompactLiveHoldKey({
      leagueId: '899513',
      week: 1,
      hasCookies: true,
      teamId: 1,
      bust: '5'
    })
    const stale = espnCompactLiveHoldKey({
      leagueId: '899513',
      week: 1,
      hasCookies: true,
      teamId: 1,
      bust: '4'
    })
    const other = espnCompactLiveHoldKey({
      leagueId: '22',
      week: 1,
      hasCookies: true,
      teamId: 1,
      bust: '4'
    })
    expect(espnHoldStaleKeys({ keys: [keep, stale, other], keepKey: keep })).toEqual([stale])
  })
})

describe('espnCompactLiveJoinPlan', () => {
  it('lets rest join in-flight HUD compact live without HUD waiting on rest', () => {
    expect(
      espnCompactLiveJoinPlan({ hasHold: false, holdIsHud: false, hud: true, settled: false })
    ).toBe('kick')
    expect(
      espnCompactLiveJoinPlan({ hasHold: true, holdIsHud: true, hud: false, settled: false })
    ).toBe('join')
    expect(
      espnCompactLiveJoinPlan({ hasHold: true, holdIsHud: true, hud: false, settled: true })
    ).toBe('join')
    expect(
      espnCompactLiveJoinPlan({ hasHold: true, holdIsHud: false, hud: true, settled: false })
    ).toBe('kick')
    expect(
      espnCompactLiveJoinPlan({ hasHold: true, holdIsHud: true, hud: true, settled: false })
    ).toBe('join')
    expect(
      espnCompactLiveJoinPlan({ hasHold: true, holdIsHud: true, hud: true, settled: true })
    ).toBe('kick')
  })
})

describe('seedScoreboardState', () => {
  it('keeps the last ticker and treats calendar or prior live as live until the scoreboard returns', () => {
    const ticker = [
      { id: '1', away: 'KC', awayScore: 7, home: 'BUF', homeScore: 3, clock: 'Q2 4:12' }
    ]
    expect(seedScoreboardState({ lastLive: false, lastTicker: ticker, calendarLive: true })).toEqual({
      live: true,
      ticker
    })
    expect(seedScoreboardState({ lastLive: true, lastTicker: ticker, calendarLive: false })).toEqual({
      live: true,
      ticker
    })
    expect(seedScoreboardState({ lastLive: false, lastTicker: [], calendarLive: false })).toEqual({
      live: false,
      ticker: []
    })
  })
})

describe('peekSettled', () => {
  it('returns a fulfilled live GET immediately and does not wait on an in-flight one', async () => {
    await expect(peekSettled(Promise.resolve(12), null)).resolves.toBe(12)
    const pending = new Promise<number>(() => undefined)
    await expect(peekSettled(pending, null)).resolves.toBeNull()
  })

  it('keeps a cached cookie session when cookie IPC is still in flight', async () => {
    const cached = { espn_s2: 's2', SWID: '{1}' }
    const pending = new Promise<typeof cached>(() => undefined)
    await expect(peekSettled(pending, cached)).resolves.toBe(cached)
  })
})

describe('nflWeekShifted', () => {
  it('detects a display week or league season change', () => {
    expect(nflWeekShifted({ displayWeek: 1, leagueSeason: '2026' }, { displayWeek: 1, leagueSeason: '2026' })).toBe(
      false
    )
    expect(nflWeekShifted({ displayWeek: 1, leagueSeason: '2026' }, { displayWeek: 2, leagueSeason: '2026' })).toBe(true)
    expect(nflWeekShifted({ displayWeek: 1, leagueSeason: '2025' }, { displayWeek: 1, leagueSeason: '2026' })).toBe(true)
  })
})

describe('weekShiftKickOrder', () => {
  it('re-kicks the selected HUD first; rest waits until that GET returns', () => {
    expect(weekShiftKickOrder(true)).toBe('hud-then-rest')
    expect(weekShiftKickOrder(false)).toBe('rest-only')
  })
})

describe('restMatchupFlightKey', () => {
  it('includes season and week so a rollover does not join last week\'s in-flight GET', () => {
    expect(restMatchupFlightKey('sleeper', '123', '2026', 1)).toBe('sleeper:123:2026:1')
    expect(restMatchupFlightKey('sleeper', '123', '2026', 1)).not.toBe(restMatchupFlightKey('sleeper', '123', '2026', 2))
  })
})

describe('sleeperLeaguesFromDiskPayload', () => {
  it('trusts a same-user league list and rejects stale or mixed-provider files', () => {
    const now = 1_000_000
    const leagues = [
      { id: '11', name: 'One', provider: 'sleeper' as const, season: '2026', week: 1 }
    ]
    expect(
      sleeperLeaguesFromDiskPayload({ at: now, username: 'bob', season: '2026', leagues }, now)
    ).toEqual({ username: 'bob', season: '2026', leagues })
    expect(
      sleeperLeaguesFromDiskPayload(
        { at: now - 13 * 60 * 60 * 1000, username: 'bob', season: '2026', leagues },
        now
      )
    ).toBeNull()
    expect(
      sleeperLeaguesFromDiskPayload(
        { at: now, username: 'bob', season: '2026', leagues: [{ ...leagues[0], provider: 'espn' }] },
        now
      )
    ).toBeNull()
    expect(
      sleeperLeaguesFromDiskPayload(
        {
          at: now,
          username: 'bob',
          season: 2026,
          leagues: [{ id: 11, name: 'One', provider: 'sleeper', season: 2026, week: '1' }]
        },
        now
      )
    ).toEqual({ username: 'bob', season: '2026', leagues })
  })
})

describe('espnLeaguesFromDiskPayload', () => {
  it('trusts named ESPN leagues for the same season and drops slugs', () => {
    const now = 1_000_000
    const leagues = [
      { id: '899513', name: 'Public', provider: 'espn' as const, season: '2026', week: 1 }
    ]
    expect(
      espnLeaguesFromDiskPayload({ at: now, season: '2026', ids: '899513', leagues }, now)
    ).toEqual({ season: '2026', ids: '899513', leagues })
    expect(
      espnLeaguesFromDiskPayload(
        { at: now, season: '2026', ids: 'x', leagues: [{ ...leagues[0], id: 'gridiron-gurus' }] },
        now
      )
    ).toBeNull()
  })
})

describe('espnLeaguesCachePlan', () => {
  it('returns a same-season disk/memory list without waiting on mSettings', () => {
    expect(
      espnLeaguesCachePlan({
        cacheSeason: '2026',
        cacheIds: '899513',
        cacheCookieKey: 'disk',
        cacheAt: 1_000,
        season: '2026',
        ids: '899513',
        cookieKey: 'none',
        now: 2_000,
        ttlMs: 5 * 60_000
      })
    ).toBe('return-stale-swr')
    expect(
      espnLeaguesCachePlan({
        cacheSeason: '2026',
        cacheIds: '899513',
        cacheCookieKey: 'none',
        cacheAt: 1_000,
        season: '2026',
        ids: '899513',
        cookieKey: 'none',
        now: 2_000,
        ttlMs: 5 * 60_000
      })
    ).toBe('return-fresh')
    expect(
      espnLeaguesCachePlan({
        cacheSeason: '2026',
        cacheIds: '111',
        cacheCookieKey: 'none',
        cacheAt: 1_000,
        season: '2026',
        ids: '111,222',
        cookieKey: 'none',
        now: 2_000,
        ttlMs: 5 * 60_000
      })
    ).toBe('fetch')
  })
})

describe('espnDiscoverySwrPlan', () => {
  it('returns a stale ESPN list immediately on pin/reconnect; add-ESPN and a cold connect await mSettings', () => {
    expect(espnDiscoverySwrPlan('return-fresh', false)).toBe('return')
    expect(espnDiscoverySwrPlan('return-stale-swr', false)).toBe('defer-swr')
    expect(espnDiscoverySwrPlan('return-stale-swr', true)).toBe('defer-swr')
    expect(espnDiscoverySwrPlan('fetch', false)).toBe('defer-swr')
    expect(espnDiscoverySwrPlan('fetch', true)).toBe('await-fetch')
  })
})

describe('mergeProviderLeagues', () => {
  it('replaces one provider slice and keeps sleeper before ESPN', () => {
    const sleeper = league('sleeper', '11')
    const espn = league('espn', '22')
    expect(mergeProviderLeagues([sleeper, espn], 'sleeper', [{ ...sleeper, name: 'Home' }])).toEqual([
      { ...sleeper, name: 'Home' },
      espn
    ])
    expect(mergeProviderLeagues([sleeper, espn], 'espn', [{ ...espn, name: 'Gridiron' }])).toEqual([
      sleeper,
      { ...espn, name: 'Gridiron' }
    ])
  })
})

describe('lastHudFromDiskPayload', () => {
  const matchup = {
    myTeam: { id: '1', name: 'Mine', owner: 'Me', record: '0-0' },
    oppTeam: { id: '2', name: 'Yours', owner: 'You', record: '0-0' },
    myPoints: 88.4,
    oppPoints: 70.1,
    starters: [{ playerId: 'p1', name: 'QB', position: 'QB', nflTeam: 'KC', points: 12 }],
    bench: [],
    oppStarters: [],
    oppBench: []
  }

  it('trusts a same-week HUD snapshot and rejects stale or incomplete ones', () => {
    const now = 1_000_000
    expect(
      lastHudFromDiskPayload(
        { at: now, displayWeek: 1, selectedKey: 'espn:1', matchup },
        now
      )
    ).toEqual({ displayWeek: 1, selectedKey: 'espn:1', matchup })
    expect(
      lastHudFromDiskPayload(
        { at: now - 13 * 60 * 60 * 1000, displayWeek: 1, selectedKey: 'espn:1', matchup },
        now
      )
    ).toBeNull()
    expect(lastHudFromDiskPayload({ at: now, displayWeek: 1, selectedKey: 'espn:1', matchup: { myPoints: 1 } }, now)).toBeNull()
    expect(
      lastHudFromDiskPayload(
        {
          at: now,
          displayWeek: '1',
          selectedKey: 'espn:1',
          matchup: {
            ...matchup,
            myTeam: { ...matchup.myTeam, id: 1 },
            myPoints: '88.4',
            oppPoints: '70.1',
            starters: [{ ...matchup.starters[0], playerId: 100, points: '12' }]
          }
        },
        now
      )
    ).toEqual({
      displayWeek: 1,
      selectedKey: 'espn:1',
      matchup: {
        ...matchup,
        starters: [{ ...matchup.starters[0], playerId: '100', points: 12 }]
      }
    })
  })

  it('hydrates ESPN projected finals without treating them as live points', () => {
    const now = 1_000_000
    const withProj = { ...matchup, myProjectedPoints: 101.46, oppProjectedPoints: 94.2 }
    expect(
      lastHudFromDiskPayload(
        { at: now, displayWeek: 1, selectedKey: 'espn:1', matchup: withProj },
        now
      )?.matchup
    ).toEqual(withProj)
    expect(
      lastHudFromDiskPayload(
        {
          at: now,
          displayWeek: 1,
          selectedKey: 'espn:1',
          matchup: { ...matchup, myProjectedPoints: '101.46', oppProjectedPoints: '94.2' }
        },
        now
      )?.matchup.myProjectedPoints
    ).toBe(101.46)
  })

  it('hydrates provider win% without treating it as live points', () => {
    const now = 1_000_000
    const withWp = { ...matchup, myWinPct: 0.74, oppWinPct: 0.26, winPctSource: 'official' as const }
    expect(
      lastHudFromDiskPayload({ at: now, displayWeek: 1, selectedKey: 'espn:1', matchup: withWp }, now)?.matchup
    ).toEqual(withWp)
    expect(
      lastHudFromDiskPayload(
        {
          at: now,
          displayWeek: 1,
          selectedKey: 'espn:1',
          matchup: { ...matchup, myWinPct: '0.74', oppWinPct: '0.26', winPctSource: 'official' }
        },
        now
      )?.matchup.myWinPct
    ).toBe(0.74)
    const estimated = {
      ...matchup,
      myProjectedPoints: 140,
      oppProjectedPoints: 80,
      winPctSource: 'estimated' as const
    }
    expect(
      lastHudFromDiskPayload({ at: now, displayWeek: 1, selectedKey: 'sleeper:1', matchup: estimated }, now)?.matchup
        .winPctSource
    ).toBe('estimated')
  })
})

describe('matchupsFromDiskPayload', () => {
  it('trusts same-week board snapshots and rejects stale, junk, or unkeyed rows', () => {
    const now = 1_000_000
    const matchup = {
      myTeam: { id: '1', name: 'Mine', owner: 'Me', record: '0-0' },
      oppTeam: { id: '2', name: 'Yours', owner: 'You', record: '0-0' },
      myPoints: 88.4,
      oppPoints: 70.1,
      starters: [{ playerId: 'p1', name: 'QB', position: 'QB', nflTeam: 'KC', points: 12 }],
      bench: [],
      oppStarters: [],
      oppBench: []
    }
    expect(
      matchupsFromDiskPayload({ at: now, week: 1, byKey: { 'sleeper:123': matchup, 'espn:9': matchup } }, now)
    ).toEqual({ week: 1, byKey: { 'sleeper:123': matchup, 'espn:9': matchup } })
    expect(
      matchupsFromDiskPayload(
        { at: now - 13 * 60 * 60 * 1000, week: 1, byKey: { 'sleeper:abc': matchup } },
        now
      )
    ).toBeNull()
    expect(matchupsFromDiskPayload({ at: now, week: 1, byKey: { nope: matchup } }, now)).toBeNull()
    expect(matchupsFromDiskPayload({ at: now, week: 1, byKey: { 'sleeper:abc': { myPoints: 1 } } }, now)).toBeNull()
    expect(
      matchupsFromDiskPayload(
        { at: now, week: 1, byKey: { 'sleeper:fourth-drunken': matchup, 'sleeper:123': matchup } },
        now
      )
    ).toEqual({ week: 1, byKey: { 'sleeper:123': matchup } })
  })
})

const league = (provider: 'sleeper' | 'espn', id: string): League => ({
  id,
  name: id,
  provider,
  season: '2026',
  week: 1
})

describe('espnLeagueIdsToDiscover', () => {
  it('includes the selected ESPN league even when it is not saved yet', () => {
    expect(espnLeagueIdsToDiscover(['111'], 'espn:222')).toEqual(['111', '222'])
  })

  it('does not duplicate a saved ESPN id or pick a Sleeper selection', () => {
    expect(espnLeagueIdsToDiscover(['111'], 'espn:111')).toEqual(['111'])
    expect(espnLeagueIdsToDiscover(['111'], 'sleeper:abc')).toEqual(['111'])
  })

  it('drops replay leftover slug ids so live discovery never calls them', () => {
    expect(espnLeagueIdsToDiscover(['gridiron-gurus', '111'], 'espn:fourth-drunken')).toEqual(['111'])
  })
})

describe('espnFanExtraIds', () => {
  it('starts fan-found ids in parallel with known-id fetches and skips slugs', () => {
    expect(espnFanExtraIds(['111', '222', 'gridiron-gurus'], ['111'])).toEqual(['222'])
    expect(espnFanExtraIds(['111'], ['111', '222'])).toEqual([])
  })
})

describe('splitBoardTargets', () => {
  it('pulls the selected league out so the HUD can resolve first', () => {
    const leagues = [league('sleeper', 'a'), league('espn', 'b'), league('sleeper', 'c')]
    const { selected, rest } = splitBoardTargets(leagues, 'espn:b')
    expect(selected?.id).toBe('b')
    expect(rest.map((row) => row.id)).toEqual(['a', 'c'])
  })

  it('returns every league as rest when nothing is selected', () => {
    const leagues = [league('sleeper', 'a')]
    const { selected, rest } = splitBoardTargets(leagues, null)
    expect(selected).toBeUndefined()
    expect(rest).toEqual(leagues)
  })
})

describe('restConcurrency', () => {
  it('uses one shared pool of 3 while live and 6 while idle', () => {
    expect(restConcurrency(true)).toBe(REST_LIVE_CONCURRENCY)
    expect(restConcurrency(false)).toBe(REST_IDLE_CONCURRENCY)
    expect(REST_LIVE_CONCURRENCY).toBe(3)
    expect(REST_IDLE_CONCURRENCY).toBe(6)
  })
})

describe('restScoreTimeoutMs', () => {
  it('aborts rest compact scoring at the live poll interval while games are in', () => {
    expect(restScoreTimeoutMs({ live: true, livePollMs: 3_000, restTimeoutMs: 5_000 })).toBe(3_000)
    expect(restScoreTimeoutMs({ live: false, livePollMs: 3_000, restTimeoutMs: 5_000 })).toBe(5_000)
  })
})

describe('gamedayLiveTick', () => {
  it('treats the calendar live window the same as scoreboard-in for rest prefetch and concurrency', () => {
    expect(gamedayLiveTick({ pollingLive: false, calendarLive: false })).toBe(false)
    expect(gamedayLiveTick({ pollingLive: true, calendarLive: false })).toBe(true)
    expect(gamedayLiveTick({ pollingLive: false, calendarLive: true })).toBe(true)
  })
})

describe('scoreboardPollLive', () => {
  it('does not drop the 3s gameday poll when every NFL event is still pre', () => {
    expect(scoreboardPollLive({ gamesIn: false, calendarLive: true })).toBe(true)
    expect(scoreboardPollLive({ gamesIn: true, calendarLive: false })).toBe(true)
    expect(scoreboardPollLive({ gamesIn: false, calendarLive: false })).toBe(false)
  })
})

describe('restSettleSchedulePlan', () => {
  it('does not let a slow rest settle reschedule 30s over an armed 3s HUD tick', () => {
    expect(
      restSettleSchedulePlan({ hudScheduled: true, nextLive: false, scheduledLive: true })
    ).toBe('skip')
    expect(
      restSettleSchedulePlan({ hudScheduled: true, nextLive: true, scheduledLive: true })
    ).toBe('skip')
    expect(
      restSettleSchedulePlan({ hudScheduled: true, nextLive: true, scheduledLive: false })
    ).toBe('schedule')
    expect(
      restSettleSchedulePlan({ hudScheduled: false, nextLive: false, scheduledLive: false })
    ).toBe('schedule')
  })
})

describe('restPrefetchColdPlan', () => {
  it('keeps cold boards off the live prefetch and settleBoards wave so they cannot starve the HUD', () => {
    expect(restPrefetchColdPlan(true)).toBe('hot-only')
    expect(restPrefetchColdPlan(false)).toBe('hot-and-cold')
  })
})

describe('restPrefetchAwaitPlan', () => {
  it('does not hold the live HUD snapshot on pinned rest GETs', () => {
    expect(restPrefetchAwaitPlan({ liveTick: true })).toBe('skip')
    expect(restPrefetchAwaitPlan({ liveTick: false })).toBe('await')
    expect(restPrefetchAwaitPlan({ liveTick: true, waitForBoards: true })).toBe('await')
  })
})

describe('restLeaguesToPrefetch', () => {
  const nfl = { season: '2026', week: 1 }
  const at = new Map<string, number>([
    ['sleeper:11', 1_000_000],
    ['espn:22', 1_000_000],
    ['sleeper:33', 980_000]
  ])

  it('kicks pinned rest immediately and skips the selected HUD league', () => {
    const leagues = [
      league('sleeper', '11'),
      league('espn', '22'),
      league('sleeper', '33'),
      league('espn', '44')
    ]
    const rest = restLeaguesToPrefetch({
      leagues,
      selectedKey: 'sleeper:11',
      pinnedKeys: ['espn:22'],
      skipKeys: ['sleeper:11'],
      season: nfl.season,
      week: nfl.week,
      matchupAt: (key) => at.get(key),
      now: 1_000_000,
      coldTtlMs: 30_000
    })
    expect(rest.map((row) => `${row.provider}:${row.id}`)).toEqual(['espn:22', 'espn:44'])
  })

  it('omits cold boards from the live prefetch wave', () => {
    const leagues = [
      league('sleeper', '11'),
      league('espn', '22'),
      league('espn', '44')
    ]
    const rest = restLeaguesToPrefetch({
      leagues,
      selectedKey: 'sleeper:11',
      pinnedKeys: ['espn:22'],
      skipKeys: ['sleeper:11'],
      season: nfl.season,
      week: nfl.week,
      matchupAt: (key) => at.get(key),
      now: 1_000_000,
      coldTtlMs: 30_000,
      includeCold: false
    })
    expect(rest.map((row) => `${row.provider}:${row.id}`)).toEqual(['espn:22'])
  })

  it('stubs pinned numeric ids when the board list is still empty', () => {
    const rest = restLeaguesToPrefetch({
      leagues: [],
      selectedKey: 'sleeper:11',
      pinnedKeys: ['espn:22', 'sleeper:fourth-drunken'],
      skipKeys: ['sleeper:11'],
      season: nfl.season,
      week: nfl.week,
      matchupAt: () => undefined,
      now: 1_000_000,
      coldTtlMs: 30_000
    })
    expect(rest.map((row) => `${row.provider}:${row.id}`)).toEqual(['espn:22'])
  })

  it('skips a pin HUD hint when settings have no selected key', () => {
    const leagues = [league('sleeper', '11'), league('espn', '22'), league('sleeper', '33')]
    const rest = restLeaguesToPrefetch({
      leagues,
      selectedKey: 'espn:22',
      pinnedKeys: ['espn:22', 'sleeper:11'],
      skipKeys: ['espn:22'],
      season: nfl.season,
      week: nfl.week,
      matchupAt: (key) => at.get(key),
      now: 1_000_000,
      coldTtlMs: 30_000,
      includeCold: false
    })
    expect(rest.map((row) => `${row.provider}:${row.id}`)).toEqual(['sleeper:11'])
  })
})

describe('warmupLeaguesFromDisk', () => {
  const nfl = {
    week: 1,
    displayWeek: 1,
    season: '2026',
    leagueSeason: '2026',
    seasonType: 'regular'
  }

  it('merges sleeper disk leagues with numeric ESPN ids and drops replay slugs', () => {
    const leagues = warmupLeaguesFromDisk({
      nfl,
      sleeperLeagues: [league('sleeper', '11'), { ...league('sleeper', 'fourth-drunken'), name: 'Replay' }],
      espnLeagues: [{ ...league('espn', '899513'), name: 'Public' }],
      espnLeagueIds: ['899513', 'gridiron']
    })
    expect(leagues.map((row) => `${row.provider}:${row.id}:${row.name}`)).toEqual([
      'sleeper:11:11',
      'espn:899513:Public'
    ])
    expect(leagues[0]?.week).toBe(1)
  })
})

describe('warmupMatchupFromDisk', () => {
  const matchup = {
    myTeam: { id: '1', name: 'Mine', owner: 'Me', record: '0-0' },
    oppTeam: { id: '2', name: 'Yours', owner: 'You', record: '0-0' },
    myPoints: 88.4,
    oppPoints: 70.1,
    starters: [],
    bench: [],
    oppStarters: [],
    oppBench: []
  }

  it('prefers last HUD when the week and selected key still match', () => {
    expect(
      warmupMatchupFromDisk({
        selectedKey: 'espn:899513',
        displayWeek: 1,
        lastHud: { displayWeek: 1, selectedKey: 'espn:899513', matchup: { ...matchup, myPoints: 12 } },
        matchupsByKey: { 'espn:899513': matchup }
      })?.myPoints
    ).toBe(12)
  })

  it('falls back to the persisted board matchup when last HUD is for another league', () => {
    expect(
      warmupMatchupFromDisk({
        selectedKey: 'sleeper:11',
        displayWeek: 1,
        lastHud: { displayWeek: 1, selectedKey: 'espn:899513', matchup },
        matchupsByKey: { 'sleeper:11': { ...matchup, myPoints: 20 } }
      })?.myPoints
    ).toBe(20)
  })
})

describe('stubLeagueFromKey', () => {
  it('builds a fetchable ESPN league from the selected key', () => {
    expect(stubLeagueFromKey('espn:899513', '2026', 1)).toEqual({
      id: '899513',
      name: '899513',
      provider: 'espn',
      season: '2026',
      week: 1
    })
    expect(stubLeagueFromKey('sleeper:fourth-drunken', '2026', 1)).toBeNull()
  })
})

describe('hudHintKey', () => {
  it('prefers selected, then last HUD, then pin, then warmup leagues, then saved ESPN ids', () => {
    expect(
      hudHintKey({
        selectedKey: 'espn:1',
        lastSelectedKey: 'sleeper:2',
        lastHudKey: 'espn:3',
        pinnedKeys: ['sleeper:4']
      })
    ).toBe('espn:1')
    expect(
      hudHintKey({
        selectedKey: null,
        lastSelectedKey: null,
        lastHudKey: 'espn:3',
        pinnedKeys: ['sleeper:4']
      })
    ).toBe('espn:3')
    expect(
      hudHintKey({
        selectedKey: null,
        lastSelectedKey: null,
        lastHudKey: null,
        pinnedKeys: ['sleeper:fourth-drunken', 'espn:899513']
      })
    ).toBe('espn:899513')
    expect(
      hudHintKey({
        selectedKey: null,
        lastSelectedKey: null,
        lastHudKey: null,
        pinnedKeys: ['sleeper:fourth-drunken']
      })
    ).toBeNull()
    expect(
      hudHintKey({
        selectedKey: null,
        lastSelectedKey: null,
        lastHudKey: null,
        pinnedKeys: [],
        leagueKeys: ['sleeper:11', 'espn:22']
      })
    ).toBe('sleeper:11')
    expect(
      hudHintKey({
        selectedKey: null,
        lastSelectedKey: null,
        lastHudKey: null,
        pinnedKeys: [],
        espnLeagueIds: ['gridiron', '899513']
      })
    ).toBe('espn:899513')
  })
})

describe('pickSelectedLeagueKey', () => {
  it('keeps the HUD hint when settings have no selected key instead of leagues[0]', () => {
    expect(
      pickSelectedLeagueKey({
        settingsKey: 'espn:1',
        leagueKeys: ['sleeper:11', 'espn:1'],
        pinnedKeys: ['sleeper:11'],
        hintKey: 'espn:1',
        featuredKey: 'sleeper:friday-night-gridiron'
      })
    ).toBe('espn:1')
    expect(
      pickSelectedLeagueKey({
        settingsKey: null,
        leagueKeys: ['sleeper:11', 'espn:899513'],
        pinnedKeys: [],
        hintKey: 'espn:899513',
        featuredKey: 'sleeper:friday-night-gridiron'
      })
    ).toBe('espn:899513')
    expect(
      pickSelectedLeagueKey({
        settingsKey: null,
        leagueKeys: ['sleeper:11', 'espn:22'],
        pinnedKeys: ['espn:22'],
        hintKey: 'sleeper:11',
        featuredKey: null
      })
    ).toBe('espn:22')
    expect(
      pickSelectedLeagueKey({
        settingsKey: 'sleeper:gone',
        leagueKeys: ['sleeper:11'],
        pinnedKeys: [],
        hintKey: null,
        featuredKey: null
      })
    ).toBe('sleeper:11')
    expect(
      pickSelectedLeagueKey({
        settingsKey: 'sleeper:123456789',
        leagueKeys: [],
        pinnedKeys: [],
        hintKey: 'sleeper:123456789',
        featuredKey: null
      })
    ).toBe('sleeper:123456789')
  })
})

describe('settleMatchupPlan', () => {
  const hud = {
    myTeam: { id: '1', name: 'Mine', owner: 'Me', record: '1-0' },
    oppTeam: { id: '2', name: 'Yours', owner: 'You', record: '0-1' },
    myPoints: 12.5,
    oppPoints: 9,
    starters: [],
    bench: [],
    oppStarters: [],
    oppBench: []
  }

  it('keeps last or live HUD scores when discovery has no selected board yet', () => {
    expect(
      settleMatchupPlan({
        selectedMatchup: null,
        liveMatchup: hud,
        lastMatchup: { ...hud, myPoints: 10 },
        selectedKey: 'espn:899513',
        lastKey: 'espn:899513'
      })
    ).toBe(hud)
    expect(
      settleMatchupPlan({
        selectedMatchup: null,
        liveMatchup: null,
        lastMatchup: hud,
        selectedKey: null,
        lastKey: 'espn:899513'
      })
    ).toBe(hud)
    expect(
      settleMatchupPlan({
        selectedMatchup: { ...hud, myPoints: 14 },
        liveMatchup: hud,
        lastMatchup: hud,
        selectedKey: 'espn:899513',
        lastKey: 'espn:899513'
      }).myPoints
    ).toBe(14)
  })

  it('does not keep the previous board when the selected league changed', () => {
    expect(
      settleMatchupPlan({
        selectedMatchup: null,
        liveMatchup: hud,
        lastMatchup: hud,
        selectedKey: 'sleeper:1',
        lastKey: 'espn:899513'
      })
    ).toBeNull()
  })

  it('does not paint last ESPN HUD onto a Sleeper selection with the same lastKey', () => {
    expect(
      settleMatchupPlan({
        selectedMatchup: null,
        liveMatchup: hud,
        lastMatchup: hud,
        selectedKey: 'sleeper:1333470459076804608',
        lastKey: 'sleeper:1333470459076804608',
        liveKey: 'espn:543268341'
      })
    ).toBeNull()
  })

  it('keeps this tick’s HUD when it already belongs to the newly selected league', () => {
    expect(
      settleMatchupPlan({
        selectedMatchup: null,
        liveMatchup: { ...hud, myPoints: 88.2 },
        lastMatchup: hud,
        selectedKey: 'sleeper:1333470459076804608',
        lastKey: 'espn:543268341',
        liveKey: 'sleeper:1333470459076804608'
      })?.myPoints
    ).toBe(88.2)
  })
})

describe('seedHudMatchupPlan', () => {
  it('skips last HUD when the hinted league is a different provider', () => {
    expect(
      seedHudMatchupPlan({
        hintKey: 'sleeper:1333470459076804608',
        lastSelectedKey: 'espn:543268341',
        lastHudKey: 'espn:543268341'
      })
    ).toBe('skip')
    expect(
      seedHudMatchupPlan({
        hintKey: 'espn:543268341',
        lastSelectedKey: 'espn:543268341',
        lastHudKey: 'espn:543268341'
      })
    ).toBe('last-state')
    expect(
      seedHudMatchupPlan({
        hintKey: 'espn:543268341',
        lastSelectedKey: null,
        lastHudKey: 'espn:543268341'
      })
    ).toBe('last-hud')
  })
})

describe('refreshJoinPlan', () => {
  it('kicks a new poll when selectedLeagueKey changed under an in-flight tick', () => {
    expect(
      refreshJoinPlan({
        hasInFlight: true,
        hasBoardsTail: true,
        waitForBoards: true,
        settingsKey: 'sleeper:1333470459076804608',
        inFlightKey: 'espn:543268341'
      })
    ).toBe('kick')
    expect(
      refreshJoinPlan({
        hasInFlight: true,
        hasBoardsTail: false,
        waitForBoards: false,
        settingsKey: 'espn:543268341',
        inFlightKey: 'espn:543268341'
      })
    ).toBe('join')
  })
})

describe('espnConnectedPlan', () => {
  it('keeps the last ESPN session when settleBoards publishes before cookies land', () => {
    expect(espnConnectedPlan({ replay: false, hasCookies: false, lastConnected: true })).toBe(true)
    expect(espnConnectedPlan({ replay: false, hasCookies: false, lastConnected: false })).toBe(false)
    expect(espnConnectedPlan({ replay: true, hasCookies: false, lastConnected: false })).toBe(true)
  })

  it('does not treat leftover cookies as healthy after a 401', () => {
    expect(
      espnConnectedPlan({
        replay: false,
        hasCookies: true,
        lastConnected: true,
        unauthorized: true
      })
    ).toBe(false)
    expect(
      espnConnectedPlan({
        replay: false,
        hasCookies: true,
        lastConnected: true,
        unauthorized: false
      })
    ).toBe(true)
  })
})

describe('espnCookiePrimePlan', () => {
  it('retries an empty jar a few times after Sign in, then stops', () => {
    expect(espnCookiePrimePlan({ hasCookies: true, attempt: 0 })).toBe('done')
    expect(espnCookiePrimePlan({ hasCookies: false, attempt: 0 })).toBe('retry')
    expect(espnCookiePrimePlan({ hasCookies: false, attempt: 2 })).toBe('retry')
    expect(espnCookiePrimePlan({ hasCookies: false, attempt: 3 })).toBe('done')
  })
})

describe('settleSelectedKeyPlan', () => {
  it('keeps the last selected league when discovery returns no keys', () => {
    expect(settleSelectedKeyPlan({ discoveredKey: null, lastKey: 'espn:899513' })).toBe('espn:899513')
    expect(settleSelectedKeyPlan({ discoveredKey: 'sleeper:1', lastKey: 'espn:899513' })).toBe('sleeper:1')
  })
})

describe('isLiveLeagueId', () => {
  it('accepts ESPN/Sleeper numeric ids and rejects replay slugs', () => {
    expect(isLiveLeagueId('899513')).toBe(true)
    expect(isLiveLeagueId('fourth-drunken')).toBe(false)
  })
})

describe('stripReplayLeagueKeys', () => {
  it('clears replay leftover selection, pins, and ESPN ids on the live path', () => {
    const stripped = stripReplayLeagueKeys({
      ...defaultSettings(),
      espnLeagueIds: ['gridiron-gurus', '899513'],
      pinnedLeagueKeys: ['sleeper:fourth-drunken', 'espn:899513'],
      selectedLeagueKey: 'sleeper:fourth-drunken'
    })
    expect(stripped.espnLeagueIds).toEqual(['899513'])
    expect(stripped.pinnedLeagueKeys).toEqual(['espn:899513'])
    expect(stripped.selectedLeagueKey).toBeNull()
  })
})

describe('recentLiveCallMs', () => {
  it('returns the latest live scoring GET, including a failed attempt', () => {
    expect(
      recentLiveCallMs([
        { url: 'https://api.sleeper.app/v1/state/nfl', ms: 80, ok: true },
        { url: 'https://api.sleeper.app/v1/league/1/matchups/1', ms: 41, ok: true },
        { url: 'https://lm-api-reads.fantasy.espn.com/x?view=mLiveScoring', ms: 69, ok: true }
      ])
    ).toBe(69)
    expect(
      recentLiveCallMs([
        { url: 'https://api.sleeper.app/v1/league/1/matchups/1', ms: 41, ok: true },
        { url: 'https://api.sleeper.app/v1/league/1/matchups/1', ms: 5_000, ok: false }
      ])
    ).toBe(5_000)
  })
})

describe('cacheFresh', () => {
  it('is fresh inside the ttl and stale after', () => {
    expect(cacheFresh(1000, 1099, 100)).toBe(true)
    expect(cacheFresh(1000, 1100, 100)).toBe(false)
    expect(cacheFresh(undefined, 1000, 100)).toBe(false)
  })
})

describe('mapSettledLimit', () => {
  it('caps in-flight workers and still returns every result in order', async () => {
    let inflight = 0
    let peak = 0
    const rows = await mapSettledLimit([1, 2, 3, 4, 5], 2, async (value) => {
      inflight += 1
      peak = Math.max(peak, inflight)
      await new Promise((resolve) => setTimeout(resolve, 20))
      inflight -= 1
      if (value === 3) throw new Error('boom')
      return value * 10
    })
    expect(peak).toBe(2)
    expect(rows.map((row) => (row.status === 'fulfilled' ? row.value : row.reason))).toEqual([
      10,
      20,
      expect.any(Error),
      40,
      50
    ])
  })
})

describe('splitHotCold', () => {
  it('keeps selected and pinned on the hot path', () => {
    const leagues = [league('sleeper', 'a'), league('espn', 'b'), league('sleeper', 'c')]
    const { selected, hot, cold } = splitHotCold(leagues, 'sleeper:a', ['espn:b'])
    expect(selected?.id).toBe('a')
    expect(hot.map((row) => row.id).sort()).toEqual(['a', 'b'])
    expect(cold.map((row) => row.id)).toEqual(['c'])
  })
})

describe('espnTeamIdFromMatchup', () => {
  const matchup = {
    myTeam: { id: '7', name: 'Mine', owner: 'Me', record: '0-0' },
    oppTeam: null,
    myPoints: 0,
    oppPoints: 0,
    starters: [],
    bench: [],
    oppStarters: [],
    oppBench: []
  }

  it('reads the ESPN team id from the selected HUD', () => {
    expect(espnTeamIdFromMatchup('99', 'espn:99', matchup)).toBe(7)
  })

  it('coerces quoted or numeric ESPN team ids for filterTeamIds', () => {
    expect(espnTeamIdOf(7)).toBe(7)
    expect(espnTeamIdOf('7')).toBe(7)
    expect(espnTeamIdOf(' 7 ')).toBe(7)
    expect(espnTeamIdOf('fng-me')).toBeUndefined()
    expect(espnTeamIdOf(0)).toBeUndefined()
  })

  it('does not let a public mTeam in-flight satisfy a cookie identity GET', () => {
    expect(espnTeamFetchKey('99', false)).toBe('99:public')
    expect(espnTeamFetchKey('99', true)).toBe('99:auth')
    expect(espnTeamFetchKey('99', false)).not.toBe(espnTeamFetchKey('99', true))
  })

  it('ignores a HUD that belongs to a different league or Sleeper', () => {
    expect(espnTeamIdFromMatchup('99', 'espn:100', matchup)).toBeUndefined()
    expect(espnTeamIdFromMatchup('99', 'sleeper:99', matchup)).toBeUndefined()
    expect(espnTeamIdFromMatchup('99', 'espn:99', { ...matchup, myTeam: { ...matchup.myTeam, id: 'fng-me' } })).toBeUndefined()
  })

  it('reads myTeam.id from matchupCache for a rest ESPN board', () => {
    expect(espnTeamIdFromMatchup('99', 'sleeper:1', matchup, matchup)).toBe(7)
    expect(espnTeamIdFromMatchup('99', 'espn:100', matchup, matchup)).toBe(7)
  })
})

describe('espnTeamsKickPlan', () => {
  it('starts mTeam after the scoring GET returns when owners are not cached', () => {
    expect(espnTeamsKickPlan({ haveOwners: true })).toBe('skip')
    expect(espnTeamsKickPlan({ haveOwners: false })).toBe('after-score')
  })

  it('skips mTeam only when owners are already cached, not because last HUD has a numeric id', () => {
    expect(espnTeamsKickPlan({ haveOwners: false, liveTick: true, hasTeamId: true })).toBe(
      'after-score'
    )
    expect(espnTeamsKickPlan({ haveOwners: false, liveTick: true, hasTeamId: false })).toBe(
      'after-score'
    )
    expect(espnTeamsKickPlan({ haveOwners: false, liveTick: false, hasTeamId: true })).toBe(
      'after-score'
    )
  })
})

describe('live tick DAG', () => {
  it('starts scoring from a pin HUD hint, then rest, tape, scoreboard, and skips fat discovery', () => {
    const hint = hudHintKey({
      selectedKey: null,
      lastSelectedKey: null,
      lastHudKey: 'espn:22',
      pinnedKeys: ['espn:22', 'sleeper:11'],
      espnLeagueIds: ['899513']
    })
    expect(hint).toBe('espn:22')
    expect(restPrefetchGate(hint)).toBe('now')
    expect(espnTeamsKickPlan({ haveOwners: false, liveTick: true, hasTeamId: true })).toBe(
      'after-score'
    )
    expect(nflScoreboardKickPlan(true)).toBe('after-hud')
    expect(restTxKickPlan(true)).toBe('skip')
    expect(
      sleeperFatSwrPartsPlan({
        liveTick: true,
        hasPlayerPeek: true,
        hasSleeperLeagues: true,
        hasEspnLeagues: true
      })
    ).toEqual({
      user: false,
      roster: false,
      names: false,
      leagues: false
    })
  })
})

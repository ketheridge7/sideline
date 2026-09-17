import type { League, Matchup, NflTickerGame, Player, ScorerChip, TapeEvent, Team, Transaction } from '@shared/types'
import { leagueKey } from '@shared/types'
import { lastName } from '@shared/display'

export const FEATURED_LEAGUE_KEY = 'sleeper:friday-night-gridiron'

const round1 = (value: number): number => Math.round(value * 10) / 10

const TAPE_T0 = Date.UTC(2025, 8, 7, 17, 12, 0)

type WorldLeague = League & { size: number; leadSpark: number[] }

type ScoreBeat = {
  kind: 'score'
  leagueId: string
  provider: League['provider']
  playerId: string
  delta: number
  note: string
}

type InjuryBeat = {
  kind: 'injury'
  at: number
  leagueId: string
  provider: League['provider']
  playerId: string
  status: string
  note: string
}

const player = (
  playerId: string,
  name: string,
  position: string,
  nflTeam: string,
  points: number,
  extra?: Partial<Player>
): Player => ({ playerId, name, position, nflTeam, points, ...extra })

const team = (id: string, name: string, owner: string, record: string): Team => ({
  id,
  name,
  owner,
  record
})

const sumPts = (rows: Player[]): number =>
  round1(rows.reduce((total, row) => total + (row.points ?? 0), 0))

const clonePlayers = (rows: Player[]): Player[] => rows.map((row) => ({ ...row }))

const cloneMatchup = (row: Matchup): Matchup => ({
  myTeam: { ...row.myTeam },
  oppTeam: row.oppTeam ? { ...row.oppTeam } : null,
  myPoints: row.myPoints,
  oppPoints: row.oppPoints,
  ...(row.myProjectedPoints != null ? { myProjectedPoints: row.myProjectedPoints } : {}),
  ...(row.oppProjectedPoints != null ? { oppProjectedPoints: row.oppProjectedPoints } : {}),
  ...(row.myWinPct != null ? { myWinPct: row.myWinPct } : {}),
  ...(row.oppWinPct != null ? { oppWinPct: row.oppWinPct } : {}),
  ...(row.winPctSource ? { winPctSource: row.winPctSource } : {}),
  starters: clonePlayers(row.starters),
  bench: clonePlayers(row.bench),
  oppStarters: clonePlayers(row.oppStarters),
  oppBench: clonePlayers(row.oppBench),
  ...(row.scoresFinal ? { scoresFinal: true } : {})
})

const WORLD_LEAGUES: WorldLeague[] = [
  {
    id: 'friday-night-gridiron',
    name: 'Friday Night Gridiron',
    provider: 'sleeper',
    season: '2025',
    week: 1,
    size: 12,
    leadSpark: [6.2, 7.8, 9.4, 10.1, 11.6]
  },
  {
    id: 'fourth-drunken',
    name: 'Fourth & Drunken',
    provider: 'sleeper',
    season: '2025',
    week: 1,
    size: 10,
    leadSpark: [-9.2, -11.4, -13.8, -15.1, -16.5]
  },
  {
    id: 'sunday-lights',
    name: 'Sunday Lights',
    provider: 'sleeper',
    season: '2025',
    week: 1,
    size: 12,
    leadSpark: [1.2, 2.6, 3.1, 4.0, 4.2]
  },
  {
    id: '90664721',
    name: 'Gridiron Gurus',
    provider: 'espn',
    season: '2025',
    week: 1,
    size: 10,
    leadSpark: [4.4, 5.8, 6.9, 7.6, 8.1]
  },
  {
    id: '55112233',
    name: 'The Homies',
    provider: 'espn',
    season: '2025',
    week: 1,
    size: 12,
    leadSpark: [-1.1, -1.8, -2.6, -3.0, -3.4]
  },
  {
    id: 'benchwarmers',
    name: 'Waiver Wire Warriors',
    provider: 'sleeper',
    season: '2025',
    week: 1,
    size: 10,
    leadSpark: [0.4, 0.8, 1.4, 1.8, 2.0]
  }
]

const MATCHUPS: Record<string, Matchup> = {
  'sleeper:friday-night-gridiron': {
    myTeam: team('fng-me', 'Gibbs Me Head', 'Kevin', '1-0'),
    oppTeam: team('fng-opp', 'The Other Guys', 'Marcus', '0-1'),
    myPoints: 142.8,
    oppPoints: 131.2,
    starters: [
      player('fng-fields', 'Justin Fields', 'QB', 'PIT', 18.4),
      player('fng-gibbs', 'Jahmyr Gibbs', 'RB', 'DET', 24.7),
      player('fng-henry', 'Derrick Henry', 'RB', 'BAL', 16.2),
      player('fng-lamb', 'CeeDee Lamb', 'WR', 'DAL', 23.1),
      player('fng-sun-god', 'Amon-Ra St. Brown', 'WR', 'DET', 14.8),
      player('fng-kelce', 'Travis Kelce', 'TE', 'KC', 11.4),
      player('fng-collins', 'Nico Collins', 'FLEX', 'HOU', 12.6),
      player('fng-bates', 'Jake Bates', 'K', 'ATL', 13.1),
      player('fng-pit-def', 'Steelers D/ST', 'DEF', 'PIT', 8.5)
    ],
    bench: [
      player('fng-nacua', 'Puka Nacua', 'WR', 'LAR', 10.1),
      player('fng-dowdle', 'Rico Dowdle', 'RB', 'DAL', 4.2),
      player('fng-jamo', 'Jameson Williams', 'WR', 'DET', 3.8)
    ],
    oppStarters: [
      player('fng-allen', 'Josh Allen', 'QB', 'BUF', 22.1),
      player('fng-saquon', 'Saquon Barkley', 'RB', 'PHI', 18.4),
      player('fng-hall', 'Breece Hall', 'RB', 'NYJ', 11.0),
      player('fng-jj', 'Justin Jefferson', 'WR', 'MIN', 19.2),
      player('fng-hill', 'Tyreek Hill', 'WR', 'MIA', 10.2),
      player('fng-kittle', 'George Kittle', 'TE', 'SF', 9.1),
      player('fng-ajb', 'A.J. Brown', 'FLEX', 'PHI', 14.6),
      player('fng-butker', 'Harrison Butker', 'K', 'KC', 12.8),
      player('fng-bal-def', 'Ravens D/ST', 'DEF', 'BAL', 13.8)
    ],
    oppBench: [
      player('fng-pacheco', 'Isiah Pacheco', 'RB', 'KC', 6.4),
      player('fng-dell', 'Tank Dell', 'WR', 'HOU', 2.1)
    ]
  },
  'sleeper:fourth-drunken': {
    myTeam: team('fd-me', 'Drunk Tank', 'Riley', '0-1'),
    oppTeam: team('fd-opp', 'Sober Sundays', 'Pat', '1-0'),
    myPoints: 98.4,
    oppPoints: 114.9,
    starters: [
      player('fd-stroud', 'C.J. Stroud', 'QB', 'HOU', 14.2),
      player('fd-cmc', 'Christian McCaffrey', 'RB', 'SF', 12.8),
      player('fd-mixon', 'Joe Mixon', 'RB', 'HOU', 9.4),
      player('fd-chase', 'Ja\'Marr Chase', 'WR', 'CIN', 18.6),
      player('fd-waddle', 'Jaylen Waddle', 'WR', 'MIA', 8.1),
      player('fd-hock', 'T.J. Hockenson', 'TE', 'MIN', 6.4),
      player('fd-mooney', 'Darnell Mooney', 'FLEX', 'ATL', 7.2),
      player('fd-tucker', 'Justin Tucker', 'K', 'BAL', 11.0),
      player('fd-cle-def', 'Browns D/ST', 'DEF', 'CLE', 10.7)
    ],
    bench: [player('fd-allgeier', 'Tyler Allgeier', 'RB', 'ATL', 3.2)],
    oppStarters: [
      player('fd-mahomes', 'Patrick Mahomes', 'QB', 'KC', 24.8),
      player('fd-kamara', 'Alvin Kamara', 'RB', 'NO', 16.1),
      player('fd-walker', 'Kenneth Walker III', 'RB', 'SEA', 13.4),
      player('fd-hill-opp', 'Tyreek Hill', 'WR', 'MIA', 15.2),
      player('fd-adams', 'Davante Adams', 'WR', 'NYJ', 12.0),
      player('fd-andrews', 'Mark Andrews', 'TE', 'BAL', 8.8),
      player('fd-pittman', 'Michael Pittman Jr.', 'FLEX', 'IND', 9.6),
      player('fd-aubrey', 'Brandon Aubrey', 'K', 'DAL', 8.4),
      player('fd-sf-def', '49ers D/ST', 'DEF', 'SF', 6.6)
    ],
    oppBench: []
  },
  'sleeper:sunday-lights': {
    myTeam: team('sl-me', 'Sunday Night Lights', 'Sideline Demo', '8-5'),
    oppTeam: team('sl-opp', 'Gridiron Ghosts', 'Rival GM', '7-6'),
    myPoints: 121.0,
    oppPoints: 116.8,
    starters: [
      player('sl-hurts', 'Jalen Hurts', 'QB', 'PHI', 22.4),
      player('sl-gibbs', 'Jahmyr Gibbs', 'RB', 'DET', 18.1),
      player('sl-barkley', 'Saquon Barkley', 'RB', 'PHI', 14.6),
      player('sl-arsb', 'Amon-Ra St. Brown', 'WR', 'DET', 12.2),
      player('sl-lamb', 'CeeDee Lamb', 'WR', 'DAL', 9.8),
      player('sl-kelce', 'Travis Kelce', 'TE', 'KC', 11.4),
      player('sl-nico', 'Nico Collins', 'FLEX', 'HOU', 8.0),
      player('sl-tucker', 'Justin Tucker', 'K', 'BAL', 13.5),
      player('sl-phi-def', 'Eagles D/ST', 'DEF', 'PHI', 11.0)
    ],
    bench: [player('sl-mattison', 'Alexander Mattison', 'RB', 'MIA', 0)],
    oppStarters: [
      player('sl-allen', 'Josh Allen', 'QB', 'BUF', 19.2),
      player('sl-henry', 'Derrick Henry', 'RB', 'BAL', 16.4),
      player('sl-hall', 'Breece Hall', 'RB', 'NYJ', 13.1),
      player('sl-jj', 'Justin Jefferson', 'WR', 'MIN', 11.0),
      player('sl-tyreek', 'Tyreek Hill', 'WR', 'MIA', 10.2),
      player('sl-kittle', 'George Kittle', 'TE', 'SF', 9.1),
      player('sl-ajb', 'A.J. Brown', 'FLEX', 'PHI', 7.4),
      player('sl-butker', 'Harrison Butker', 'K', 'KC', 12.8),
      player('sl-bal-def', 'Ravens D/ST', 'DEF', 'BAL', 17.6)
    ],
    oppBench: []
  },
  'espn:90664721': {
    myTeam: team('gg-me', 'Fourth & Fearless', 'Ada', '1-0'),
    oppTeam: team('gg-opp', 'Red Zone Renegades', 'Bo', '0-1'),
    myPoints: 133.4,
    oppPoints: 125.3,
    starters: [
      player('gg-lamar', 'Lamar Jackson', 'QB', 'BAL', 26.8),
      player('gg-achane', 'De\'Von Achane', 'RB', 'MIA', 15.4),
      player('gg-cook', 'James Cook', 'RB', 'BUF', 12.1),
      player('gg-cd', 'CeeDee Lamb', 'WR', 'DAL', 18.6),
      player('gg-evans', 'Mike Evans', 'WR', 'TB', 14.2),
      player('gg-mcbride', 'Trey McBride', 'TE', 'ARI', 10.8),
      player('gg-rice', 'Rashee Rice', 'FLEX', 'KC', 11.4),
      player('gg-bass', 'Tyler Bass', 'K', 'BUF', 9.1),
      player('gg-dal-def', 'Cowboys D/ST', 'DEF', 'DAL', 15.0)
    ],
    bench: [player('gg-downs', 'Josh Downs', 'WR', 'IND', 6.2)],
    oppStarters: [
      player('gg-burrow', 'Joe Burrow', 'QB', 'CIN', 21.4),
      player('gg-taylor', 'Jonathan Taylor', 'RB', 'IND', 17.8),
      player('gg-conner', 'James Conner', 'RB', 'ARI', 13.2),
      player('gg-chase', 'Ja\'Marr Chase', 'WR', 'CIN', 16.6),
      player('gg-nash', 'Nico Collins', 'WR', 'HOU', 12.0),
      player('gg-la-porta', 'Sam LaPorta', 'TE', 'DET', 8.4),
      player('gg-mooney', 'Darnell Mooney', 'FLEX', 'ATL', 9.9),
      player('gg-fairbairn', 'Ka\'imi Fairbairn', 'K', 'HOU', 10.2),
      player('gg-mia-def', 'Dolphins D/ST', 'DEF', 'MIA', 15.8)
    ],
    oppBench: [player('gg-conner-bn', 'James Conner', 'RB', 'ARI', 0)]
  },
  'espn:55112233': {
    myTeam: team('hm-me', 'Riverdalers', 'Sam', '0-1'),
    oppTeam: team('hm-opp', 'Show Me Your TDs', 'Chris', '1-0'),
    myPoints: 108.2,
    oppPoints: 111.6,
    starters: [
      player('hm-dak', 'Dak Prescott', 'QB', 'DAL', 16.4),
      player('hm-pollard', 'Tony Pollard', 'RB', 'TEN', 11.2),
      player('hm-dowdle', 'Rico Dowdle', 'RB', 'DAL', 8.8),
      player('hm-pickens', 'George Pickens', 'WR', 'PIT', 14.6),
      player('hm-diontae', 'Diontae Johnson', 'WR', 'BAL', 9.4),
      player('hm-kincaid', 'Dalton Kincaid', 'TE', 'BUF', 7.1),
      player('hm-shakir', 'Khalil Shakir', 'FLEX', 'BUF', 10.3),
      player('hm-sanders', 'Chris Boswell', 'K', 'PIT', 12.0),
      player('hm-nyj-def', 'Jets D/ST', 'DEF', 'NYJ', 18.4)
    ],
    bench: [player('hm-allgeier', 'Tyler Allgeier', 'RB', 'ATL', 1.4)],
    oppStarters: [
      player('hm-love', 'Jordan Love', 'QB', 'GB', 18.8),
      player('hm-irving', 'Bucky Irving', 'RB', 'TB', 14.1),
      player('hm-swift', 'D\'Andre Swift', 'RB', 'CHI', 10.6),
      player('hm-olave', 'Chris Olave', 'WR', 'NO', 13.2),
      player('hm-godwin', 'Chris Godwin', 'WR', 'TB', 11.8),
      player('hm-engram', 'Evan Engram', 'TE', 'JAX', 8.4),
      player('hm-jamo', 'Jameson Williams', 'FLEX', 'DET', 9.7),
      player('hm-mcpherson', 'Evan McPherson', 'K', 'CIN', 11.0),
      player('hm-gb-def', 'Packers D/ST', 'DEF', 'GB', 14.0)
    ],
    oppBench: []
  },
  'sleeper:benchwarmers': {
    myTeam: team('bw-me', 'The Benchwarmers', 'Lee', '1-0'),
    oppTeam: team('bw-opp', 'Red Zone Renegades', 'Mo', '0-1'),
    myPoints: 119.7,
    oppPoints: 117.7,
    starters: [
      player('bw-maye', 'Drake Maye', 'QB', 'NE', 17.6),
      player('bw-gibbs', 'Jahmyr Gibbs', 'RB', 'DET', 15.2),
      player('bw-walker', 'Kenneth Walker III', 'RB', 'SEA', 12.8),
      player('bw-pittman', 'Michael Pittman Jr.', 'WR', 'IND', 14.4),
      player('bw-waddle', 'Jaylen Waddle', 'WR', 'MIA', 11.1),
      player('bw-bowers', 'Brock Bowers', 'TE', 'LV', 13.6),
      player('bw-conner', 'James Conner', 'FLEX', 'ARI', 10.2),
      player('bw-grupe', 'Blake Grupe', 'K', 'NO', 9.4),
      player('bw-den-def', 'Broncos D/ST', 'DEF', 'DEN', 15.4)
    ],
    bench: [player('bw-mooney', 'Darnell Mooney', 'WR', 'ATL', 4.8)],
    oppStarters: [
      player('bw-daniels', 'Jayden Daniels', 'QB', 'WAS', 20.4),
      player('bw-bijan', 'Bijan Robinson', 'RB', 'ATL', 16.8),
      player('bw-kyren', 'Kyren Williams', 'RB', 'LAR', 12.2),
      player('bw-nabers', 'Malik Nabers', 'WR', 'NYG', 15.0),
      player('bw-btj', 'Brian Thomas Jr.', 'WR', 'JAX', 11.6),
      player('bw-njoku', 'David Njoku', 'TE', 'CLE', 8.1),
      player('bw-conner-opp', 'James Conner', 'FLEX', 'ARI', 9.4),
      player('bw-loop', 'Jason Myers', 'K', 'SEA', 10.0),
      player('bw-was-def', 'Commanders D/ST', 'DEF', 'WAS', 14.2)
    ],
    oppBench: []
  }
}

const SCORE_BEATS: ScoreBeat[] = [
  { kind: 'score', provider: 'sleeper', leagueId: 'friday-night-gridiron', playerId: 'fng-gibbs', delta: 6.2, note: 'TD' },
  { kind: 'score', provider: 'sleeper', leagueId: 'friday-night-gridiron', playerId: 'fng-hill', delta: -2.0, note: 'FUM' },
  { kind: 'score', provider: 'sleeper', leagueId: 'friday-night-gridiron', playerId: 'fng-lamb', delta: 3.4, note: 'REC' },
  { kind: 'score', provider: 'sleeper', leagueId: 'friday-night-gridiron', playerId: 'fng-allen', delta: -0.3, note: 'SK' },
  { kind: 'score', provider: 'espn', leagueId: '90664721', playerId: 'gg-lamar', delta: 4.6, note: 'TD' },
  { kind: 'score', provider: 'sleeper', leagueId: 'fourth-drunken', playerId: 'fd-cmc', delta: -1.6, note: 'FUM' },
  { kind: 'score', provider: 'sleeper', leagueId: 'friday-night-gridiron', playerId: 'fng-fields', delta: -1.6, note: 'INT' },
  { kind: 'score', provider: 'sleeper', leagueId: 'friday-night-gridiron', playerId: 'fng-bates', delta: 3.0, note: 'FG' },
  { kind: 'score', provider: 'espn', leagueId: '55112233', playerId: 'hm-pickens', delta: 6.4, note: 'TD' },
  { kind: 'score', provider: 'sleeper', leagueId: 'sunday-lights', playerId: 'sl-hurts', delta: 2.4, note: 'RUSH' },
  { kind: 'score', provider: 'sleeper', leagueId: 'benchwarmers', playerId: 'bw-bowers', delta: 1.8, note: 'REC' },
  { kind: 'score', provider: 'sleeper', leagueId: 'friday-night-gridiron', playerId: 'fng-saquon', delta: -0.2, note: 'FUM' }
]

const INJURY_BEAT: InjuryBeat = {
  kind: 'injury',
  at: 3,
  provider: 'sleeper',
  leagueId: 'friday-night-gridiron',
  playerId: 'fng-dowdle',
  status: 'OUT',
  note: 'LEFT GAME (ANKLE)'
}

const SEED_TAPE: Omit<TapeEvent, 'at'>[] = [
  { id: 'seed-gibbs-td', kind: 'score', player: 'Gibbs DET', detail: 'TD', delta: 6.2, leagueKey: FEATURED_LEAGUE_KEY, leagueName: 'Friday Night Gridiron', period: '2ND' },
  { id: 'seed-hill-fum', kind: 'score', player: 'Hill MIA', detail: 'FUM', delta: -2.0, leagueKey: FEATURED_LEAGUE_KEY, leagueName: 'Friday Night Gridiron', period: '2ND' },
  { id: 'seed-lamb', kind: 'score', player: 'Lamb DAL', detail: 'REC', delta: 3.4, leagueKey: FEATURED_LEAGUE_KEY, leagueName: 'Friday Night Gridiron', period: '2ND' },
  { id: 'seed-allen-sk', kind: 'score', player: 'Allen BUF', detail: 'SK', delta: -0.3, leagueKey: FEATURED_LEAGUE_KEY, leagueName: 'Friday Night Gridiron', period: '1ST' },
  { id: 'seed-dowdle-inj', kind: 'injury', player: 'Dowdle DAL', detail: 'LEFT GAME (ANKLE)', leagueKey: FEATURED_LEAGUE_KEY, leagueName: 'Friday Night Gridiron', period: '2ND' },
  { id: 'seed-downs-waiver', kind: 'add', player: 'Downs IND', detail: 'WAIVER CLAIM', leagueKey: 'sleeper:fourth-drunken', leagueName: 'Fourth & Drunken', period: '1ST' },
  { id: 'seed-bates-fg', kind: 'score', player: 'Bates ATL', detail: 'FG', delta: 3.0, leagueKey: FEATURED_LEAGUE_KEY, leagueName: 'Friday Night Gridiron', period: '1ST' },
  { id: 'seed-cmc-fum', kind: 'score', player: 'McCaffrey SF', detail: 'FUM', delta: -1.6, leagueKey: 'sleeper:fourth-drunken', leagueName: 'Fourth & Drunken', period: '1ST' },
  { id: 'seed-lamar', kind: 'score', player: 'Jackson BAL', detail: 'TD', delta: 4.6, leagueKey: 'espn:90664721', leagueName: 'Gridiron Gurus', period: '1ST' },
  { id: 'seed-fields-int', kind: 'score', player: 'Fields PIT', detail: 'INT', delta: -1.6, leagueKey: FEATURED_LEAGUE_KEY, leagueName: 'Friday Night Gridiron', period: '1ST' }
]

const TICKER: NflTickerGame[] = [
  { id: 'cle-cin', away: 'CLE', awayScore: 17, home: 'CIN', homeScore: 24, clock: '4TH 1:52' },
  { id: 'det-kc', away: 'DET', awayScore: 21, home: 'KC', homeScore: 20, clock: '3RD 8:14' },
  { id: 'dal-nyg', away: 'DAL', awayScore: 28, home: 'NYG', homeScore: 14, clock: 'FINAL', final: true },
  { id: 'buf-mia', away: 'BUF', awayScore: 31, home: 'MIA', homeScore: 10, clock: '2ND 4:03' },
  { id: 'bal-pit', away: 'BAL', awayScore: 17, home: 'PIT', homeScore: 17, clock: '4TH 0:48' },
  { id: 'sf-lar', away: 'SF', awayScore: 24, home: 'LAR', homeScore: 27, clock: 'FINAL', final: true }
]

const WAIVER_TX: Transaction = {
  id: 'replay-waiver-downs',
  type: 'add',
  players: ['Josh Downs'],
  timestamp: TAPE_T0 - 12 * 60_000
}

const allPlayers = (matchup: Matchup): Player[] => [
  ...matchup.starters,
  ...matchup.bench,
  ...matchup.oppStarters,
  ...matchup.oppBench
]

const findPlayer = (matchup: Matchup, playerId: string): Player | undefined =>
  allPlayers(matchup).find((row) => row.playerId === playerId)

const leagueKeyOf = (beat: { provider: League['provider']; leagueId: string }): string =>
  leagueKey(beat.provider, beat.leagueId)

const applyBeat = (matchup: Matchup, beat: ScoreBeat, thisTick: boolean): void => {
  const row = findPlayer(matchup, beat.playerId)
  if (!row || typeof row.points !== 'number') return
  row.points = round1(row.points + beat.delta)
  row.lastPlay = beat.note
  if (thisTick) row.tickDelta = beat.delta
}

const recomputeTotals = (matchup: Matchup): void => {
  matchup.myPoints = sumPts(matchup.starters)
  matchup.oppPoints = sumPts(matchup.oppStarters)
}

const worldLeague = (league: League): WorldLeague | undefined =>
  WORLD_LEAGUES.find((row) => row.provider === league.provider && row.id === league.id)

export const replayWorldLeagues = (week: number): League[] =>
  WORLD_LEAGUES.map((row) => ({
    id: row.id,
    name: row.name,
    provider: row.provider,
    season: row.season,
    week
  }))

export const replayMatchupFor = (league: League, tick: number): Matchup | null => {
  const key = leagueKey(league.provider, league.id)
  const base = MATCHUPS[key]
  if (!base) return null
  const matchup = cloneMatchup(base)
  for (let step = 1; step <= tick; step += 1) {
    const beat = SCORE_BEATS[(step - 1) % SCORE_BEATS.length]
    if (leagueKeyOf(beat) !== key) continue
    applyBeat(matchup, beat, step === tick)
  }
  if (tick >= INJURY_BEAT.at && leagueKeyOf(INJURY_BEAT) === key) {
    const row = findPlayer(matchup, INJURY_BEAT.playerId)
    if (row) {
      row.status = INJURY_BEAT.status
      row.lastPlay = INJURY_BEAT.note
    }
  }
  recomputeTotals(matchup)
  return matchup
}

export const replayTransactionsFor = (league: League, _tick: number): Transaction[] => {
  if (league.provider === 'sleeper' && league.id === 'fourth-drunken') return [WAIVER_TX]
  return []
}

export const replaySeedTape = (): TapeEvent[] =>
  SEED_TAPE.map((row, index) => ({
    ...row,
    at: TAPE_T0 - index * 47_000
  }))

export const replayTickerGames = (): NflTickerGame[] => TICKER.map((row) => ({ ...row }))

const SEED_SCORERS: Record<string, ScorerChip[]> = {
  'sleeper:friday-night-gridiron': [
    { playerId: 'fng-gibbs', name: 'Gibbs', position: 'RB', points: 24.7, delta: 6.2 },
    { playerId: 'fng-lamb', name: 'Lamb', position: 'WR', points: 23.1, delta: 3.4 },
    { playerId: 'fng-hill', name: 'Hill', position: 'WR', points: 10.2, delta: -2.0 }
  ],
  'sleeper:fourth-drunken': [
    { playerId: 'fd-chase', name: 'Chase', position: 'WR', points: 18.6, delta: 6.4 },
    { playerId: 'fd-cmc', name: 'McCaffrey', position: 'RB', points: 12.8, delta: -1.6 },
    { playerId: 'fd-mahomes', name: 'Mahomes', position: 'QB', points: 24.8, delta: 4.2 }
  ],
  'sleeper:sunday-lights': [
    { playerId: 'sl-hurts', name: 'Hurts', position: 'QB', points: 22.4, delta: 2.4 },
    { playerId: 'sl-henry', name: 'Henry', position: 'RB', points: 16.4, delta: 15.2 },
    { playerId: 'sl-tyreek', name: 'Hill', position: 'WR', points: 10.2, delta: -0.8 }
  ],
  'espn:90664721': [
    { playerId: 'gg-lamar', name: 'Jackson', position: 'QB', points: 26.8, delta: 4.6 },
    { playerId: 'gg-cd', name: 'Lamb', position: 'WR', points: 18.6, delta: 3.1 },
    { playerId: 'gg-burrow', name: 'Burrow', position: 'QB', points: 21.4, delta: -1.2 }
  ],
  'espn:55112233': [
    { playerId: 'hm-pickens', name: 'Pickens', position: 'WR', points: 14.6, delta: 6.4 },
    { playerId: 'hm-irving', name: 'Irving', position: 'RB', points: 14.1, delta: 2.2 },
    { playerId: 'hm-dak', name: 'Prescott', position: 'QB', points: 16.4, delta: -0.4 }
  ],
  'sleeper:benchwarmers': [
    { playerId: 'bw-bowers', name: 'Bowers', position: 'TE', points: 13.6, delta: 1.8 },
    { playerId: 'bw-nabers', name: 'Nabers', position: 'WR', points: 15.0, delta: 5.2 },
    { playerId: 'bw-kyren', name: 'Williams', position: 'RB', points: 12.2, delta: -0.6 }
  ]
}

export const replayLastScorers = (league: League, tick: number): ScorerChip[] => {
  const key = leagueKey(league.provider, league.id)
  const matchup = replayMatchupFor(league, tick)
  const chips: ScorerChip[] = []
  const seen = new Set<string>()
  if (matchup && tick >= 1) {
    for (let step = tick; step >= 1 && chips.length < 3; step -= 1) {
      const beat = SCORE_BEATS[(step - 1) % SCORE_BEATS.length]
      if (leagueKeyOf(beat) !== key) continue
      if (seen.has(beat.playerId)) continue
      const row = findPlayer(matchup, beat.playerId)
      if (!row) continue
      seen.add(beat.playerId)
      chips.push({
        playerId: row.playerId,
        name: lastName(row.name),
        position: row.position,
        points: row.points ?? 0,
        delta: beat.delta
      })
    }
  }
  for (const seed of SEED_SCORERS[key] ?? []) {
    if (chips.length >= 3) break
    if (seen.has(seed.playerId)) continue
    seen.add(seed.playerId)
    chips.push({ ...seed })
  }
  return chips
}

export const replayBoardExtra = (league: League, tick: number) => {
  const meta = worldLeague(league)
  const matchup = replayMatchupFor(league, tick)
  const lead = matchup ? round1(matchup.myPoints - matchup.oppPoints) : 0
  const spark = [...(meta?.leadSpark ?? [])]
  if (spark[spark.length - 1] !== lead) spark.push(lead)
  return {
    lastScorers: replayLastScorers(league, tick),
    leadSpark: spark.slice(-8),
    size: meta?.size
  }
}

export const replayScoreBeats = (): ScoreBeat[] => [...SCORE_BEATS]

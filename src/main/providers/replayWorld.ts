import type { League, Matchup, NflTickerGame, Player, TapeEvent, Team, Transaction } from '@shared/types'
import { leagueKey } from '@shared/types'
import { tapePlayerLabel } from '@shared/display'
import { estimatedChanceToWin } from '@shared/winPct'

export const REPLAY_SEASON = '2026'
export const REPLAY_WEEK = 3

const round1 = (value: number): number => Math.round(value * 10) / 10
const round2 = (value: number): number => Math.round(value * 100) / 100

/**
 * Replay "Sunday-real" slate (Designer spec, MARKETING_REPLAY_SPEC §1). Tick 0 is the
 * pinned marketing frame: Friday Night Gridiron, Ice Box 98.4 vs Hash Marks 91.2,
 * Est. win% ~62/38, several games in Q2–early Q3, one FINAL on the ticker. As ticks
 * pass, halftime ends, early games go final, and the late window kicks off.
 */
type GameStatus = 'final' | 'live' | 'half' | 'pre'

type GamePhase = { from: number; status: GameStatus; clock: string }

type SlateGame = {
  id: string
  away: string
  home: string
  awayScore: number
  homeScore: number
  /** Share of regulation already played at tick 0 (0–1). Seeds default remaining projections. */
  progress: number
  phases: GamePhase[]
}

const live = (clock: string, finalAt: number): GamePhase[] => [
  { from: 0, status: 'live', clock },
  { from: finalAt, status: 'final', clock: 'FINAL' }
]

/** ~3s per replay tick: the late window kicks off about 16 minutes in. */
const LATE_KICKOFF_STEP = 320

const late = (kickoff: string, liveClock: string, offset = 0): GamePhase[] => [
  { from: 0, status: 'pre', clock: kickoff },
  { from: LATE_KICKOFF_STEP + offset, status: 'live', clock: liveClock }
]

const game = (
  id: string,
  away: string,
  awayScore: number,
  home: string,
  homeScore: number,
  progress: number,
  phases: GamePhase[]
): SlateGame => ({ id, away, home, awayScore, homeScore, progress, phases })

/** Ticker order leads with the spec §1.4 strip. */
const SLATE: SlateGame[] = [
  game('det-kc', 'DET', 21, 'KC', 20, 0.61, live('3RD 8:14', 300)),
  game('dal-nyg', 'DAL', 28, 'NYG', 14, 1, [{ from: 0, status: 'final', clock: 'FINAL' }]),
  game('buf-mia', 'BUF', 24, 'MIA', 17, 0.43, live('2ND 4:03', 450)),
  game('phi-atl', 'PHI', 14, 'ATL', 10, 0.21, live('1ST 2:11', 600)),
  game('pit-lac', 'PIT', 17, 'LAC', 14, 0.5, [
    { from: 0, status: 'half', clock: 'HALFTIME' },
    { from: 30, status: 'live', clock: '3RD 14:10' },
    { from: 360, status: 'final', clock: 'FINAL' }
  ]),
  game('hou-ind', 'HOU', 10, 'IND', 13, 0.47, live('2ND 1:47', 450)),
  game('sf-lar', 'SF', 7, 'LAR', 3, 0.35, live('2ND 9:30', 500)),
  game('ari-sea', 'ARI', 13, 'SEA', 10, 0.55, live('3RD 12:05', 320)),
  game('cin-bal', 'CIN', 3, 'BAL', 17, 0.39, live('2ND 6:30', 480)),
  game('no-tb', 'NO', 0, 'TB', 0, 0, late('4:05 PM', '1ST 11:52')),
  game('ne-nyj', 'NE', 0, 'NYJ', 0, 0, late('4:05 PM', '1ST 12:20')),
  game('car-jax', 'CAR', 0, 'JAX', 0, 0, late('4:25 PM', '1ST 13:40', 40)),
  game('den-lv', 'DEN', 0, 'LV', 0, 0, late('4:25 PM', '1ST 13:05', 40)),
  game('min-cle', 'MIN', 0, 'CLE', 0, 0, late('4:25 PM', '1ST 12:48', 40)),
  game('gb-chi', 'GB', 0, 'CHI', 0, 0, [{ from: 0, status: 'pre', clock: '8:20 PM' }]),
  game('was-ten', 'WAS', 0, 'TEN', 0, 0, [{ from: 0, status: 'pre', clock: 'MON 8:15 PM' }])
]

const phaseAt = (slateGame: SlateGame, step: number): GamePhase => {
  let current = slateGame.phases[0]
  for (const phase of slateGame.phases) {
    if (phase.from <= step) current = phase
  }
  return current
}

const GAME_BY_TEAM = new Map<string, SlateGame>(
  SLATE.flatMap((row) => [
    [row.away, row],
    [row.home, row]
  ])
)

type PoolPlayer = {
  name: string
  position: string
  nflTeam: string
  /** Fantasy points on the pinned frame (tick 0). */
  points: number
  /** Points still expected this week. Defaults from the position and game clock. */
  remaining?: number
  status?: string
  note?: string
}

const slug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const p = (name: string, position: string, nflTeam: string, points: number, remaining?: number): PoolPlayer => ({
  name,
  position,
  nflTeam,
  points,
  ...(remaining != null ? { remaining } : {})
})

/**
 * Display names are what the product prints: full name on the companion LineupRow,
 * LAST on HUD rails, LAST NFL on the tape. D/ST rows use the nickname (STEELERS).
 * Pool keys are internal only and never reach the UI.
 */
const POOL_ROWS: PoolPlayer[] = [
  // Friday Night Gridiron — Ice Box (Maya). Starters sum 98.4, 30.0 still to come.
  p('Justin Fields', 'QB', 'PIT', 18.4, 7),
  p('Jahmyr Gibbs', 'RB', 'DET', 16.2, 4),
  p('David Montgomery', 'RB', 'DET', 9.1, 3),
  p('Amon-Ra St. Brown', 'WR', 'DET', 14.6, 4),
  p('Tyreek Hill', 'WR', 'MIA', 8.3, 3.5),
  p('Travis Kelce', 'TE', 'KC', 7.4, 3),
  p('Nico Collins', 'WR', 'HOU', 11.8, 4),
  p('Brandon Aubrey', 'K', 'DAL', 6),
  p('Steelers', 'DEF', 'PIT', 6.6, 1.5),
  { ...p('Rico Dowdle', 'RB', 'DAL', 3.1), status: 'OUT', note: 'LEFT GAME (ANKLE)' },
  p('Najee Harris', 'RB', 'PIT', 4.6),
  p('Jerry Jeudy', 'WR', 'CLE', 0),
  p('Keon Coleman', 'WR', 'BUF', 3.7),
  p('Tyjae Spears', 'RB', 'TEN', 0),
  p('Drake Maye', 'QB', 'NE', 0),
  // Friday Night Gridiron — Hash Marks (Owen). Starters sum 91.2, 31.9 still to come.
  p('Josh Allen', 'QB', 'BUF', 21.1, 7),
  p('Saquon Barkley', 'RB', 'PHI', 15.4, 4.5),
  p('James Conner', 'RB', 'ARI', 5.8, 3),
  p('A.J. Brown', 'WR', 'PHI', 14.2, 4),
  p('Drake London', 'WR', 'ATL', 6.9, 3.5),
  p('George Kittle', 'TE', 'SF', 4.2, 3),
  p('Jaylen Waddle', 'WR', 'MIA', 8.1, 2.5),
  p('Tyler Bass', 'K', 'BUF', 5, 2.9),
  p('Ravens', 'DEF', 'BAL', 10.5, 1.5),
  p('Brian Robinson Jr.', 'RB', 'WAS', 0),
  p('Jordan Addison', 'WR', 'MIN', 0),
  p('Tank Bigsby', 'RB', 'JAX', 0),
  p('Pat Freiermuth', 'TE', 'PIT', 2.4),
  p('Justin Herbert', 'QB', 'LAC', 11.9),
  p('Romeo Doubs', 'WR', 'GB', 0),
  // Fourth & Drunken — Last Call 84.1 vs Sober Sundays 102.6.
  p('C.J. Stroud', 'QB', 'HOU', 12.3),
  p('Christian McCaffrey', 'RB', 'SF', 14.1),
  p('Jonathan Taylor', 'RB', 'IND', 13),
  p("Ja'Marr Chase", 'WR', 'CIN', 9.4),
  p('Puka Nacua', 'WR', 'LAR', 12.2),
  p('Trey McBride', 'TE', 'ARI', 6.8),
  p('Jaxon Smith-Njigba', 'WR', 'SEA', 9.1),
  p('Cameron Dicker', 'K', 'LAC', 5),
  p('Chiefs', 'DEF', 'KC', 2.2),
  p('Tony Pollard', 'RB', 'TEN', 0),
  p('Chris Godwin', 'WR', 'TB', 0),
  p('Dallas Goedert', 'TE', 'PHI', 3.3),
  p('Baker Mayfield', 'QB', 'TB', 0),
  p('Lamar Jackson', 'QB', 'BAL', 22.6),
  p('Bijan Robinson', 'RB', 'ATL', 9.8),
  p('Kyren Williams', 'RB', 'LAR', 11.4),
  p('Justin Jefferson', 'WR', 'MIN', 0),
  p('CeeDee Lamb', 'WR', 'DAL', 24.3),
  p('Mark Andrews', 'TE', 'BAL', 8.1),
  p('Malik Nabers', 'WR', 'NYG', 17.2),
  p('Harrison Butker', 'K', 'KC', 6),
  p('Chargers', 'DEF', 'LAC', 3.2),
  p('Travis Etienne Jr.', 'RB', 'JAX', 0),
  p('DeAndre Hopkins', 'WR', 'BAL', 2.9),
  p('Kyle Pitts', 'TE', 'ATL', 1.8),
  p('Caleb Williams', 'QB', 'CHI', 0),
  // Sunday Lights — Night Shift 71.0 vs Gridiron Ghosts 68.4.
  p('Jalen Hurts', 'QB', 'PHI', 11.6),
  p("De'Von Achane", 'RB', 'MIA', 10.2),
  p('Breece Hall', 'RB', 'NYJ', 0),
  p('Tee Higgins', 'WR', 'CIN', 7.3),
  p('Zay Flowers', 'WR', 'BAL', 9.9),
  p('Sam LaPorta', 'TE', 'DET', 6.4),
  p('James Cook', 'RB', 'BUF', 12.1),
  p('Jake Bates', 'K', 'DET', 7),
  p('Texans', 'DEF', 'HOU', 6.5),
  p('Chuba Hubbard', 'RB', 'CAR', 0),
  p('Terry McLaurin', 'WR', 'WAS', 0),
  p('Cooper Kupp', 'WR', 'SEA', 4.4),
  p('Bryce Young', 'QB', 'CAR', 0),
  p('Joe Burrow', 'QB', 'CIN', 9.8),
  p('Kenneth Walker III', 'RB', 'SEA', 8.7),
  p('Garrett Wilson', 'WR', 'NYJ', 0),
  p('DK Metcalf', 'WR', 'PIT', 7.4),
  p('Dalton Kincaid', 'TE', 'BUF', 5.5),
  p('Rashee Rice', 'WR', 'KC', 9.3),
  p('Chris Boswell', 'K', 'PIT', 4),
  p('49ers', 'DEF', 'SF', 7.5),
  p('Rhamondre Stevenson', 'RB', 'NE', 0),
  p('Jayden Reed', 'WR', 'GB', 0),
  p('Calvin Ridley', 'WR', 'TEN', 0),
  p('Darnell Mooney', 'WR', 'ATL', 1.4),
  // Waiver Wire Warriors — Priority Wire 55.2 vs Claim Jumpers 49.8.
  p('Jordan Love', 'QB', 'GB', 0),
  p('Josh Jacobs', 'RB', 'GB', 0),
  p('Joe Mixon', 'RB', 'HOU', 8.8),
  p('Davante Adams', 'WR', 'LAR', 10.3),
  p('Jameson Williams', 'WR', 'DET', 11.2),
  p('Jake Ferguson', 'TE', 'DAL', 9.4),
  p('Jaylen Warren', 'RB', 'PIT', 5.9),
  p('Jason Myers', 'K', 'SEA', 6),
  p('Seahawks', 'DEF', 'SEA', 3.6),
  p('Courtland Sutton', 'WR', 'DEN', 0),
  p("D'Andre Swift", 'RB', 'CHI', 0),
  p('Brock Purdy', 'QB', 'SF', 8.1),
  p('Jerome Ford', 'RB', 'CLE', 0),
  p('Kyler Murray', 'QB', 'ARI', 13.2),
  p('Isiah Pacheco', 'RB', 'KC', 6.1),
  p('Jonathon Brooks', 'RB', 'CAR', 0),
  p('Ladd McConkey', 'WR', 'LAC', 8.8),
  p('Khalil Shakir', 'WR', 'BUF', 5.2),
  p('David Njoku', 'TE', 'CLE', 0),
  p('Jauan Jennings', 'WR', 'SF', 4.7),
  p('Tyler Loop', 'K', 'BAL', 8),
  p('Dolphins', 'DEF', 'MIA', 3.8),
  p('Rachaad White', 'RB', 'TB', 0),
  p('Elijah Moore', 'WR', 'CLE', 0),
  p('Tucker Kraft', 'TE', 'GB', 0),
  p('Sam Darnold', 'QB', 'SEA', 7.6),
  // Gridiron Gurus (ESPN) — Fourth & Fearless 112.3 vs End Zone Errands 88.0. The late stack is mostly spent.
  p('Patrick Mahomes', 'QB', 'KC', 21.4, 3),
  p('Derrick Henry', 'RB', 'BAL', 19.6, 3),
  p('Tyrone Tracy Jr.', 'RB', 'NYG', 13.4),
  p('George Pickens', 'WR', 'PIT', 14.8, 3),
  p('DeVonta Smith', 'WR', 'PHI', 9.3, 5),
  p('Brock Bowers', 'TE', 'LV', 0),
  p('Marvin Harrison Jr.', 'WR', 'ARI', 16.1, 3),
  p("Ka'imi Fairbairn", 'K', 'HOU', 9.7, 2),
  p('Lions', 'DEF', 'DET', 8, 1),
  p('Bucky Irving', 'RB', 'TB', 0),
  p('Mike Evans', 'WR', 'TB', 0),
  p('Rome Odunze', 'WR', 'CHI', 0),
  p('Travis Hunter', 'WR', 'JAX', 0),
  p('Geno Smith', 'QB', 'LV', 0),
  p('Dak Prescott', 'QB', 'DAL', 18.8),
  p('Javonte Williams', 'RB', 'DAL', 15.2),
  p('Chase Brown', 'RB', 'CIN', 10.4),
  p('Josh Downs', 'WR', 'IND', 8.4),
  p("Wan'Dale Robinson", 'WR', 'NYG', 11.6),
  p('Tyler Warren', 'TE', 'IND', 7.7),
  p('Quentin Johnston', 'WR', 'LAC', 9.9),
  p('Jake Elliott', 'K', 'PHI', 5),
  p('Giants', 'DEF', 'NYG', 1),
  p('Brian Thomas Jr.', 'WR', 'JAX', 0),
  p('Jordan Mason', 'RB', 'MIN', 0),
  p('Stefon Diggs', 'WR', 'NE', 0),
  p('Jalen Tolbert', 'WR', 'DAL', 3.9),
  // Basement Bowl (ESPN) — River City 40.1 vs First Down Club 61.7.
  p('Matthew Stafford', 'QB', 'LAR', 14.3),
  p('Alvin Kamara', 'RB', 'NO', 0),
  p('Kaleb Johnson', 'RB', 'PIT', 3.2),
  p('Chris Olave', 'WR', 'NO', 0),
  p('Keenan Allen', 'WR', 'LAC', 6.8),
  p('Hunter Henry', 'TE', 'NE', 0),
  p('Xavier Worthy', 'WR', 'KC', 12.4),
  p('Younghoe Koo', 'K', 'ATL', 3.4),
  p('Patriots', 'DEF', 'NE', 0),
  p('Aaron Jones', 'RB', 'MIN', 0),
  p('Jakobi Meyers', 'WR', 'LV', 0),
  p('Christian Watson', 'WR', 'GB', 0),
  p('Jaylen Wright', 'RB', 'MIA', 2.2),
  p('Jared Goff', 'QB', 'DET', 15.6),
  p('Kenneth Gainwell', 'RB', 'PIT', 4.4),
  p('Zach Charbonnet', 'RB', 'SEA', 7.1),
  p('Christian Kirk', 'WR', 'HOU', 8.5),
  p('Ricky Pearsall', 'WR', 'SF', 5.9),
  p('Evan Engram', 'TE', 'DEN', 0),
  p('Hollywood Brown', 'WR', 'KC', 7.2),
  p('Chad Ryland', 'K', 'ARI', 7),
  p('Eagles', 'DEF', 'PHI', 6),
  p('Tetairoa McMillan', 'WR', 'CAR', 0),
  p('Emeka Egbuka', 'WR', 'TB', 0),
  p('Colston Loveland', 'TE', 'CHI', 0),
  p('Bo Nix', 'QB', 'DEN', 0)
]

const POOL = new Map<string, PoolPlayer>(POOL_ROWS.map((row) => [slug(row.name), row]))

const poolRow = (id: string): PoolPlayer => {
  const row = POOL.get(id)
  if (!row) throw new Error(`replay pool missing ${id}`)
  return row
}

const STARTER_SLOTS = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF'] as const

type Roster = {
  team: Team
  starters: string[]
  bench: string[]
}

type WorldLeague = League & {
  short: string
  size: number
  featured: boolean
  my: Roster
  opp: Roster
}

const ids = (...names: string[]): string[] => names.map(slug)

const roster = (team: Team, starters: string[], bench: string[]): Roster => ({
  team,
  starters: ids(...starters),
  bench: ids(...bench)
})

const league = (
  row: Omit<WorldLeague, 'season' | 'week' | 'featured'> & { featured?: boolean }
): WorldLeague => ({ season: REPLAY_SEASON, week: REPLAY_WEEK, featured: false, ...row })

/** MY LEAGUES order from spec §1.1: four Sleeper, then two ESPN. */
const WORLD_LEAGUES: WorldLeague[] = [
  league({
    id: 'friday-night-gridiron',
    short: 'fri',
    name: 'Friday Night Gridiron',
    provider: 'sleeper',
    size: 12,
    featured: true,
    my: roster(
      { id: 'fri-ice-box', name: 'Ice Box', owner: 'Maya', record: '2-0' },
      ['Justin Fields', 'Jahmyr Gibbs', 'David Montgomery', 'Amon-Ra St. Brown', 'Tyreek Hill', 'Travis Kelce', 'Nico Collins', 'Brandon Aubrey', 'Steelers'],
      ['Rico Dowdle', 'Najee Harris', 'Jerry Jeudy', 'Keon Coleman', 'Tyjae Spears', 'Drake Maye']
    ),
    opp: roster(
      { id: 'fri-hash-marks', name: 'Hash Marks', owner: 'Owen', record: '1-1' },
      ['Josh Allen', 'Saquon Barkley', 'James Conner', 'A.J. Brown', 'Drake London', 'George Kittle', 'Jaylen Waddle', 'Tyler Bass', 'Ravens'],
      ['Brian Robinson Jr.', 'Jordan Addison', 'Tank Bigsby', 'Pat Freiermuth', 'Justin Herbert', 'Romeo Doubs']
    )
  }),
  league({
    id: 'fourth-drunken',
    short: 'fdr',
    name: 'Fourth & Drunken',
    provider: 'sleeper',
    size: 10,
    my: roster(
      { id: 'fdr-last-call', name: 'Last Call', owner: 'Riley', record: '0-2' },
      ['C.J. Stroud', 'Christian McCaffrey', 'Jonathan Taylor', "Ja'Marr Chase", 'Puka Nacua', 'Trey McBride', 'Jaxon Smith-Njigba', 'Cameron Dicker', 'Chiefs'],
      ['Tony Pollard', 'Chris Godwin', 'Dallas Goedert', 'Baker Mayfield']
    ),
    opp: roster(
      { id: 'fdr-sober-sundays', name: 'Sober Sundays', owner: 'Pat', record: '2-0' },
      ['Lamar Jackson', 'Bijan Robinson', 'Kyren Williams', 'Justin Jefferson', 'CeeDee Lamb', 'Mark Andrews', 'Malik Nabers', 'Harrison Butker', 'Chargers'],
      ['Travis Etienne Jr.', 'DeAndre Hopkins', 'Kyle Pitts', 'Caleb Williams']
    )
  }),
  league({
    id: 'sunday-lights',
    short: 'sul',
    name: 'Sunday Lights',
    provider: 'sleeper',
    size: 12,
    my: roster(
      { id: 'sul-night-shift', name: 'Night Shift', owner: 'Chris', record: '1-1' },
      ['Jalen Hurts', "De'Von Achane", 'Breece Hall', 'Tee Higgins', 'Zay Flowers', 'Sam LaPorta', 'James Cook', 'Jake Bates', 'Texans'],
      ['Chuba Hubbard', 'Terry McLaurin', 'Cooper Kupp', 'Bryce Young']
    ),
    opp: roster(
      { id: 'sul-gridiron-ghosts', name: 'Gridiron Ghosts', owner: 'Jordan', record: '1-1' },
      ['Joe Burrow', 'Kenneth Walker III', 'Jahmyr Gibbs', 'Garrett Wilson', 'DK Metcalf', 'Dalton Kincaid', 'Rashee Rice', 'Chris Boswell', '49ers'],
      ['Rhamondre Stevenson', 'Jayden Reed', 'Calvin Ridley', 'Darnell Mooney']
    )
  }),
  league({
    id: 'waiver-wire',
    short: 'www',
    name: 'Waiver Wire Warriors',
    provider: 'sleeper',
    size: 10,
    my: roster(
      { id: 'www-priority-wire', name: 'Priority Wire', owner: 'Lee', record: '1-1' },
      ['Jordan Love', 'Josh Jacobs', 'Joe Mixon', 'Davante Adams', 'Jameson Williams', 'Jake Ferguson', 'Jaylen Warren', 'Jason Myers', 'Seahawks'],
      ['Courtland Sutton', "D'Andre Swift", 'Brock Purdy', 'Jerome Ford']
    ),
    opp: roster(
      { id: 'www-claim-jumpers', name: 'Claim Jumpers', owner: 'Mo', record: '1-1' },
      ['Kyler Murray', 'Isiah Pacheco', 'Jonathon Brooks', 'Ladd McConkey', 'Khalil Shakir', 'David Njoku', 'Jauan Jennings', 'Tyler Loop', 'Dolphins'],
      ['Rachaad White', 'Elijah Moore', 'Tucker Kraft', 'Sam Darnold']
    )
  }),
  league({
    id: 'gridiron-gurus',
    short: 'ggu',
    name: 'Gridiron Gurus',
    provider: 'espn',
    size: 10,
    my: roster(
      { id: 'ggu-fourth-fearless', name: 'Fourth & Fearless', owner: 'Ada', record: '2-0' },
      ['Patrick Mahomes', 'Derrick Henry', 'Tyrone Tracy Jr.', 'George Pickens', 'DeVonta Smith', 'Brock Bowers', 'Marvin Harrison Jr.', "Ka'imi Fairbairn", 'Lions'],
      ['Bucky Irving', 'Mike Evans', 'Rome Odunze', 'Travis Hunter', 'Geno Smith']
    ),
    opp: roster(
      { id: 'ggu-end-zone-errands', name: 'End Zone Errands', owner: 'Bo', record: '1-1' },
      ['Dak Prescott', 'Javonte Williams', 'Chase Brown', 'Josh Downs', "Wan'Dale Robinson", 'Tyler Warren', 'Quentin Johnston', 'Jake Elliott', 'Giants'],
      ['Brian Thomas Jr.', 'Jordan Mason', 'Stefon Diggs', 'Jalen Tolbert']
    )
  }),
  league({
    id: 'basement-bowl',
    short: 'bbl',
    name: 'Basement Bowl',
    provider: 'espn',
    size: 12,
    my: roster(
      { id: 'bbl-river-city', name: 'River City', owner: 'Sam', record: '1-1' },
      ['Matthew Stafford', 'Alvin Kamara', 'Kaleb Johnson', 'Chris Olave', 'Keenan Allen', 'Hunter Henry', 'Xavier Worthy', 'Younghoe Koo', 'Patriots'],
      ['Aaron Jones', 'Jakobi Meyers', 'Christian Watson', 'Jaylen Wright']
    ),
    opp: roster(
      { id: 'bbl-first-down-club', name: 'First Down Club', owner: 'Nia', record: '2-0' },
      ['Jared Goff', 'Kenneth Gainwell', 'Zach Charbonnet', 'Christian Kirk', 'Ricky Pearsall', 'Evan Engram', 'Hollywood Brown', 'Chad Ryland', 'Eagles'],
      ['Tetairoa McMillan', 'Emeka Egbuka', 'Colston Loveland', 'Bo Nix']
    )
  })
]

export const FEATURED_LEAGUE_KEY = leagueKey(WORLD_LEAGUES[0].provider, WORLD_LEAGUES[0].id)

export const REPLAY_FEATURED_KEYS: string[] = WORLD_LEAGUES.filter((row) => row.featured).map((row) =>
  leagueKey(row.provider, row.id)
)

const worldKey = (row: WorldLeague): string => leagueKey(row.provider, row.id)

const rosterIds = (row: Roster): string[] => [...row.starters, ...row.bench]

const leaguesRostering = (poolId: string): WorldLeague[] =>
  WORLD_LEAGUES.filter((row) => rosterIds(row.my).includes(poolId) || rosterIds(row.opp).includes(poolId))

const ROSTERED = new Set<string>(WORLD_LEAGUES.flatMap((row) => [...rosterIds(row.my), ...rosterIds(row.opp)]))

/** Featured starters move most often so both HUD boards tick while you watch. */
const playWeight = (poolId: string): number => {
  let weight = 1
  for (const row of WORLD_LEAGUES) {
    if (!row.featured) continue
    if (row.my.starters.includes(poolId) || row.opp.starters.includes(poolId)) weight = Math.max(weight, 2.5)
    else if (row.my.bench.includes(poolId) || row.opp.bench.includes(poolId)) weight = Math.max(weight, 1.5)
  }
  return weight
}

type Credit = { player: string; delta: number; note: string }

type PlayBeat = {
  kind: 'play'
  credits: Credit[]
  /** NFL points this play puts on the ticker for the scoring team. */
  nflPoints?: number
}

type InjuryBeat = {
  kind: 'injury'
  player: string
  status: string
  note: string
}

export type ReplayBeat = PlayBeat | InjuryBeat

const play = (player: string, delta: number, note: string, nflPoints?: number): PlayBeat => ({
  kind: 'play',
  credits: [{ player: slug(player), delta, note }],
  ...(nflPoints ? { nflPoints } : {})
})

const passTd = (qb: string, qbDelta: number, target: string, targetDelta: number): PlayBeat => ({
  kind: 'play',
  credits: [
    { player: slug(qb), delta: qbDelta, note: 'PASS TD' },
    { player: slug(target), delta: targetDelta, note: 'REC TD' }
  ],
  nflPoints: 7
})

/** Opening minute: Ice Box and Hash Marks trade blows before the generated slate takes over. */
const SCRIPT: ReplayBeat[] = [
  play('Jahmyr Gibbs', 1.1, 'RUSH'),
  play('Ravens', 1, 'SACK'),
  play('Tyreek Hill', 2.3, 'REC'),
  play('Josh Allen', 1.2, 'PASS'),
  play('Nico Collins', 1.9, 'REC'),
  play('Saquon Barkley', 1.4, 'RUSH'),
  passTd('Patrick Mahomes', 4.3, 'Rashee Rice', 8.2),
  play('Travis Kelce', 1.7, 'REC'),
  passTd('Jalen Hurts', 4.4, 'A.J. Brown', 7.9),
  passTd('Jared Goff', 4, 'Amon-Ra St. Brown', 8.4),
  play('James Conner', 0.9, 'RUSH'),
  play('Tyler Bass', 3, 'FG', 3),
  play('David Montgomery', 1.2, 'RUSH'),
  play('Jaylen Waddle', 2.6, 'REC'),
  play('C.J. Stroud', 1.6, 'PASS'),
  play('George Kittle', 2.1, 'REC'),
  play("De'Von Achane", 2.4, 'REC'),
  play('Kyler Murray', 2.2, 'RUSH'),
  play('Drake London', 1.8, 'REC'),
  play('Jahmyr Gibbs', 2.2, 'REC')
]

type PlayOption = { delta: number; note: string; weight: number; nflPoints?: number; passTd?: boolean }

const PLAY_MENU: Record<string, PlayOption[]> = {
  QB: [
    { delta: 1.6, note: 'PASS', weight: 5 },
    { delta: 0.9, note: 'PASS', weight: 4 },
    { delta: 2.2, note: 'RUSH', weight: 2 },
    { delta: 4.4, note: 'PASS TD', weight: 1.5, nflPoints: 7 },
    { delta: -1, note: 'INT', weight: 0.8 }
  ],
  RB: [
    { delta: 1.3, note: 'RUSH', weight: 5 },
    { delta: 0.7, note: 'RUSH', weight: 3 },
    { delta: 2.4, note: 'REC', weight: 3 },
    { delta: 6.8, note: 'RUSH TD', weight: 1.2, nflPoints: 7 },
    { delta: -2, note: 'FUM', weight: 0.4 }
  ],
  WR: [
    { delta: 2.3, note: 'REC', weight: 5 },
    { delta: 1.6, note: 'REC', weight: 4 },
    { delta: 3.4, note: 'REC', weight: 2 },
    { delta: 8.2, note: 'REC TD', weight: 1, nflPoints: 7, passTd: true }
  ],
  TE: [
    { delta: 1.9, note: 'REC', weight: 5 },
    { delta: 2.8, note: 'REC', weight: 3 },
    { delta: 7.6, note: 'REC TD', weight: 0.8, nflPoints: 7, passTd: true }
  ],
  K: [
    { delta: 3, note: 'FG', weight: 4, nflPoints: 3 },
    { delta: 4, note: 'FG', weight: 2, nflPoints: 3 },
    { delta: 1, note: 'XP', weight: 3 }
  ],
  DEF: [
    { delta: 1, note: 'SACK', weight: 5 },
    { delta: 2, note: 'INT', weight: 2 },
    { delta: 2, note: 'FUM REC', weight: 1 },
    { delta: -1, note: 'PTS ALLOWED', weight: 1 }
  ]
}

/** Share of generated steps that land a play; the rest are quiet polls like a real Sunday. */
const PLAY_RATE = 0.35

const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pickWeighted = <T,>(rows: T[], weightOf: (row: T) => number, roll: number): T | undefined => {
  const total = rows.reduce((sum, row) => sum + weightOf(row), 0)
  if (!(total > 0)) return undefined
  let cursor = roll * total
  for (const row of rows) {
    cursor -= weightOf(row)
    if (cursor <= 0) return row
  }
  return rows[rows.length - 1]
}

type PlayerState = {
  points: number
  remaining: number
  status?: string
  lastPlay?: string
  lastStep?: number
  lastDelta?: number
}

export type WorldState = {
  step: number
  players: Map<string, PlayerState>
  scores: Map<string, { away: number; home: number }>
  leads: Map<string, number[]>
}

/** Typical full-game output; a live player is expected to add the unplayed share of it. */
const POSITION_PROJECTION: Record<string, number> = { QB: 19, RB: 13, WR: 13, TE: 9, K: 8, DEF: 7 }

const initialRemaining = (row: PoolPlayer): number => {
  if (row.status === 'OUT') return 0
  const slateGame = GAME_BY_TEAM.get(row.nflTeam)
  if (!slateGame) return 0
  const status = phaseAt(slateGame, 0).status
  if (status === 'final') return 0
  if (row.remaining != null) return row.remaining
  const projected = POSITION_PROJECTION[row.position] ?? 10
  switch (status) {
    case 'pre':
      return projected
    case 'live':
    case 'half':
      return round1(projected * (1 - slateGame.progress))
    default: {
      const _never: never = status
      return _never
    }
  }
}

const initialState = (): WorldState => {
  const players = new Map<string, PlayerState>()
  for (const [id, row] of POOL) {
    players.set(id, {
      points: row.points,
      remaining: initialRemaining(row),
      ...(row.status ? { status: row.status } : {}),
      ...(row.note ? { lastPlay: row.note } : {})
    })
  }
  const scores = new Map(SLATE.map((game) => [game.id, { away: game.awayScore, home: game.homeScore }]))
  return { step: 0, players, scores, leads: new Map(WORLD_LEAGUES.map((row) => [worldKey(row), []])) }
}

const cloneState = (state: WorldState): WorldState => ({
  step: state.step,
  players: new Map([...state.players].map(([id, row]) => [id, { ...row }])),
  scores: new Map([...state.scores].map(([id, row]) => [id, { ...row }])),
  leads: new Map([...state.leads].map(([id, row]) => [id, [...row]]))
})

const eligibleForPlay = (id: string, state: WorldState): boolean => {
  const row = POOL.get(id)
  const live = state.players.get(id)
  if (!row || !live) return false
  if (live.status === 'OUT' || live.remaining < 0.8) return false
  const game = GAME_BY_TEAM.get(row.nflTeam)
  return game != null && phaseAt(game, state.step + 1).status === 'live'
}

const teamQb = (nflTeam: string, state: WorldState): string | undefined =>
  [...ROSTERED].find((id) => {
    const row = POOL.get(id)
    return row?.position === 'QB' && row.nflTeam === nflTeam && state.players.get(id)?.status !== 'OUT'
  })

const generatedBeat = (step: number, state: WorldState): ReplayBeat | null => {
  const rand = mulberry32(step * 2654435761)
  if (rand() > PLAY_RATE) return null
  const candidates = [...ROSTERED].filter((id) => eligibleForPlay(id, state))
  const player = pickWeighted(candidates, playWeight, rand())
  if (!player) return null
  const row = poolRow(player)
  const remaining = state.players.get(player)?.remaining ?? 0
  const menu = (PLAY_MENU[row.position] ?? PLAY_MENU.WR).filter((opt) => opt.delta <= remaining + 2)
  const option = pickWeighted(menu, (opt) => opt.weight, rand())
  if (!option) return null
  const credits: Credit[] = [{ player, delta: option.delta, note: option.note }]
  if (option.passTd) {
    const qb = teamQb(row.nflTeam, state)
    if (qb) credits.push({ player: qb, delta: 4.3, note: 'PASS TD' })
  }
  return { kind: 'play', credits, ...(option.nflPoints ? { nflPoints: option.nflPoints } : {}) }
}

const replayBeatAt = (step: number, state: WorldState): ReplayBeat | null =>
  step <= SCRIPT.length ? SCRIPT[step - 1] : generatedBeat(step, state)

const leadOf = (row: WorldLeague, state: WorldState): number => {
  const sum = (list: string[]): number => list.reduce((total, id) => total + (state.players.get(id)?.points ?? 0), 0)
  return round1(sum(row.my.starters) - sum(row.opp.starters))
}

const applyBeat = (state: WorldState, beat: ReplayBeat, step: number): void => {
  switch (beat.kind) {
    case 'play': {
      for (const credit of beat.credits) {
        const live = state.players.get(credit.player)
        if (!live) continue
        live.points = round1(live.points + credit.delta)
        if (credit.delta > 0) live.remaining = Math.max(0, round1(live.remaining - credit.delta))
        live.lastDelta = live.lastStep === step ? round1((live.lastDelta ?? 0) + credit.delta) : credit.delta
        live.lastPlay = credit.note
        live.lastStep = step
      }
      const scorer = POOL.get(beat.credits[0]?.player ?? '')
      const game = scorer ? GAME_BY_TEAM.get(scorer.nflTeam) : undefined
      const score = game ? state.scores.get(game.id) : undefined
      if (beat.nflPoints && game && score && scorer) {
        if (game.away === scorer.nflTeam) score.away += beat.nflPoints
        else score.home += beat.nflPoints
      }
      return
    }
    case 'injury': {
      const live = state.players.get(beat.player)
      if (!live) return
      live.status = beat.status
      live.remaining = 0
      live.lastPlay = beat.note
      return
    }
    default: {
      const _never: never = beat
      return _never
    }
  }
}

/** A player whose game just went final keeps what he scored; nothing is left to project. */
const settleFinals = (state: WorldState): void => {
  for (const [id, live] of state.players) {
    if (live.remaining === 0) continue
    const team = POOL.get(id)?.nflTeam
    const game = team ? GAME_BY_TEAM.get(team) : undefined
    if (game && phaseAt(game, state.step).status === 'final') live.remaining = 0
  }
}

let memo: WorldState = initialState()

/** World after `tick` beats. Ticks only move forward in the app, so advance from the last state. */
export const replayWorldAt = (tick: number): WorldState => {
  const target = Math.max(0, Math.floor(tick))
  if (target < memo.step) memo = initialState()
  while (memo.step < target) {
    const step = memo.step + 1
    const beat = replayBeatAt(step, memo)
    if (beat) applyBeat(memo, beat, step)
    memo.step = step
    settleFinals(memo)
    for (const row of WORLD_LEAGUES) {
      const series = memo.leads.get(worldKey(row))
      const lead = leadOf(row, memo)
      if (series && series[series.length - 1] !== lead) series.push(lead)
    }
  }
  return cloneState(memo)
}

const toPlayer = (row: WorldLeague, id: string, slot: string | null, state: WorldState): Player => {
  const base = poolRow(id)
  const live = state.players.get(id)
  return {
    playerId: `${row.short}-${id}`,
    name: base.name,
    position: slot ?? base.position,
    nflTeam: base.nflTeam,
    points: live?.points ?? base.points,
    ...(live?.status ? { status: live.status } : {}),
    ...(live?.lastPlay ? { lastPlay: live.lastPlay } : {}),
    ...(live?.lastDelta != null && live.lastStep === state.step && state.step > 0
      ? { tickDelta: live.lastDelta }
      : {})
  }
}

const starters = (row: WorldLeague, side: Roster, state: WorldState): Player[] =>
  side.starters.map((id, index) => toPlayer(row, id, STARTER_SLOTS[index] ?? null, state))

const bench = (row: WorldLeague, side: Roster, state: WorldState): Player[] =>
  side.bench.map((id) => toPlayer(row, id, null, state))

const projectedTotal = (side: Roster, state: WorldState): number =>
  round1(
    side.starters.reduce((total, id) => {
      const live = state.players.get(id)
      return total + (live?.points ?? 0) + (live?.remaining ?? 0)
    }, 0)
  )

const sumPts = (rows: Player[]): number => round1(rows.reduce((total, row) => total + (row.points ?? 0), 0))

const worldLeague = (league: Pick<League, 'provider' | 'id'>): WorldLeague | undefined =>
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
  const row = worldLeague(league)
  if (!row) return null
  const state = replayWorldAt(tick)
  const myStarters = starters(row, row.my, state)
  const oppStarters = starters(row, row.opp, state)
  const myPoints = sumPts(myStarters)
  const oppPoints = sumPts(oppStarters)
  const myProjectedPoints = projectedTotal(row.my, state)
  const oppProjectedPoints = projectedTotal(row.opp, state)
  const matchup: Matchup = {
    myTeam: { ...row.my.team },
    oppTeam: { ...row.opp.team },
    myPoints,
    oppPoints,
    myProjectedPoints,
    oppProjectedPoints,
    winPctSource: row.provider === 'espn' ? 'official' : 'estimated',
    starters: myStarters,
    bench: bench(row, row.my, state),
    oppStarters,
    oppBench: bench(row, row.opp, state)
  }
  if (row.provider === 'espn') {
    const chance = estimatedChanceToWin({
      myLive: myPoints,
      oppLive: oppPoints,
      myProjected: myProjectedPoints,
      oppProjected: oppProjectedPoints
    })
    if (chance) {
      matchup.myWinPct = round2(chance.mine)
      matchup.oppWinPct = round2(1 - round2(chance.mine))
    }
  }
  return matchup
}

export const replayTransactionsFor = (league: League, _tick: number): Transaction[] => {
  if (league.provider === 'sleeper' && league.id === 'fourth-drunken') return [WAIVER_TX]
  return []
}

/** Demo tape reads as "earlier this afternoon" relative to when the demo started. */
const TAPE_ANCHOR = Date.now()

const WAIVER_TX: Transaction = {
  id: 'replay-waiver-pollard',
  type: 'add',
  players: ['Tony Pollard'],
  timestamp: TAPE_ANCHOR - 104 * 60_000
}

type SeedPlay = {
  player: string
  minutesAgo: number
  period: string
} & ({ kind: 'score'; delta: number; note: string } | { kind: 'injury'; note: string })

/** Already counted in the pinned points. Friday Night Gridiron rows follow spec §1.3. */
const SEED_PLAYS: SeedPlay[] = [
  { kind: 'score', player: 'Jahmyr Gibbs', delta: 6.2, note: 'TD', minutesAgo: 1, period: '3RD' },
  { kind: 'score', player: 'Kyler Murray', delta: 1.8, note: 'PASS', minutesAgo: 3, period: '3RD' },
  { kind: 'score', player: 'Tyreek Hill', delta: -2, note: 'FUM', minutesAgo: 7, period: '2ND' },
  { kind: 'score', player: 'Jameson Williams', delta: 8.1, note: 'REC TD', minutesAgo: 12, period: '3RD' },
  { kind: 'score', player: 'DK Metcalf', delta: 1.6, note: 'REC', minutesAgo: 18, period: '2ND' },
  { kind: 'score', player: 'Josh Allen', delta: 4, note: 'PASS TD', minutesAgo: 24, period: '2ND' },
  { kind: 'score', player: 'Matthew Stafford', delta: 1.2, note: 'PASS', minutesAgo: 27, period: '2ND' },
  { kind: 'score', player: 'Amon-Ra St. Brown', delta: 1.8, note: 'REC', minutesAgo: 31, period: '2ND' },
  { kind: 'score', player: 'Patrick Mahomes', delta: 4.3, note: 'PASS TD', minutesAgo: 40, period: '2ND' },
  { kind: 'score', player: 'Jalen Hurts', delta: 2.4, note: 'RUSH', minutesAgo: 45, period: '1ST' },
  { kind: 'injury', player: 'Rico Dowdle', note: 'LEFT GAME (ANKLE)', minutesAgo: 53, period: '3RD' },
  { kind: 'score', player: 'CeeDee Lamb', delta: 8.4, note: 'REC TD', minutesAgo: 60, period: '4TH' },
  { kind: 'score', player: 'George Pickens', delta: 3.1, note: 'REC', minutesAgo: 66, period: '2ND' },
  { kind: 'score', player: 'Ravens', delta: 2, note: 'INT', minutesAgo: 77, period: '1ST' },
  { kind: 'score', player: "Ja'Marr Chase", delta: 2.2, note: 'REC', minutesAgo: 85, period: '1ST' },
  { kind: 'score', player: 'Justin Fields', delta: 1.4, note: 'RUSH', minutesAgo: 94, period: '1ST' },
  { kind: 'score', player: 'Jared Goff', delta: 4, note: 'PASS TD', minutesAgo: 99, period: '1ST' },
  { kind: 'score', player: 'Dak Prescott', delta: 4.2, note: 'PASS TD', minutesAgo: 110, period: '3RD' }
]

const SEED_ROSTER_MOVES: (Omit<TapeEvent, 'at'> & { minutesAgo: number })[] = [
  {
    id: 'seed-pollard-waiver',
    kind: 'add',
    player: 'Pollard TEN',
    detail: 'WAIVER CLAIM',
    leagueKey: 'sleeper:fourth-drunken',
    leagueName: 'Fourth & Drunken',
    period: '1ST',
    minutesAgo: 104
  },
  {
    id: 'seed-kupp-trade',
    kind: 'trade',
    player: 'Kupp SEA',
    detail: 'TRADE',
    leagueKey: 'sleeper:sunday-lights',
    leagueName: 'Sunday Lights',
    period: '1ST',
    minutesAgo: 115
  }
]

const tapeLabel = (poolId: string): string => {
  const row = poolRow(poolId)
  return tapePlayerLabel({ playerId: poolId, name: row.name, position: row.position, nflTeam: row.nflTeam })
}

export const replaySeedTape = (anchor = TAPE_ANCHOR): TapeEvent[] => {
  const out: TapeEvent[] = []
  SEED_PLAYS.forEach((seed, index) => {
    const id = slug(seed.player)
    for (const row of leaguesRostering(id)) {
      const key = worldKey(row)
      const at = anchor - seed.minutesAgo * 60_000
      const base = { id: `seed-${index}-${row.short}-${id}`, at, leagueKey: key, leagueName: row.name, period: seed.period, player: tapeLabel(id) }
      switch (seed.kind) {
        case 'score':
          out.push({ ...base, kind: 'score', detail: seed.note, delta: seed.delta })
          break
        case 'injury':
          out.push({ ...base, kind: 'injury', detail: seed.note })
          break
        default: {
          const _never: never = seed
          void _never
        }
      }
    }
  })
  for (const { minutesAgo, ...row } of SEED_ROSTER_MOVES) {
    out.push({ ...row, at: anchor - minutesAgo * 60_000 })
  }
  return out.sort((a, b) => b.at - a.at)
}

export const replayTickerGames = (tick = 0): NflTickerGame[] => {
  const state = replayWorldAt(tick)
  const out: NflTickerGame[] = []
  for (const game of SLATE) {
    const phase = phaseAt(game, state.step)
    if (phase.status === 'pre') continue
    const score = state.scores.get(game.id) ?? { away: game.awayScore, home: game.homeScore }
    out.push({
      id: game.id,
      away: game.away,
      awayScore: score.away,
      home: game.home,
      homeScore: score.home,
      clock: phase.clock,
      ...(phase.status === 'final' ? { final: true } : {})
    })
  }
  return out
}

/** Lead history before the demo opened, rebuilt by rewinding the seeded plays. */
const seededLeadHistory = (row: WorldLeague, lead0: number): number[] => {
  const history: number[] = []
  let lead = lead0
  for (const seed of SEED_PLAYS) {
    if (seed.kind !== 'score') continue
    const id = slug(seed.player)
    if (row.my.starters.includes(id)) lead = round1(lead - seed.delta)
    else if (row.opp.starters.includes(id)) lead = round1(lead + seed.delta)
    else continue
    history.unshift(lead)
  }
  return history
}

export const replayBoardExtra = (league: League, tick: number): { leadSpark: number[]; size?: number } => {
  const row = worldLeague(league)
  if (!row) return { leadSpark: [] }
  const lead0 = leadOf(row, initialState())
  const state = replayWorldAt(tick)
  const spark = [...seededLeadHistory(row, lead0), lead0, ...(state.leads.get(worldKey(row)) ?? [])]
  return { leadSpark: spark.slice(-8), size: row.size }
}

export const replayScript = (): ReplayBeat[] => [...SCRIPT]

export const replayRosteredPlayers = (): { id: string; name: string; nflTeam: string }[] =>
  [...ROSTERED].map((id) => ({ id, name: poolRow(id).name, nflTeam: poolRow(id).nflTeam }))

export const replayGameStatus = (nflTeam: string, tick = 0): GameStatus | undefined => {
  const game = GAME_BY_TEAM.get(nflTeam)
  return game ? phaseAt(game, tick).status : undefined
}

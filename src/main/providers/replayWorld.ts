import type { League, Matchup, NflTickerGame, Player, TapeEvent, Team, Transaction } from '@shared/types'
import { leagueKey } from '@shared/types'
import { tapePlayerLabel } from '@shared/display'
import { estimatedChanceToWin } from '@shared/winPct'

export const REPLAY_SEASON = '2026'
export const REPLAY_WEEK = 3

const round1 = (value: number): number => Math.round(value * 10) / 10
const round2 = (value: number): number => Math.round(value * 100) / 100

/**
 * Demo Sunday: Week 3, ~2:45pm ET. Thursday night is final, the 1:00 window is
 * in the 3rd/4th quarter, and the 4:05/4:25, SNF, and MNF players have not kicked
 * off. Team totals open mid-game (roughly 45–90) and project to ~95–140. As ticks
 * pass, halftime ends, the early window goes final, and the late window kicks off.
 */
type GameStatus = 'final' | 'live' | 'half' | 'pre'

type GamePhase = { from: number; status: GameStatus; clock: string }

type SlateGame = {
  id: string
  away: string
  home: string
  awayScore: number
  homeScore: number
  /** Share of regulation already played at tick 0 (0–1). Seeds each player's remaining projection. */
  progress: number
  phases: GamePhase[]
}

/** ~3s per replay tick: early window goes final ~15 minutes in, late window kicks off right after. */
const EARLY_FINAL_STEP = 300
const LATE_KICKOFF_STEP = 320

const early = (clock: string): GamePhase[] => [
  { from: 0, status: 'live', clock },
  { from: EARLY_FINAL_STEP, status: 'final', clock: 'FINAL' }
]

const late = (kickoff: string, liveClock: string, offset = 0): GamePhase[] => [
  { from: 0, status: 'pre', clock: kickoff },
  { from: LATE_KICKOFF_STEP + offset, status: 'live', clock: liveClock }
]

const SLATE: SlateGame[] = [
  { id: 'mia-buf', away: 'MIA', home: 'BUF', awayScore: 20, homeScore: 27, progress: 1, phases: [{ from: 0, status: 'final', clock: 'FINAL' }] },
  {
    id: 'lv-was',
    away: 'LV',
    home: 'WAS',
    awayScore: 16,
    homeScore: 24,
    progress: 0.78,
    phases: [
      { from: 0, status: 'live', clock: '13:02 - 4th' },
      { from: 160, status: 'final', clock: 'FINAL' }
    ]
  },
  { id: 'atl-car', away: 'ATL', home: 'CAR', awayScore: 20, homeScore: 10, progress: 0.72, phases: early('2:05 - 3rd') },
  { id: 'ind-ten', away: 'IND', home: 'TEN', awayScore: 21, homeScore: 7, progress: 0.68, phases: early('4:22 - 3rd') },
  { id: 'no-nyg', away: 'NO', home: 'NYG', awayScore: 10, homeScore: 7, progress: 0.65, phases: early('5:48 - 3rd') },
  { id: 'pit-ne', away: 'PIT', home: 'NE', awayScore: 13, homeScore: 10, progress: 0.64, phases: early('6:40 - 3rd') },
  { id: 'nyj-tb', away: 'NYJ', home: 'TB', awayScore: 3, homeScore: 10, progress: 0.63, phases: early('7:15 - 3rd') },
  { id: 'gb-cle', away: 'GB', home: 'CLE', awayScore: 17, homeScore: 6, progress: 0.6, phases: early('8:51 - 3rd') },
  { id: 'cin-min', away: 'CIN', home: 'MIN', awayScore: 17, homeScore: 14, progress: 0.58, phases: early('10:12 - 3rd') },
  { id: 'hou-jax', away: 'HOU', home: 'JAX', awayScore: 10, homeScore: 13, progress: 0.54, phases: early('12:30 - 3rd') },
  {
    id: 'lar-phi',
    away: 'LAR',
    home: 'PHI',
    awayScore: 14,
    homeScore: 17,
    progress: 0.5,
    phases: [
      { from: 0, status: 'half', clock: 'Halftime' },
      { from: 30, status: 'live', clock: '14:10 - 3rd' },
      { from: EARLY_FINAL_STEP + 60, status: 'final', clock: 'FINAL' }
    ]
  },
  { id: 'den-lac', away: 'DEN', home: 'LAC', awayScore: 0, homeScore: 0, progress: 0, phases: late('4:05 PM', '11:52 - 1st') },
  { id: 'dal-sf', away: 'DAL', home: 'SF', awayScore: 0, homeScore: 0, progress: 0, phases: late('4:25 PM', '13:40 - 1st', 40) },
  { id: 'det-ari', away: 'DET', home: 'ARI', awayScore: 0, homeScore: 0, progress: 0, phases: late('4:25 PM', '13:05 - 1st', 40) },
  { id: 'kc-bal', away: 'KC', home: 'BAL', awayScore: 0, homeScore: 0, progress: 0, phases: [{ from: 0, status: 'pre', clock: '8:20 PM' }] },
  { id: 'chi-sea', away: 'CHI', home: 'SEA', awayScore: 0, homeScore: 0, progress: 0, phases: [{ from: 0, status: 'pre', clock: 'MON 8:15 PM' }] }
]

const phaseAt = (game: SlateGame, step: number): GamePhase => {
  let current = game.phases[0]
  for (const phase of game.phases) {
    if (phase.from <= step) current = phase
  }
  return current
}

const GAME_BY_TEAM = new Map<string, SlateGame>(
  SLATE.flatMap((game) => [
    [game.away, game],
    [game.home, game]
  ])
)

type PoolPlayer = {
  name: string
  position: string
  nflTeam: string
  /** Fantasy points at the demo kickoff (tick 0). */
  points: number
  /** Full-game projection. */
  projected: number
  status?: string
  note?: string
}

const slug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const POOL_ROWS: PoolPlayer[] = [
  // Thursday night — final.
  { name: 'Josh Allen', position: 'QB', nflTeam: 'BUF', points: 26.3, projected: 23 },
  { name: 'James Cook', position: 'RB', nflTeam: 'BUF', points: 21.2, projected: 15 },
  { name: 'Dalton Kincaid', position: 'TE', nflTeam: 'BUF', points: 11.7, projected: 9 },
  { name: 'Khalil Shakir', position: 'WR', nflTeam: 'BUF', points: 9.4, projected: 10 },
  { name: 'Keon Coleman', position: 'WR', nflTeam: 'BUF', points: 6.9, projected: 8 },
  { name: 'Ray Davis', position: 'RB', nflTeam: 'BUF', points: 1.8, projected: 4 },
  { name: 'Tyler Bass', position: 'K', nflTeam: 'BUF', points: 9, projected: 8 },
  { name: 'Bills D/ST', position: 'DEF', nflTeam: 'BUF', points: 5, projected: 7 },
  { name: "De'Von Achane", position: 'RB', nflTeam: 'MIA', points: 19.4, projected: 17 },
  { name: 'Jaylen Waddle', position: 'WR', nflTeam: 'MIA', points: 12.6, projected: 12 },
  { name: 'Jaylen Wright', position: 'RB', nflTeam: 'MIA', points: 1.4, projected: 4 },
  // 1:00 window — in progress.
  { name: 'Brock Bowers', position: 'TE', nflTeam: 'LV', points: 10.4, projected: 13 },
  { name: 'Ashton Jeanty', position: 'RB', nflTeam: 'LV', points: 14.5, projected: 16 },
  { name: 'Jakobi Meyers', position: 'WR', nflTeam: 'LV', points: 8.9, projected: 10 },
  { name: 'Tre Tucker', position: 'WR', nflTeam: 'LV', points: 4.9, projected: 6 },
  { name: 'Jayden Daniels', position: 'QB', nflTeam: 'WAS', points: 19.6, projected: 21 },
  { name: 'Terry McLaurin', position: 'WR', nflTeam: 'WAS', points: 13.9, projected: 13 },
  { name: 'Matt Gay', position: 'K', nflTeam: 'WAS', points: 8, projected: 8 },
  { name: 'Commanders D/ST', position: 'DEF', nflTeam: 'WAS', points: 8, projected: 6 },
  { name: 'Bijan Robinson', position: 'RB', nflTeam: 'ATL', points: 17.8, projected: 19 },
  { name: 'Drake London', position: 'WR', nflTeam: 'ATL', points: 11.9, projected: 14 },
  { name: 'Kyle Pitts', position: 'TE', nflTeam: 'ATL', points: 7.2, projected: 8 },
  { name: 'Darnell Mooney', position: 'WR', nflTeam: 'ATL', points: 5.8, projected: 7 },
  { name: 'Tyler Allgeier', position: 'RB', nflTeam: 'ATL', points: 2.9, projected: 6 },
  { name: 'Falcons D/ST', position: 'DEF', nflTeam: 'ATL', points: 7, projected: 6 },
  { name: 'Chuba Hubbard', position: 'RB', nflTeam: 'CAR', points: 9.9, projected: 13 },
  { name: 'Tetairoa McMillan', position: 'WR', nflTeam: 'CAR', points: 9.4, projected: 13 },
  { name: 'Rico Dowdle', position: 'RB', nflTeam: 'CAR', points: 2.4, projected: 7 },
  { name: 'Bryce Young', position: 'QB', nflTeam: 'CAR', points: 12, projected: 14 },
  { name: 'Jonathan Taylor', position: 'RB', nflTeam: 'IND', points: 15.2, projected: 16 },
  { name: 'Michael Pittman Jr.', position: 'WR', nflTeam: 'IND', points: 12.4, projected: 11 },
  { name: 'Tyler Warren', position: 'TE', nflTeam: 'IND', points: 8.2, projected: 10 },
  { name: 'Josh Downs', position: 'WR', nflTeam: 'IND', points: 6.6, projected: 9 },
  { name: 'Colts D/ST', position: 'DEF', nflTeam: 'IND', points: 8, projected: 6 },
  { name: 'Calvin Ridley', position: 'WR', nflTeam: 'TEN', points: 5.9, projected: 9 },
  { name: 'Tony Pollard', position: 'RB', nflTeam: 'TEN', points: 7.9, projected: 11 },
  { name: 'Tyjae Spears', position: 'RB', nflTeam: 'TEN', points: 3.7, projected: 7 },
  { name: 'Chris Olave', position: 'WR', nflTeam: 'NO', points: 10.7, projected: 13 },
  { name: 'Alvin Kamara', position: 'RB', nflTeam: 'NO', points: 9.3, projected: 12 },
  { name: 'Malik Nabers', position: 'WR', nflTeam: 'NYG', points: 9.8, projected: 15 },
  { name: 'Cam Skattebo', position: 'RB', nflTeam: 'NYG', points: 8.6, projected: 11 },
  { name: "Wan'Dale Robinson", position: 'WR', nflTeam: 'NYG', points: 7.1, projected: 9 },
  { name: 'Tyrone Tracy Jr.', position: 'RB', nflTeam: 'NYG', points: 5.4, projected: 8 },
  { name: 'Jaxson Dart', position: 'QB', nflTeam: 'NYG', points: 14.1, projected: 16 },
  { name: 'DK Metcalf', position: 'WR', nflTeam: 'PIT', points: 3.4, projected: 12 },
  { name: 'Jaylen Warren', position: 'RB', nflTeam: 'PIT', points: 5.1, projected: 10 },
  { name: 'Jonnu Smith', position: 'TE', nflTeam: 'PIT', points: 3.4, projected: 6 },
  { name: 'Kaleb Johnson', position: 'RB', nflTeam: 'PIT', points: 1.1, projected: 5 },
  { name: 'Chris Boswell', position: 'K', nflTeam: 'PIT', points: 7, projected: 8 },
  { name: 'Steelers D/ST', position: 'DEF', nflTeam: 'PIT', points: 5, projected: 6 },
  { name: 'Drake Maye', position: 'QB', nflTeam: 'NE', points: 12.3, projected: 18 },
  { name: 'TreVeyon Henderson', position: 'RB', nflTeam: 'NE', points: 9.8, projected: 12 },
  {
    name: 'Rhamondre Stevenson',
    position: 'RB',
    nflTeam: 'NE',
    points: 4.2,
    projected: 10,
    status: 'OUT',
    note: 'LEFT GAME (ANKLE)'
  },
  { name: 'Stefon Diggs', position: 'WR', nflTeam: 'NE', points: 7.4, projected: 10 },
  { name: 'Hunter Henry', position: 'TE', nflTeam: 'NE', points: 3.9, projected: 7 },
  { name: 'Patriots D/ST', position: 'DEF', nflTeam: 'NE', points: 6, projected: 6 },
  { name: 'Garrett Wilson', position: 'WR', nflTeam: 'NYJ', points: 4.1, projected: 12 },
  { name: 'Breece Hall', position: 'RB', nflTeam: 'NYJ', points: 6.9, projected: 13 },
  { name: 'Justin Fields', position: 'QB', nflTeam: 'NYJ', points: 7.2, projected: 16 },
  { name: 'Baker Mayfield', position: 'QB', nflTeam: 'TB', points: 11.8, projected: 18 },
  { name: 'Bucky Irving', position: 'RB', nflTeam: 'TB', points: 11.2, projected: 14 },
  { name: 'Mike Evans', position: 'WR', nflTeam: 'TB', points: 8.1, projected: 12 },
  { name: 'Emeka Egbuka', position: 'WR', nflTeam: 'TB', points: 11.6, projected: 12 },
  { name: 'Chris Godwin', position: 'WR', nflTeam: 'TB', points: 6.7, projected: 10 },
  { name: 'Rachaad White', position: 'RB', nflTeam: 'TB', points: 3.3, projected: 8 },
  { name: 'Jalen McMillan', position: 'WR', nflTeam: 'TB', points: 2.1, projected: 6 },
  { name: 'Chase McLaughlin', position: 'K', nflTeam: 'TB', points: 5, projected: 8 },
  { name: 'Buccaneers D/ST', position: 'DEF', nflTeam: 'TB', points: 7, projected: 6 },
  { name: 'Josh Jacobs', position: 'RB', nflTeam: 'GB', points: 12.6, projected: 15 },
  { name: 'Tucker Kraft', position: 'TE', nflTeam: 'GB', points: 5.4, projected: 9 },
  { name: 'Jordan Love', position: 'QB', nflTeam: 'GB', points: 13.9, projected: 17 },
  { name: 'Matthew Golden', position: 'WR', nflTeam: 'GB', points: 2.3, projected: 8 },
  { name: 'Jayden Reed', position: 'WR', nflTeam: 'GB', points: 2.8, projected: 9 },
  { name: 'Brandon McManus', position: 'K', nflTeam: 'GB', points: 7, projected: 8 },
  { name: 'Packers D/ST', position: 'DEF', nflTeam: 'GB', points: 9, projected: 7 },
  { name: 'Quinshon Judkins', position: 'RB', nflTeam: 'CLE', points: 6.4, projected: 12 },
  { name: 'Jerry Jeudy', position: 'WR', nflTeam: 'CLE', points: 1.6, projected: 8 },
  { name: 'David Njoku', position: 'TE', nflTeam: 'CLE', points: 1.9, projected: 7 },
  { name: 'Jerome Ford', position: 'RB', nflTeam: 'CLE', points: 2.2, projected: 6 },
  { name: 'Browns D/ST', position: 'DEF', nflTeam: 'CLE', points: 1, projected: 6 },
  { name: 'Joe Burrow', position: 'QB', nflTeam: 'CIN', points: 13.1, projected: 19 },
  { name: "Ja'Marr Chase", position: 'WR', nflTeam: 'CIN', points: 14.6, projected: 18 },
  { name: 'Tee Higgins', position: 'WR', nflTeam: 'CIN', points: 12.8, projected: 13 },
  { name: 'Chase Brown', position: 'RB', nflTeam: 'CIN', points: 10.1, projected: 14 },
  { name: 'Justin Jefferson', position: 'WR', nflTeam: 'MIN', points: 11.3, projected: 16 },
  { name: 'Jordan Addison', position: 'WR', nflTeam: 'MIN', points: 4.7, projected: 11 },
  { name: 'T.J. Hockenson', position: 'TE', nflTeam: 'MIN', points: 7.3, projected: 9 },
  { name: 'Jordan Mason', position: 'RB', nflTeam: 'MIN', points: 5.5, projected: 9 },
  { name: 'Vikings D/ST', position: 'DEF', nflTeam: 'MIN', points: 3, projected: 6 },
  { name: 'C.J. Stroud', position: 'QB', nflTeam: 'HOU', points: 8.7, projected: 17 },
  { name: 'Nico Collins', position: 'WR', nflTeam: 'HOU', points: 6.8, projected: 14 },
  { name: "Ka'imi Fairbairn", position: 'K', nflTeam: 'HOU', points: 3, projected: 8 },
  { name: 'Brian Thomas Jr.', position: 'WR', nflTeam: 'JAX', points: 10.5, projected: 14 },
  { name: 'Travis Hunter', position: 'WR', nflTeam: 'JAX', points: 5.3, projected: 10 },
  { name: 'Travis Etienne Jr.', position: 'RB', nflTeam: 'JAX', points: 4.8, projected: 10 },
  { name: 'Trevor Lawrence', position: 'QB', nflTeam: 'JAX', points: 9.4, projected: 16 },
  { name: 'Brenton Strange', position: 'TE', nflTeam: 'JAX', points: 3.1, projected: 6 },
  // LAR @ PHI — halftime.
  { name: 'Matthew Stafford', position: 'QB', nflTeam: 'LAR', points: 9.9, projected: 17 },
  { name: 'Puka Nacua', position: 'WR', nflTeam: 'LAR', points: 9.6, projected: 17 },
  { name: 'Davante Adams', position: 'WR', nflTeam: 'LAR', points: 11.4, projected: 13 },
  { name: 'Kyren Williams', position: 'RB', nflTeam: 'LAR', points: 9.1, projected: 15 },
  { name: 'Blake Corum', position: 'RB', nflTeam: 'LAR', points: 1.2, projected: 4 },
  { name: 'Jalen Hurts', position: 'QB', nflTeam: 'PHI', points: 12.4, projected: 20 },
  { name: 'Saquon Barkley', position: 'RB', nflTeam: 'PHI', points: 8.3, projected: 17 },
  { name: 'A.J. Brown', position: 'WR', nflTeam: 'PHI', points: 7.8, projected: 14 },
  { name: 'DeVonta Smith', position: 'WR', nflTeam: 'PHI', points: 3.9, projected: 12 },
  { name: 'Dallas Goedert', position: 'TE', nflTeam: 'PHI', points: 5.1, projected: 8 },
  { name: 'Tank Bigsby', position: 'RB', nflTeam: 'PHI', points: 1.9, projected: 5 },
  { name: 'Jake Elliott', position: 'K', nflTeam: 'PHI', points: 4, projected: 8 },
  { name: 'Eagles D/ST', position: 'DEF', nflTeam: 'PHI', points: 4, projected: 7 },
  // Late window, SNF, MNF — yet to play.
  { name: 'Bo Nix', position: 'QB', nflTeam: 'DEN', points: 0, projected: 17 },
  { name: 'Courtland Sutton', position: 'WR', nflTeam: 'DEN', points: 0, projected: 12 },
  { name: 'Troy Franklin', position: 'WR', nflTeam: 'DEN', points: 0, projected: 7 },
  { name: 'Evan Engram', position: 'TE', nflTeam: 'DEN', points: 0, projected: 7 },
  { name: 'Wil Lutz', position: 'K', nflTeam: 'DEN', points: 0, projected: 7 },
  { name: 'Justin Herbert', position: 'QB', nflTeam: 'LAC', points: 0, projected: 18 },
  { name: 'Ladd McConkey', position: 'WR', nflTeam: 'LAC', points: 0, projected: 13 },
  { name: 'Omarion Hampton', position: 'RB', nflTeam: 'LAC', points: 0, projected: 13 },
  { name: 'Cameron Dicker', position: 'K', nflTeam: 'LAC', points: 0, projected: 8 },
  { name: 'CeeDee Lamb', position: 'WR', nflTeam: 'DAL', points: 0, projected: 16 },
  { name: 'George Pickens', position: 'WR', nflTeam: 'DAL', points: 0, projected: 13 },
  { name: 'Jake Ferguson', position: 'TE', nflTeam: 'DAL', points: 0, projected: 9 },
  { name: 'Javonte Williams', position: 'RB', nflTeam: 'DAL', points: 0, projected: 12 },
  { name: 'Brandon Aubrey', position: 'K', nflTeam: 'DAL', points: 0, projected: 8 },
  { name: 'Christian McCaffrey', position: 'RB', nflTeam: 'SF', points: 0, projected: 18 },
  { name: 'George Kittle', position: 'TE', nflTeam: 'SF', points: 0, projected: 10 },
  { name: 'Jauan Jennings', position: 'WR', nflTeam: 'SF', points: 0, projected: 9 },
  { name: 'Jahmyr Gibbs', position: 'RB', nflTeam: 'DET', points: 0, projected: 17 },
  { name: 'Amon-Ra St. Brown', position: 'WR', nflTeam: 'DET', points: 0, projected: 15.5 },
  { name: 'Sam LaPorta', position: 'TE', nflTeam: 'DET', points: 0, projected: 10 },
  { name: 'Jake Bates', position: 'K', nflTeam: 'DET', points: 0, projected: 8 },
  { name: 'Jared Goff', position: 'QB', nflTeam: 'DET', points: 0, projected: 17 },
  { name: 'Trey McBride', position: 'TE', nflTeam: 'ARI', points: 0, projected: 10.5 },
  { name: 'Marvin Harrison Jr.', position: 'WR', nflTeam: 'ARI', points: 0, projected: 12 },
  { name: 'James Conner', position: 'RB', nflTeam: 'ARI', points: 0, projected: 12 },
  { name: 'Patrick Mahomes', position: 'QB', nflTeam: 'KC', points: 0, projected: 20 },
  { name: 'Rashee Rice', position: 'WR', nflTeam: 'KC', points: 0, projected: 14 },
  { name: 'Xavier Worthy', position: 'WR', nflTeam: 'KC', points: 0, projected: 11 },
  { name: 'Isiah Pacheco', position: 'RB', nflTeam: 'KC', points: 0, projected: 9 },
  { name: 'Hollywood Brown', position: 'WR', nflTeam: 'KC', points: 0, projected: 8 },
  { name: 'Lamar Jackson', position: 'QB', nflTeam: 'BAL', points: 0, projected: 20 },
  { name: 'Derrick Henry', position: 'RB', nflTeam: 'BAL', points: 0, projected: 16 },
  { name: 'Zay Flowers', position: 'WR', nflTeam: 'BAL', points: 0, projected: 12 },
  { name: 'Mark Andrews', position: 'TE', nflTeam: 'BAL', points: 0, projected: 9 },
  { name: 'Isaiah Likely', position: 'TE', nflTeam: 'BAL', points: 0, projected: 6 },
  { name: 'Caleb Williams', position: 'QB', nflTeam: 'CHI', points: 0, projected: 17 },
  { name: 'Rome Odunze', position: 'WR', nflTeam: 'CHI', points: 0, projected: 11 },
  { name: "D'Andre Swift", position: 'RB', nflTeam: 'CHI', points: 0, projected: 11 },
  { name: 'Colston Loveland', position: 'TE', nflTeam: 'CHI', points: 0, projected: 8 },
  { name: 'Jaxon Smith-Njigba', position: 'WR', nflTeam: 'SEA', points: 0, projected: 13 },
  { name: 'Kenneth Walker III', position: 'RB', nflTeam: 'SEA', points: 0, projected: 13 },
  { name: 'Cooper Kupp', position: 'WR', nflTeam: 'SEA', points: 0, projected: 7 },
  { name: 'Rashid Shaheed', position: 'WR', nflTeam: 'SEA', points: 0, projected: 8 },
  { name: 'Jason Myers', position: 'K', nflTeam: 'SEA', points: 0, projected: 8 }
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

const WORLD_LEAGUES: WorldLeague[] = [
  {
    id: 'cul-de-sac',
    short: 'cds',
    name: 'Cul-de-Sac League',
    provider: 'sleeper',
    season: REPLAY_SEASON,
    week: REPLAY_WEEK,
    size: 12,
    featured: true,
    my: roster(
      { id: 'cds-ice-box', name: 'Ice Box', owner: 'Maya', record: '2-0' },
      ['Jalen Hurts', 'Bijan Robinson', 'Jonathan Taylor', 'Puka Nacua', 'Amon-Ra St. Brown', 'Trey McBride', 'Garrett Wilson', 'Brandon Aubrey', 'Colts D/ST'],
      ['Chase Brown', 'Jordan Addison', 'Tucker Kraft', 'Rhamondre Stevenson', 'Baker Mayfield', 'Matthew Golden']
    ),
    opp: roster(
      { id: 'cds-hash-marks', name: 'Hash Marks', owner: 'Owen', record: '1-1' },
      ['Josh Allen', 'Saquon Barkley', 'Kyren Williams', "Ja'Marr Chase", 'Drake London', 'George Kittle', 'Jaxon Smith-Njigba', 'Jake Elliott', 'Packers D/ST'],
      ['Breece Hall', 'Mike Evans', 'Jaylen Warren', 'Evan Engram', 'Jordan Love', 'Rome Odunze']
    )
  },
  {
    id: 'break-room',
    short: 'brl',
    name: 'Break Room League',
    provider: 'espn',
    season: REPLAY_SEASON,
    week: REPLAY_WEEK,
    size: 10,
    featured: true,
    my: roster(
      { id: 'brl-two-minute-drill', name: 'Two-Minute Drill', owner: 'Dana', record: '1-1' },
      ['Lamar Jackson', 'James Conner', 'Josh Jacobs', 'Justin Jefferson', 'Nico Collins', 'Brock Bowers', 'Terry McLaurin', 'Chris Boswell', 'Buccaneers D/ST'],
      ["De'Von Achane", 'Jaylen Waddle', 'Jake Ferguson', 'Xavier Worthy', 'Travis Etienne Jr.', 'Bo Nix', 'Keon Coleman']
    ),
    opp: roster(
      { id: 'brl-monday-morning-qbs', name: 'Monday Morning QBs', owner: 'Theo', record: '2-0' },
      ['Jayden Daniels', 'Jahmyr Gibbs', 'James Cook', 'CeeDee Lamb', 'Malik Nabers', 'Sam LaPorta', 'DK Metcalf', 'Jake Bates', 'Eagles D/ST'],
      ['Chuba Hubbard', 'Travis Hunter', 'Zay Flowers', 'Kenneth Walker III', 'Tyler Warren', 'Justin Herbert', 'Jordan Mason']
    )
  },
  {
    id: 'fourth-and-long',
    short: 'fal',
    name: 'Fourth & Long',
    provider: 'sleeper',
    season: REPLAY_SEASON,
    week: REPLAY_WEEK,
    size: 10,
    featured: false,
    my: roster(
      { id: 'fal-last-call', name: 'Last Call', owner: 'Riley', record: '0-2' },
      ['C.J. Stroud', 'Christian McCaffrey', 'Breece Hall', 'Tee Higgins', 'DeVonta Smith', 'Mark Andrews', 'Chris Olave', "Ka'imi Fairbairn", 'Browns D/ST'],
      ['Khalil Shakir', 'Alvin Kamara', 'Jerry Jeudy', 'Isiah Pacheco', 'Dallas Goedert', 'Calvin Ridley']
    ),
    opp: roster(
      { id: 'fal-sunday-scaries', name: 'Sunday Scaries', owner: 'Pat', record: '2-0' },
      ['Patrick Mahomes', 'Derrick Henry', 'Bucky Irving', 'A.J. Brown', 'Brian Thomas Jr.', 'Dalton Kincaid', 'Ladd McConkey', 'Cameron Dicker', 'Bills D/ST'],
      ['Stefon Diggs', 'Tyrone Tracy Jr.', 'Kyle Pitts', 'Justin Fields', 'Hollywood Brown']
    )
  },
  {
    id: 'sunday-lights',
    short: 'sul',
    name: 'Sunday Lights',
    provider: 'sleeper',
    season: REPLAY_SEASON,
    week: REPLAY_WEEK,
    size: 12,
    featured: false,
    my: roster(
      { id: 'sul-night-shift', name: 'Night Shift', owner: 'Chris', record: '1-1' },
      ['Drake Maye', 'Ashton Jeanty', 'Omarion Hampton', 'Marvin Harrison Jr.', 'Tetairoa McMillan', 'Tyler Warren', 'Emeka Egbuka', 'Brandon McManus', 'Steelers D/ST'],
      ['Jordan Mason', "Wan'Dale Robinson", 'Travis Etienne Jr.', 'Jauan Jennings', 'Hunter Henry', 'Caleb Williams']
    ),
    opp: roster(
      { id: 'sul-gridiron-ghosts', name: 'Gridiron Ghosts', owner: 'Jordan', record: '1-1' },
      ['Joe Burrow', 'TreVeyon Henderson', 'Kenneth Walker III', 'Jakobi Meyers', 'Rashee Rice', 'Colston Loveland', 'Michael Pittman Jr.', 'Wil Lutz', 'Commanders D/ST'],
      ['Rachaad White', 'Jayden Reed', 'Cam Skattebo', 'Jared Goff', 'David Njoku']
    )
  },
  {
    id: 'basement-bowl',
    short: 'bbl',
    name: 'Basement Bowl',
    provider: 'espn',
    season: REPLAY_SEASON,
    week: REPLAY_WEEK,
    size: 12,
    featured: false,
    my: roster(
      { id: 'bbl-river-city', name: 'River City', owner: 'Sam', record: '1-1' },
      ['Baker Mayfield', 'Chuba Hubbard', 'Quinshon Judkins', 'Chris Godwin', 'Zay Flowers', 'Dallas Goedert', 'George Pickens', 'Tyler Bass', 'Patriots D/ST'],
      ['Rico Dowdle', 'Tyjae Spears', 'Justin Fields', 'Josh Downs', 'Evan Engram', 'Troy Franklin', 'Isaiah Likely']
    ),
    opp: roster(
      { id: 'bbl-first-down-club', name: 'First Down Club', owner: 'Nia', record: '2-0' },
      ['Matthew Stafford', 'Alvin Kamara', 'Javonte Williams', 'Davante Adams', 'Jaylen Waddle', 'T.J. Hockenson', 'Rome Odunze', 'Chase McLaughlin', 'Vikings D/ST'],
      ['Jerome Ford', 'Jonnu Smith', 'Tre Tucker', 'Kaleb Johnson', 'Bryce Young', 'Darnell Mooney', 'Ray Davis']
    )
  },
  {
    id: 'waiver-wire',
    short: 'www',
    name: 'Waiver Wire Warriors',
    provider: 'sleeper',
    season: REPLAY_SEASON,
    week: REPLAY_WEEK,
    size: 10,
    featured: false,
    my: roster(
      { id: 'www-priority-wire', name: 'Priority Wire', owner: 'Lee', record: '1-1' },
      ['Jaxson Dart', 'James Conner', 'Tony Pollard', 'Drake London', 'Jordan Addison', 'Kyle Pitts', 'Chase Brown', 'Matt Gay', 'Falcons D/ST'],
      ['Tyrone Tracy Jr.', 'Jalen McMillan', 'Isaiah Likely', 'Jaylen Wright', 'Troy Franklin', 'Blake Corum']
    ),
    opp: roster(
      { id: 'www-claim-jumpers', name: 'Claim Jumpers', owner: 'Mo', record: '1-1' },
      ['Trevor Lawrence', 'Tyler Allgeier', 'Rhamondre Stevenson', 'Jaxon Smith-Njigba', 'Tee Higgins', 'Brenton Strange', 'Emeka Egbuka', "Ka'imi Fairbairn", 'Buccaneers D/ST'],
      ["D'Andre Swift", 'Tank Bigsby', 'Cooper Kupp', 'Rashid Shaheed', 'Courtland Sutton']
    )
  }
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

/** Opening minute: both featured boards swing up and down before the generated slate takes over. */
const SCRIPT: ReplayBeat[] = [
  play('Bijan Robinson', 6.6, 'RUSH TD', 7),
  play("Ja'Marr Chase", -2, 'FUM'),
  play('Brock Bowers', 2.4, 'REC'),
  passTd('Jayden Daniels', 4.6, 'Terry McLaurin', 8.1),
  { kind: 'injury', player: slug('Drake London'), status: 'OUT', note: 'LEFT GAME (HAMSTRING)' },
  play('Jonathan Taylor', 1.9, 'REC'),
  play('Packers D/ST', 1, 'SACK'),
  play('Josh Jacobs', 1.4, 'RUSH'),
  play('Malik Nabers', 2.2, 'REC'),
  play('Colts D/ST', 2, 'INT'),
  play('Garrett Wilson', 2.6, 'REC'),
  play('Justin Jefferson', 2.1, 'REC'),
  play("Ja'Marr Chase", 2.9, 'REC'),
  play('Chris Boswell', 4, 'FG', 3),
  play('Bucky Irving', 7.1, 'RUSH TD', 7),
  play('Chris Olave', 1.8, 'REC'),
  play('Tetairoa McMillan', 2.1, 'REC'),
  play('Michael Pittman Jr.', 1.5, 'REC'),
  play('Quinshon Judkins', 1.2, 'RUSH'),
  passTd('Jaxson Dart', 4.4, "Wan'Dale Robinson", 7.3),
  play('Trevor Lawrence', -1, 'INT'),
  play('Nico Collins', 2.3, 'REC'),
  play('DK Metcalf', 1.9, 'REC'),
  play('Bijan Robinson', 1.6, 'REC')
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

const initialRemaining = (row: PoolPlayer): number => {
  if (row.status === 'OUT') return 0
  const game = GAME_BY_TEAM.get(row.nflTeam)
  if (!game) return 0
  const status = phaseAt(game, 0).status
  switch (status) {
    case 'final':
      return 0
    case 'pre':
      return row.projected
    case 'live':
    case 'half':
      return round1(row.projected * (1 - game.progress))
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
  if (league.provider === 'sleeper' && league.id === 'fourth-and-long') return [WAIVER_TX]
  return []
}

/** Demo tape reads as "earlier this afternoon" relative to when the demo started. */
const TAPE_ANCHOR = Date.now()

const WAIVER_TX: Transaction = {
  id: 'replay-waiver-ridley',
  type: 'add',
  players: ['Calvin Ridley'],
  timestamp: TAPE_ANCHOR - 31 * 60_000
}

type SeedPlay = {
  player: string
  minutesAgo: number
  period: string
} & ({ kind: 'score'; delta: number; note: string } | { kind: 'injury'; note: string })

const SEED_PLAYS: SeedPlay[] = [
  { kind: 'score', player: 'Jonathan Taylor', delta: 7.4, note: 'RUSH TD', minutesAgo: 2, period: '3RD' },
  { kind: 'score', player: 'Josh Jacobs', delta: 2.1, note: 'REC', minutesAgo: 3, period: '3RD' },
  { kind: 'score', player: "Ja'Marr Chase", delta: 8.6, note: 'REC TD', minutesAgo: 5, period: '3RD' },
  { kind: 'score', player: 'Brock Bowers', delta: 1.9, note: 'REC', minutesAgo: 6, period: '4TH' },
  { kind: 'score', player: 'Garrett Wilson', delta: 1.4, note: 'REC', minutesAgo: 7, period: '3RD' },
  { kind: 'score', player: 'Jayden Daniels', delta: 1.8, note: 'RUSH', minutesAgo: 8, period: '4TH' },
  { kind: 'score', player: 'Colts D/ST', delta: 1, note: 'SACK', minutesAgo: 9, period: '3RD' },
  { kind: 'injury', player: 'Rhamondre Stevenson', note: 'LEFT GAME (ANKLE)', minutesAgo: 11, period: '3RD' },
  { kind: 'score', player: 'Tee Higgins', delta: 8, note: 'REC TD', minutesAgo: 12, period: '3RD' },
  { kind: 'score', player: 'Bucky Irving', delta: 1.1, note: 'RUSH', minutesAgo: 13, period: '3RD' },
  { kind: 'score', player: 'Jakobi Meyers', delta: 1.7, note: 'REC', minutesAgo: 14, period: '3RD' },
  { kind: 'score', player: 'Drake Maye', delta: -1, note: 'INT', minutesAgo: 15, period: '3RD' },
  { kind: 'score', player: 'Chuba Hubbard', delta: 6.9, note: 'RUSH TD', minutesAgo: 16, period: '3RD' },
  { kind: 'score', player: 'Davante Adams', delta: 2.2, note: 'REC', minutesAgo: 18, period: '2ND' },
  { kind: 'score', player: 'Jaxson Dart', delta: 1.5, note: 'RUSH', minutesAgo: 19, period: '3RD' },
  { kind: 'score', player: 'Bijan Robinson', delta: 1.2, note: 'RUSH', minutesAgo: 20, period: '3RD' },
  { kind: 'score', player: 'Jalen Hurts', delta: 4.4, note: 'PASS TD', minutesAgo: 24, period: '2ND' },
  { kind: 'score', player: 'Terry McLaurin', delta: 1.6, note: 'REC', minutesAgo: 26, period: '3RD' }
]

const SEED_ROSTER_MOVES: Omit<TapeEvent, 'at'>[] = [
  {
    id: 'seed-ridley-waiver',
    kind: 'add',
    player: 'Ridley TEN',
    detail: 'WAIVER CLAIM',
    leagueKey: 'sleeper:fourth-and-long',
    leagueName: 'Fourth & Long',
    period: '1ST'
  },
  {
    id: 'seed-skattebo-trade',
    kind: 'trade',
    player: 'Skattebo NYG',
    detail: 'TRADE',
    leagueKey: 'sleeper:sunday-lights',
    leagueName: 'Sunday Lights',
    period: '1ST'
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
  SEED_ROSTER_MOVES.forEach((row, index) => {
    out.push({ ...row, at: anchor - (31 + index * 9) * 60_000 })
  })
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

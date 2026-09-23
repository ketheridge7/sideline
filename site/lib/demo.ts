/**
 * The pinned Replay Sunday every product still shows (Designer spec
 * MARKETING_REPLAY_SPEC §1). Mirrors the Electron fixture in
 * src/main/providers/replayWorld.ts — src/main/siteDemo.test.ts fails if they drift.
 */
export type DemoStarter = {
  pos: string;
  name: string;
  nfl: string;
  pts: string;
};

export type DemoLeague = {
  name: string;
  provider: "sleeper" | "espn";
  you: string;
  them: string;
};

export const DEMO_WEEK = 3;

export const HERO_HUD = {
  league: "Friday Night Gridiron",
  you: { team: "Ice Box", manager: "Maya", record: "2-0", score: "98.4", winPct: 62 },
  them: { team: "Hash Marks", manager: "Owen", record: "1-1", score: "91.2", winPct: 38 },
} as const;

export const YOU_STARTERS: DemoStarter[] = [
  { pos: "QB", name: "Fields", nfl: "PIT", pts: "18.4" },
  { pos: "RB", name: "Gibbs", nfl: "DET", pts: "16.2" },
  { pos: "RB", name: "Montgomery", nfl: "DET", pts: "9.1" },
  { pos: "WR", name: "St. Brown", nfl: "DET", pts: "14.6" },
  { pos: "WR", name: "Hill", nfl: "MIA", pts: "8.3" },
  { pos: "TE", name: "Kelce", nfl: "KC", pts: "7.4" },
  { pos: "FLEX", name: "Collins", nfl: "HOU", pts: "11.8" },
  { pos: "K", name: "Aubrey", nfl: "DAL", pts: "6.0" },
  { pos: "DEF", name: "Steelers", nfl: "PIT", pts: "6.6" },
];

export const THEM_STARTERS: DemoStarter[] = [
  { pos: "QB", name: "Allen", nfl: "BUF", pts: "21.1" },
  { pos: "RB", name: "Barkley", nfl: "PHI", pts: "15.4" },
  { pos: "RB", name: "Conner", nfl: "ARI", pts: "5.8" },
  { pos: "WR", name: "Brown", nfl: "PHI", pts: "14.2" },
  { pos: "WR", name: "London", nfl: "ATL", pts: "6.9" },
  { pos: "TE", name: "Kittle", nfl: "SF", pts: "4.2" },
  { pos: "FLEX", name: "Waddle", nfl: "MIA", pts: "8.1" },
  { pos: "K", name: "Bass", nfl: "BUF", pts: "5.0" },
  { pos: "DEF", name: "Ravens", nfl: "BAL", pts: "10.5" },
];

export const COMPANION_LEAGUES: DemoLeague[] = [
  { name: "Friday Night Gridiron", provider: "sleeper", you: "98.4", them: "91.2" },
  { name: "Fourth & Drunken", provider: "sleeper", you: "84.1", them: "102.6" },
  { name: "Sunday Lights", provider: "sleeper", you: "71.0", them: "68.4" },
  { name: "Waiver Wire Warriors", provider: "sleeper", you: "55.2", them: "49.8" },
  { name: "Gridiron Gurus", provider: "espn", you: "112.3", them: "88.0" },
  { name: "Basement Bowl", provider: "espn", you: "40.1", them: "61.7" },
];

export const SHORTCUTS = [
  { action: "Toggle HUD", keys: "Ctrl + Shift + O" },
  { action: "Cycle HUD display", keys: "Ctrl + Shift + M" },
  { action: "Edit HUD on the overlay", keys: "Ctrl + Shift + E" },
  { action: "Next league", keys: "]" },
  { action: "Previous league", keys: "[" },
] as const;

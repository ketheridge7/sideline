export type HeroHudRow =
  | { kind: "team"; abbr: string; score: string; player: string; pts: string }
  | { kind: "tick"; delta: string; player: string; pts: string };

export type DemoStarter = {
  pos: string;
  name: string;
  pts: string;
  tick?: string;
};

export type DemoWatchRow = {
  player: string;
  nfl: string;
  pts: string;
  delta: string;
};

export type DemoLeague = {
  abbr: string;
  name: string;
  score: string;
  clock: string;
  qtr: string;
};

export type OverlayPresetId = "1" | "2" | "3" | "4" | "5";

export const OVERLAY_PRESETS: Record<
  OverlayPresetId,
  { id: OverlayPresetId; placement: string; hint: string }
> = {
  "1": { id: "1", placement: "Far sides", hint: "You left, them right." },
  "2": { id: "2", placement: "Upper corners", hint: "You left, them right." },
  "3": { id: "3", placement: "Lower corners", hint: "You left, them right." },
  "4": { id: "4", placement: "Same-side stack", hint: "Both teams stacked on one sideline." },
  "5": { id: "5", placement: "Side bands", hint: "You left-upper, them right-lower." },
};

export const HERO_HUD: HeroHudRow[] = [
  { kind: "team", abbr: "KC", score: "24", player: "Mahomes", pts: "18.7" },
  { kind: "team", abbr: "BUF", score: "21", player: "Allen", pts: "17.2" },
  { kind: "tick", delta: "+2.4", player: "Diggs", pts: "9.6" },
  { kind: "team", abbr: "DAL", score: "17", player: "Prescott", pts: "14.1" },
  { kind: "team", abbr: "PHI", score: "14", player: "Hurts", pts: "12.3" },
  { kind: "tick", delta: "-0.8", player: "Brown", pts: "4.3" },
];

export const HERO_WATCHLIST: DemoWatchRow[] = [
  { player: "N. Collins", nfl: "HOU", pts: "14.2", delta: "+2.1" },
  { player: "J. Conner", nfl: "ARI", pts: "11.8", delta: "+1.6" },
  { player: "T. Lockett", nfl: "SEA", pts: "9.7", delta: "+0.9" },
  { player: "D. London", nfl: "ATL", pts: "7.3", delta: "-0.4" },
  { player: "Z. Charbonnet", nfl: "SEA", pts: "6.1", delta: "-1.2" },
];

export const COMPANION_LEAGUES: DemoLeague[] = [
  { abbr: "KC", name: "Chiefs", score: "14", clock: "14:21", qtr: "2ND" },
  { abbr: "BUF", name: "Bills", score: "10", clock: "7:05", qtr: "2ND" },
  { abbr: "DAL", name: "Cowboys", score: "7", clock: "3:18", qtr: "2ND" },
];

export const COMPANION_WATCH = [
  { player: "J. Allen", nfl: "BUF", pos: "QB", line: "22/31  245 YDS  2 TD", up: true },
  { player: "T. Kelce", nfl: "KC", pos: "TE", line: "6 REC  78 YDS", up: true },
  { player: "B. Hall", nfl: "NYJ", pos: "RB", line: "14 CAR  68 YDS  1 TD", up: false },
] as const;

export const YOU_STARTERS: DemoStarter[] = [
  { pos: "QB", name: "Hartman", pts: "18.7", tick: "+3.1" },
  { pos: "RB", name: "Collins", pts: "14.2", tick: "+2.1" },
  { pos: "RB", name: "Conner", pts: "11.8" },
  { pos: "WR", name: "Diggs", pts: "9.6", tick: "+2.4" },
  { pos: "WR", name: "Lockett", pts: "9.7" },
  { pos: "TE", name: "Kelce", pts: "8.4" },
  { pos: "FLEX", name: "Hall", pts: "7.1" },
  { pos: "K", name: "Tucker", pts: "4.0" },
  { pos: "DEF", name: "Bills", pts: "6.0" },
];

export const THEM_STARTERS: DemoStarter[] = [
  { pos: "QB", name: "Allen", pts: "17.2" },
  { pos: "RB", name: "Wilson", pts: "6.4", tick: "-1.2" },
  { pos: "RB", name: "Charbonnet", pts: "6.1", tick: "-1.2" },
  { pos: "WR", name: "London", pts: "7.3", tick: "-0.4" },
  { pos: "WR", name: "Brown", pts: "4.3", tick: "-0.8" },
  { pos: "TE", name: "Kittle", pts: "5.8" },
  { pos: "FLEX", name: "Aiyuk", pts: "3.2" },
  { pos: "K", name: "Bass", pts: "3.0" },
  { pos: "DEF", name: "49ers", pts: "2.0" },
];

export const TAPE_STILLS = [
  { name: "Collins", tick: "+2.1" },
  { name: "Hartman", tick: "+3.1" },
  { name: "Diggs", tick: "+2.4" },
  { name: "Allen", tick: "+1.4" },
] as const;

export const SHORTCUTS = [
  { action: "Toggle HUD", keys: "Ctrl + Shift + O" },
  { action: "Cycle HUD display", keys: "Ctrl + Shift + M" },
  { action: "Edit HUD on the overlay", keys: "Ctrl + Shift + E" },
  { action: "Next league", keys: "]" },
  { action: "Previous league", keys: "[" },
] as const;

import { HERO_HUD } from "@/lib/demo";

/**
 * Product stills (Designer spec MARKETING_REPLAY_SPEC §2). Every screen is a real
 * capture of the pinned Replay Sunday (`npm run replay:capture`): fake leagues,
 * fake managers, real NFL player names. The two living-room shots composite those
 * captures onto generated, people-free rooms (scripts/marketing/compose.py).
 * Capture checklist: docs/marketing/stills.md.
 */
export type ProductStill = {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
};

const { you, them } = HERO_HUD;

export const PRODUCT_STILLS = {
  hero: {
    src: "/images/hero-living-room.jpg",
    alt: `Sunday living room: flat frost HUD on the TV, thin bottom ticker, and the companion Scoreboard on a laptop — ${you.team} ${you.score}, ${them.team} ${them.score}.`,
    width: 1600,
    height: 900,
  },
  companion: {
    src: "/images/companion-board.jpg",
    alt: "Sideline Scoreboard in Replay: Matchup Scoring, Ice Box vs Hash Marks with both benches closed, scoring tape, and the league watchlist.",
    width: 1440,
    height: 900,
  },
  leagues: {
    src: "/images/leagues-board.jpg",
    alt: "Sideline Leagues in Replay: six matchups under League Scoring, neutral scores, outlined top-scorer chips, and the all-leagues tape. Sleeper cards show team names only.",
    width: 1440,
    height: 900,
  },
  overlay: {
    src: "/images/frost-hud.jpg",
    alt: "Frost HUD, Overlay Studio preset 3 (lower corners), on a straight-on living-room TV — Ice Box and Hash Marks with the thin bottom ticker.",
    width: 1600,
    height: 900,
  },
  studio: {
    src: "/images/overlay-studio.jpg",
    alt: "Scoreboard with Overlay Studio open beside it: five placements and a live HUD preview over the game plate. No separate Edit-layout control.",
    width: 1440,
    height: 900,
  },
  connect: {
    src: "/images/connect-hub.jpg",
    alt: "Connect hub in Replay: ESPN, Sleeper, and TV cards, with Updates open underneath. No Replay panel.",
    width: 1440,
    height: 700,
  },
} as const satisfies Record<string, ProductStill>;

export type ProductStillId = keyof typeof PRODUCT_STILLS;

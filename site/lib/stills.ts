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
const REPLAY_CAPTION = "Replay · fake leagues";
const STAGED_CAPTION = "Real HUD and board captures · staged room · fake leagues";

export const PRODUCT_STILLS = {
  hero: {
    src: "/images/hero-living-room.jpg",
    alt: `Sunday living room: frost HUD on the TV over the game and the companion Scoreboard on a laptop — ${you.team} ${you.score}, ${them.team} ${them.score}.`,
    width: 1600,
    height: 900,
    caption: STAGED_CAPTION,
  },
  companion: {
    src: "/images/companion-board.jpg",
    alt: "Sideline Scoreboard in Replay: Ice Box vs Hash Marks, starters, scoring tape, and league watchlist.",
    width: 1440,
    height: 900,
    caption: REPLAY_CAPTION,
  },
  leagues: {
    src: "/images/leagues-board.jpg",
    alt: "Sideline Leagues in Replay: six Sleeper and ESPN matchups with live scores, lead bars, and top scorers beside the all-leagues scoring tape.",
    width: 1440,
    height: 900,
    caption: REPLAY_CAPTION,
  },
  overlay: {
    src: "/images/frost-hud.jpg",
    alt: "Frost HUD over a Sunday living-room TV — Ice Box and Hash Marks on the sidelines.",
    width: 1600,
    height: 900,
    caption: "Real HUD capture · staged room · fake leagues",
  },
  studio: {
    src: "/images/overlay-studio.jpg",
    alt: "Overlay Studio with five placements and a live HUD preview over game footage.",
    width: 1440,
    height: 900,
    caption: REPLAY_CAPTION,
  },
  connect: {
    src: "/images/connect-hub.jpg",
    alt: "Connect hub: ESPN, Sleeper, and TV peer cards with Replay armed.",
    width: 984,
    height: 530,
    caption: REPLAY_CAPTION,
  },
} as const satisfies Record<string, ProductStill>;

export type ProductStillId = keyof typeof PRODUCT_STILLS;

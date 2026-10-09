import { HERO_HUD } from "@/lib/demo";

/**
 * Product stills. Companion, leagues, and studio are window captures of
 * the pinned Replay Sunday with Replay chrome hidden (`SIDELINE_CAPTURE=1`).
 * Hero and frost-hud are the real HUD composited on the head-on broadcast plate.
 * Mobile files are crops of those stills for a 390px column.
 */
export type ProductStill = {
  src: string;
  mobileSrc: string;
  alt: string;
  width: number;
  height: number;
  mobileWidth: number;
  mobileHeight: number;
  caption: string;
};

const { you, them } = HERO_HUD;

export const PRODUCT_STILLS = {
  hero: {
    src: "/images/hero-broadcast.jpg",
    mobileSrc: "/images/hero-broadcast-mobile.jpg",
    alt: `Sideline HUD on a Sunday broadcast: ${you.team} ${you.score}, ${them.team} ${them.score}, with both starting lineups on the lower corners.`,
    width: 1600,
    height: 900,
    mobileWidth: 1600,
    mobileHeight: 480,
    caption: "The HUD on the broadcast. Sample Week 3, Ice Box 98.4–Hash Marks 91.2.",
  },
  companion: {
    src: "/images/companion-board.jpg",
    mobileSrc: "/images/companion-board-mobile.jpg",
    alt: "Sideline Scoreboard: Ice Box 98.4 versus Hash Marks 91.2, both starting lineups, the scoring tape, and the league watchlist.",
    width: 1440,
    height: 900,
    mobileWidth: 964,
    mobileHeight: 812,
    caption: "Scoreboard. One matchup, both lineups, and the watchlist.",
  },
  leagues: {
    src: "/images/leagues-board.jpg",
    mobileSrc: "/images/leagues-board-mobile.jpg",
    alt: "Sideline Leagues: six matchups under League Scoring, with top scorers and the all-leagues tape.",
    width: 1440,
    height: 900,
    mobileWidth: 1200,
    mobileHeight: 564,
    caption: "Every league on one grid.",
  },
  overlay: {
    src: "/images/frost-hud.jpg",
    mobileSrc: "/images/frost-hud-mobile.jpg",
    alt: "Frost HUD over a Sunday broadcast: Ice Box and Hash Marks on the far sidelines, with a scoring ticker along the bottom.",
    width: 1600,
    height: 900,
    mobileWidth: 780,
    mobileHeight: 900,
    caption: "Far-sides preset. Scores sit off the play.",
  },
  studio: {
    src: "/images/overlay-studio.jpg",
    mobileSrc: "/images/overlay-studio-mobile.jpg",
    alt: "Scoreboard with Overlay Studio open: five HUD placements and a live preview over the game.",
    width: 1440,
    height: 900,
    mobileWidth: 304,
    mobileHeight: 860,
    caption: "Overlay Studio. Pick a placement, then nudge it.",
  },
} as const satisfies Record<string, ProductStill>;

export type ProductStillId = keyof typeof PRODUCT_STILLS;

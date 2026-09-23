/**
 * Product stills. Every screen is a real capture from Demo Sunday
 * (`npm run replay:capture`): fake leagues, fake managers, real NFL player names.
 * The two living-room shots composite those captures onto generated, people-free
 * rooms (scripts/marketing/compose.py). Capture checklist: docs/marketing/stills.md.
 */
export type ProductStill = {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
};

const DEMO_CAPTION = "Demo Sunday data · fake leagues";
const STAGED_CAPTION = "Real HUD and board captures · staged room · fake leagues";

export const PRODUCT_STILLS = {
  hero: {
    src: "/images/hero-living-room.jpg",
    alt: "Game-day living room: the Sideline frost HUD on the TV over the broadcast, and the companion Scoreboard on a laptop on the coffee table — Ice Box 86.6, Hash Marks 85.1.",
    width: 1600,
    height: 900,
    caption: STAGED_CAPTION,
  },
  companion: {
    src: "/images/companion-board.jpg",
    alt: "Sideline Scoreboard: Ice Box 80.2 vs Hash Marks 82.2 with Est. win% 55–45, both starting lineups with points, a My leagues rail for six leagues, a scoring tape, and the NFL ticker.",
    width: 1600,
    height: 900,
    caption: DEMO_CAPTION,
  },
  leagues: {
    src: "/images/leagues-board.jpg",
    alt: "Sideline Leagues view: six Sleeper and ESPN matchups with live scores, lead bars, and top scorers, next to an all-leagues scoring tape.",
    width: 1600,
    height: 900,
    caption: DEMO_CAPTION,
  },
  overlay: {
    src: "/images/frost-hud.jpg",
    alt: "Frost HUD on a living-room TV during a game: Ice Box 86.6 and starters on the left rail, Hash Marks 85.1 on the right, empty center, lime bias light behind the set.",
    width: 1600,
    height: 900,
    caption: "Real HUD capture · staged room · fake leagues",
  },
  studio: {
    src: "/images/overlay-studio.jpg",
    alt: "Overlay Studio open beside the Scoreboard: five placement presets, a live HUD preview, and position and size sliders.",
    width: 1600,
    height: 900,
    caption: DEMO_CAPTION,
  },
  connect: {
    src: "/images/connect-hub.jpg",
    alt: "Connect hub: ESPN connected with two leagues, Sleeper connected with four, and a TV card ready to pair.",
    width: 980,
    height: 550,
    caption: DEMO_CAPTION,
  },
} as const satisfies Record<string, ProductStill>;

export type ProductStillId = keyof typeof PRODUCT_STILLS;

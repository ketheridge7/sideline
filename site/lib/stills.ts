export const STILL_SIZE = { width: 1280, height: 720 } as const;

export const PRODUCT_STILLS = {
  hero: {
    src: "/images/hero-living-room.jpg",
    alt: "Cinematic living room: frost HUD on the TV and Sideline Sunday Tape on a laptop.",
  },
  companion: {
    src: "/images/companion-board.jpg",
    alt: "Sideline companion board with scoring tape, you-vs-them matchup, watchlist, and chance-to-win bar.",
  },
  overlay: {
    src: "/images/frost-hud.jpg",
    alt: "Frost HUD rail on the sideline with empty center so live video stays the picture.",
  },
  studio: {
    src: "/images/overlay-studio.jpg",
    alt: "Overlay Studio with layout presets, live preview, and HUD rail controls.",
  },
} as const;

export type ProductStillId = keyof typeof PRODUCT_STILLS;

# Marketing stills

Source of truth: Designer's Sunday-real spec (`MARKETING_REPLAY_SPEC`, 2026-09-23). Every
product screen on the site is a real capture of the **pinned Replay frame**. Never capture
live leagues for the public site, and never put a real person in a still.

Pinned frame (tick 0, `src/main/providers/replayWorld.ts`, mirrored in `site/lib/demo.ts`;
`src/main/siteDemo.test.ts` fails if they drift):

- Friday Night Gridiron (Sleeper), Week 3: Maya's **Ice Box 98.4** vs Owen's **Hash Marks 91.2**,
  Est. win% **62 / 38**.
- MY LEAGUES: Fourth & Drunken 84.1–102.6 · Sunday Lights 71.0–68.4 · Waiver Wire Warriors
  55.2–49.8 · Gridiron Gurus (ESPN) 112.3–88.0 · Basement Bowl (ESPN) 40.1–61.7.
- Tape (THIS MATCHUP): Gibbs TD · Hill FUM · Allen PASS TD · St. Brown REC · Dowdle INJ ·
  Ravens INT · Fields RUSH.
- Ticker leads with DET–KC 3RD, DAL–NYG FINAL, BUF–MIA 2ND, PHI–ATL 1ST, PIT–LAC HALFTIME.

| Slot | File in `site/public/images/` | What it shows | How it is made |
| --- | --- | --- | --- |
| A hero | `hero-living-room.jpg` | HUD on the TV + Scoreboard on a laptop | `hud-shot.mjs` + board capture + `compose.py hero` |
| B | `companion-board.jpg` | Scoreboard, benches closed (both lineups visible) | Window capture, 1440×900 |
| — | `leagues-board.jpg` | Leagues grid, six boards, all-leagues tape | Window capture, 1440×900 |
| C | `frost-hud.jpg` | Frost HUD (preset 1, far sides) on a living-room TV | `hud-shot.mjs` + `compose.py frost` |
| D | `overlay-studio.jpg` | Scoreboard with Overlay Studio, preview over the game plate | Window capture, 1440×900 |
| E | `connect-hub.jpg` | Replay armed block + ESPN / Sleeper / TV cards | Window capture, cropped to the hub |

Alt text and captions live in `site/lib/stills.ts` (spec §2 wording).

The two living-room backdrops (`scripts/marketing/backdrops/`) are generated rooms with no
people in them. Only the screens are replaced, and only with real captures. The Studio
preview plate (`src/renderer/assets/studio-plate.jpg`) is cropped from the same TV backdrop and
ships in the app, so still D shows what the product actually renders.

## Capture checklist

1. `npm install`, then `npm run replay:capture`. Replay is armed and **held** on the pinned frame
   (`SIDELINE_REPLAY_HOLD=1`), so every still shows the same Sunday. The small REPLAY chip and
   caption stay visible on purpose (spec §4).
2. Size the companion window to **1440×900** (Windows: PowerToys FancyZones or a window sizer;
   Linux: `xdotool search --name Sideline windowsize 1440 900`).
3. **B** — Scoreboard with **both benches closed**, so both lineups show (Designer sign-off,
   PR #51). Capture → `companion-board.jpg`. The same frame is the hero laptop `board.png`.
   Optional bench proof (docs only, not the site): open the Hash Marks bench and capture →
   `docs/marketing/bench-proof.jpg`.
4. **Leagues** — click Leagues and capture → `leagues-board.jpg`.
5. **E** — click Connect and capture, then crop from the Replay block through the provider
   cards → `connect-hub.jpg`.
6. **D** — Scoreboard, turn on HUD, press **Edit layout**. Move the overlay to another display
   (or capture only the companion window) so the rails don't cover it → `overlay-studio.jpg`.
7. **HUD render** — with the app still running, in a second terminal:

   ```bash
   node scripts/marketing/hud-shot.mjs hud.png http://127.0.0.1:7333/overlay
   ```

   Use the desktop surface (regular density); the TV surface truncates ST. BROWN. Use this one
   render for both C and the hero so the TV digits match (98.4 / 91.2 / +7.2).
8. **Composite C and A** (Python 3 with Pillow and NumPy):

   ```bash
   python3 scripts/marketing/compose.py frost --hud hud.png
   python3 scripts/marketing/compose.py hero --hud hud.png --board board.png
   ```

9. Update alt text in `site/lib/stills.ts` if anything changed, then
   `cd site && npm run lint && npm run build`.

## After the pinned frame (`npm run replay`, 3s per tick)

- 0:00–1:00 — scripted opening: Gibbs and Allen tick first, then TDs by A.J. Brown and
  St. Brown swing the featured board.
- 1:30 — halftime ends in PIT–LAC.
- ~15:00 — DET–KC and ARI–SEA go final; the 4:05 and 4:25 games kick off from ~16:00.
- Scores stay bounded; relaunch to replay from the pinned frame.

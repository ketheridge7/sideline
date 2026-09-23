# Marketing stills

Every product screen on the site is a real capture from **Demo Sunday**, the scripted
Week 3 slate (six fake Sleeper and ESPN leagues, real NFL player names). Never capture
live leagues for the public site, and never put a real person in a still.

| File in `site/public/images/` | What it shows | How it is made |
| --- | --- | --- |
| `companion-board.jpg` | Scoreboard, Cul-de-Sac League, Ice Box vs Hash Marks | Window capture, 1600×900 |
| `leagues-board.jpg` | Leagues grid, six boards, all-leagues tape | Window capture, 1600×900 |
| `overlay-studio.jpg` | Scoreboard with Overlay Studio open | Window capture, 1600×900 |
| `connect-hub.jpg` | Connect hub cards (ESPN, Sleeper, TV) | Window capture, cropped to the hub, 980×550 |
| `frost-hud.jpg` | Frost HUD on a living-room TV | `hud-shot.mjs` + `compose.py frost` |
| `hero-living-room.jpg` | HUD on the TV + Scoreboard on a laptop | `hud-shot.mjs` + board capture + `compose.py hero` |

Alt text and captions live in `site/lib/stills.ts`. Update the alt text whenever a
still's scores or teams change.

The two living-room backdrops (`scripts/marketing/backdrops/`) are generated rooms with
no people in them. Only the screens are replaced, and only with real captures.

## Capture checklist

1. `npm install`, then `npm run replay:capture`. This is Demo Sunday with the Demo chip and
   the Connect demo banner hidden, so the stills carry no demo chrome.
2. Size the companion window to **1600×900** (Windows: PowerToys FancyZones or a window
   sizer; Linux: `xdotool search --name Sideline windowsize 1600 900`).
3. **Scoreboard** — about 30–45 seconds after launch the opening script has played out:
   Ice Box and Hash Marks are within a few points, Est. win% sits near 55–45, Drake London
   shows OUT, and the tape is full. Capture the window → `companion-board.jpg`.
4. **Leagues** — click Leagues and capture → `leagues-board.jpg`.
5. **Connect** — click Connect and capture, then crop to the hub cards (Getting started
   through Report a bug) → `connect-hub.jpg`.
6. **Studio** — back on Scoreboard, turn on HUD, press **Edit layout**. Move the overlay to
   another display, or capture only the companion window, so the rails do not cover it →
   `overlay-studio.jpg`.
7. **HUD renders** — with the app still running, in a second terminal:

   ```bash
   node scripts/marketing/hud-shot.mjs hud-tv.png          # TV surface (Google TV look)
   ```

   Capture a fresh Scoreboard window **in the same moment** as `board.png`, so the laptop
   and TV in the hero agree on the score.
8. **Composite** (Python 3 with Pillow and NumPy):

   ```bash
   python3 scripts/marketing/compose.py frost --hud hud-tv.png
   python3 scripts/marketing/compose.py hero --hud hud-tv.png --board board.png
   ```

9. Update alt text in `site/lib/stills.ts`, then `cd site && npm run lint && npm run build`.

## Demo Sunday timeline (3s per tick)

- 0:00 — opening scores (Ice Box 67.1, Hash Marks 83.2). Thursday night is final, the
  1:00 window is in the 3rd/4th quarter, and LAR @ PHI is at halftime.
- 0:00–1:15 — scripted opening: Bijan Robinson rushing TD, Ja'Marr Chase fumble, Drake
  London hurt, Daniels to McLaurin, and more across both featured boards.
- 1:30 — halftime ends in Philadelphia.
- ~15:00 — the 1:00 window goes final; 4:05/4:25 games kick off right after.
- Scores stay bounded (team totals finish around 90–140). Relaunch the demo to replay.

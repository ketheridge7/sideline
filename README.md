# Sideline

Second-screen fantasy companion for NFL Sundays. One Electron app, two windows: a glanceable companion board and a compact always-on-top overlay. Same live data, no backend. Visual language is **Sunday Tape** — ice / lime / alert on near-black, not gold Booth.

**Sleeper** uses the official read-only HTTP API. **ESPN** access is unofficial, uses your own login, and is for personal companion use only.

## Run

```bash
npm install
npm start
```

Preseason / no live scoring yet? Replay a scripted Sunday so Board, Boards, and the overlay look like the watch mockups (mixed leagues, +/- tape, INJ/waiver, ON AIR ticker):

```bash
npm run replay
```

Replay is fixture-only. It does not call a sports-data API and does not capture ESPN passwords.

## Connect

### Sleeper

Type your Sleeper **username** (not email, not password). Sideline calls `GET /v1/user/{username}`, then lists your NFL leagues for the current `league_season` from `GET /v1/state/nfl`.

### ESPN

Click **Sign in with ESPN**. Sideline clears the previous in-app ESPN session, then an in-app window opens ESPN's own login (2FA/OTP included). Sideline never sees or stores your password. After you sign in, it reads `espn_s2` and `SWID` from the `persist:espn` session partition on this machine and attaches them to later GETs.

Those cookies expire (often after a few weeks). When they do, sign in again the same way — leftover cookie names from a dead session cannot skip the login window.

League discovery is best-effort and unofficial. If your leagues don't appear, **paste the numeric league ID** from the ESPN fantasy URL (`.../football/league?leagueId=XXXX`).

Public leagues sometimes work with no cookies. Private leagues need `espn_s2` + `SWID`.

## Overlay

- Companion: **HUD** toggle, or global hotkey `Ctrl+Shift+O` (`Cmd+Shift+O` on Mac). **Studio** (or `E`) picks one of five dual-rail placements, then nudges position/size.
- Default **Preset 1** is far-side frost rails (**you left, them right**), enlarged centered names and centered scores above each roster. Starter rows are a locked `POS | NAME | PTS` grid. Score ticks flash lime `+N` or alert red `-N` on the pts cell, then settle. **Save over Preset N** keeps the current layout on that slot.
- Watch mode is click-through (`setIgnoreMouseEvents(true, { forward: true })`). Edit restores the mouse.
- OBS Browser Source: `http://127.0.0.1:7333/overlay` (port increments if 7333 is taken)
- Center ~60% of the canvas stays empty so live video is the product. See [`docs/design/hud.md`](docs/design/hud.md) for occupied zones.

### TV / LAN

Connect → **Allow devices on this Wi-Fi to load the overlay**. Sideline then binds the overlay server on all interfaces, shows a **6-digit pairing code**, and requires a session token (`?k=`). On the Google TV app (`tv/`), type that code — you do not enter the IP or hex token. Paste the phone URL into a browser to confirm. Loopback OBS use is unchanged while this toggle is off.

Windows is the first-class overlay target. macOS uses `type: 'panel'`, `setAlwaysOnTop(..., 'screen-saver')`, `setVisibleOnAllWorkspaces({ visibleOnFullScreen: true })`, and accessory activation policy so it can sit above fullscreen video. That last setting **hides the Dock icon**; use the tray icon to show the companion.

Google TV overlay app: see [`tv/README.md`](tv/README.md).

## Polling

~30s idle, ~3s **start-to-start** when an NFL game is actually `in` on ESPN's public scoreboard (calendar window is only the fallback if that fetch fails; ESPN `lm-api-reads` sends `Cache-Control: max-age=3`). ESPN fantasy uses the unofficial `lm-api-reads` JSON views (not HTML scrape); live ticks request `mMatchupScore` / `mLiveScoring` for the current week, with `mTeam` cached from discovery or a one-time parallel fetch. Selected + pinned scoring GETs start before the public NFL scoreboard download (~251KB); that download is cached 10s so a 3s scoring tick does not re-download it, and it does not block the LEAGUES list. Other boards reuse the last snapshot for ~30s, and those snapshots persist to disk for 12 hours so a restart can paint the LEAGUES grid immediately. Sleeper matchups refresh every tick on the hot path; rosters/users and league lists cache ~5 min in memory, and persist to disk for 12 hours so a restart can overlay live `/matchups` without waiting on those GETs. Player map is daily (30s timeout on first download). Stay well under Sleeper's 1000 req/min guidance.

## Out of scope

Yahoo, pick'em, DFS, betting, odds, moneylines, sportsbook UI, chat, drafts, and any write actions (lineups, waivers).

## Packaging

Windows is the first packaging target: a private one-click NSIS installer on this PC. macOS can wait.

On a **Windows** machine:

```bash
npm install
npm run build:win
```

The setup exe lands at `dist/sideline-1.0.0-setup.exe`. It is a per-user install (no Administrator prompt), creates a **desktop shortcut** and a Start menu entry named Sideline, and does not need to be code-signed to run.

Because the build is unsigned, Windows SmartScreen will likely show **Windows protected your PC**. Choose **More info** → **Run anyway**. Expected for a personal unsigned `.exe`. Authenticode signing is an optional follow-up so that warning goes away; it is not required for private use and is not part of CI.

Icon theme A (charcoal `#12141A`, left ice-green stripe `#A6E6A0`, white S) is in `build/`: `icon.png` master, `icon.ico` for Windows, `icon.icns` for later Mac builds.

`npm run build:mac` is wired and uses `build/icon.icns`, with notarization off. Run that on a Mac when you want a `.dmg`; it is not the current goal.

# Sideline

Second-screen fantasy companion for NFL Sundays. One Electron app, two windows: a glanceable companion board and a compact always-on-top overlay. Same live data, no backend. Visual language is **Sunday Tape** — ice / lime / alert on near-black, not gold Booth.

**Sleeper** uses the official read-only HTTP API. **ESPN** access is unofficial, uses your own login, and is for personal companion use only.

## Marketing site

The public marketing site is a separate Next.js app in [`site/`](site/). It is not part of the Electron build.

```bash
cd site
npm install
npm run dev
```

## Run

```bash
npm install
npm start
```

### Replay

Preseason, no live games, or need screenshots? **Connect → Arm Replay** restarts Sideline into a scripted Week 3 Sunday with six fake friend-group leagues. The pinned frame is Friday Night Gridiron: Maya's Ice Box 98.4 vs Owen's Hash Marks 91.2, Est. win% 62/38. Four Sleeper and two ESPN boards, short benches, a moving scoring tape with an injury, a waiver, and a trade, plus the NFL ticker. From there the slate plays out: halftime ends, early games go final, and the late window kicks off. A small **Replay** chip sits in the top bar while it's armed; **Disarm Replay** on Connect restarts into your real leagues.

From a dev checkout (power-user escape hatch):

```bash
npm run replay           # SIDELINE_REPLAY=1: Replay armed, plays out from the pinned frame
npm run replay:capture   # also SIDELINE_REPLAY_HOLD=1: holds the pinned frame for marketing stills
```

Replay is fixture-only. It never calls a sports-data API, never touches ESPN cookies or your Sleeper username (sign-in, sign-out, and league edits are refused while it's armed), and its slug league ids are stripped from settings on the next live launch.

## Connect

Connect is a hub with three peer cards: **ESPN**, **Sleeper**, and **TV**. Shortcuts and update settings sit in a quiet footer on the hub. How-to copy is on each path.

### Sleeper

Open the Sleeper card and type your **username** (not email, not password). Sideline calls `GET /v1/user/{username}`, then lists your NFL leagues for the current `league_season`. Every league is checked; uncheck any you do not want, then **Add selected**. Sideline opens Boards after that first add. Remove a league from the hub, or **Sign out** of Sleeper.

### ESPN

Open the ESPN card and **Sign in with ESPN**. Sideline clears the previous in-app ESPN session, then an in-app window opens ESPN's own login (2FA/OTP included). Sideline never sees or stores your password. After you sign in, it reads `espn_s2` and `SWID` from the `persist:espn` session partition on this machine and attaches them to later GETs.

Those cookies expire (often after a few weeks). When they do, sign in again the same way — leftover cookie names from a dead session cannot skip the login window. The hub card shows **Needs re-login**.

League discovery is best-effort and unofficial. The path shows a checklist (all on). Uncheck unwanted leagues, then **Add selected**. If a league is missing, open **Advanced** and **paste the numeric league ID** from the ESPN fantasy URL (`.../football/league?leagueId=XXXX`).

Public leagues sometimes work with no cookies. Private leagues need `espn_s2` + `SWID`. Remove a league from the hub, or **Sign out** of ESPN.

### TV

Open the TV card. **Allow devices on this Wi-Fi to load the overlay** binds the overlay server on all interfaces, shows a **6-digit pairing code**, and requires a session token (`?k=`). On the Google TV app (`tv/`), type that code — you do not enter the IP or hex token.

## Overlay

- Companion: **HUD** toggle in the top bar, or global hotkey `Ctrl+Shift+O` (`Cmd+Shift+O` on Mac). **Edit layout** on Scoreboard when HUD is on (or `E`) opens Overlay Studio: five placements, click-select a team frame or the ticker, then nudge that block’s position/size. **Preset 4** stacks both teams on the same side. Cycle the HUD onto the next monitor with `Ctrl+Shift+M`. `[` / `]` cycle leagues in the companion. All of these are editable under Connect → Keyboard shortcuts.
- Default **Preset 1** is far-side frost rails (**you left, them right**), enlarged centered names and centered scores above each roster. Starter rows are a locked `POS | NAME | PTS` grid. Score ticks flash lime `+N` or alert red `-N` on the pts cell, then settle. **Save over Preset N** keeps the current layout on that slot.
- Watch mode is click-through (`setIgnoreMouseEvents(true, { forward: true })`). Edit restores the mouse.
- OBS Browser Source: `http://127.0.0.1:7333/overlay` (port increments if 7333 is taken)
- Center ~60% of the canvas stays empty so live video is the product. See [`docs/design/hud.md`](docs/design/hud.md) for occupied zones.

### Keyboard shortcuts

Defaults (Windows-first; `Ctrl` is `Cmd` on Mac via `CommandOrControl`):

| Action | Default |
| --- | --- |
| Toggle HUD | `Ctrl+Shift+O` |
| Cycle HUD to next display | `Ctrl+Shift+M` |
| Next league | `]` |
| Previous league | `[` |
| Edit HUD on the overlay | `Ctrl+Shift+E` |

Chorded shortcuts are global (work even when Sideline is not focused). `[` / `]` work in the companion when you are not typing in a field. Connect → **Keyboard shortcuts** to change or reset them; Sideline will not bind the same key to two actions. One monitor: cycle-display is a no-op and shows a brief status.

Companion still has `O` (HUD), `E` (Studio panel), and `Esc` (close Studio) on the Scoreboard.

### TV / LAN

Connect → **Allow devices on this Wi-Fi to load the overlay**. Sideline then binds the overlay server on all interfaces, shows a **6-digit pairing code**, and requires a session token (`?k=`). On the Google TV app (`tv/`), type that code — you do not enter the IP or hex token. Paste the phone URL into a browser to confirm. Loopback OBS use is unchanged while this toggle is off.

Windows is the first-class overlay target. macOS uses `type: 'panel'`, `setAlwaysOnTop(..., 'screen-saver')`, `setVisibleOnAllWorkspaces({ visibleOnFullScreen: true })`, and accessory activation policy so it can sit above fullscreen video. That last setting **hides the Dock icon**; use the tray icon to show the companion.

Google TV overlay app: see [`tv/README.md`](tv/README.md).

## Polling

~30s idle, ~3s **start-to-start** when an NFL game is actually `in` on ESPN's public scoreboard or a kickoff on that scoreboard is within ~10 minutes. A Friday, Saturday, or Sunday-morning window with no game near stays idle. The Thu–Mon calendar window is only the fallback when the scoreboard cannot be reached (every host failing for ~5 minutes, or not fetched yet on launch). ESPN fantasy uses the unofficial `lm-api-reads` JSON views (not HTML scrape); live ticks request `mMatchupScore` / `mLiveScoring` for the current week, with `mTeam` cached from discovery or a one-time parallel fetch. Selected + pinned scoring GETs start before the public NFL scoreboard download (~251KB); that download is cached 10s so a 3s scoring tick does not re-download it, and it does not block the LEAGUES list. Other boards reuse the last snapshot for ~30s, and those snapshots persist to disk for 12 hours so a restart can paint the LEAGUES grid immediately. Sleeper matchups refresh every tick on the hot path; rosters/users and league lists cache ~5 min in memory, and persist to disk for 12 hours so a restart can overlay live `/matchups` without waiting on those GETs. Player map is daily (30s timeout on first download). Stay well under Sleeper's 1000 req/min guidance. A 429, an HTML 403 edge block, or three 5xx in a row pauses requests to that host (honoring `Retry-After`, otherwise 10s doubling to 5 min); the HUD keeps the last scores and shows a quiet "ESPN slow, holding last scores" (or Sleeper) line until a request succeeds.

## Out of scope

Yahoo, pick'em, DFS, betting, odds, moneylines, sportsbook UI, chat, drafts, and any write actions (lineups, waivers).

## Packaging

Windows is the first packaging target: a one-click NSIS installer. macOS can wait.

On a **Windows** machine:

```bash
npm install
npm run build:win
```

The setup exe lands at `dist/sideline-1.0.0-setup.exe`. It is a per-user install (no Administrator prompt), creates a **desktop shortcut** and a Start menu entry named Sideline, and does not need to be code-signed to run. That command never uploads a GitHub Release (`--publish never`).

Because the build is unsigned, Windows SmartScreen will likely show **Windows protected your PC**. Choose **More info** → **Run anyway**. Expected for a personal unsigned `.exe`. Authenticode signing is an optional follow-up so that warning goes away; it is not required for private use and is not part of this updater work.

Companion chrome uses the locked **broadcast S** (`src/renderer/assets/broadcast-s.svg`, window/tray `build/broadcast-s.png`). Windows taskbar/shortcut and Mac packaging (`build/icon.png` / `icon.svg` / `icon.ico` / `icon.icns`) are that same solid lime `#B6FF3B` S on black. `scripts/generate-app-icon.py` derives those from `build/broadcast-s.svg`. After `npm run build:win` (or a reinstall), Windows icon cache can keep the old taskbar/shortcut ICO until it refreshes.

`npm run build:mac` is wired and uses `build/icon.icns`, with notarization off. Run that on a Mac when you want a `.dmg`; it is not the current goal. macOS auto-update is out of scope until the app is signed/notarized.

## Updates

Installed Windows builds check **public GitHub Releases** (`ketheridge7/sideline`) via `electron-updater`. People running the installed app do **not** need a GitHub token. `npm start` / `electron-vite` never talks to the updater.

Connect → **Check for updates**. On startup (packaged only) Sideline also checks once. A toast appears when an update is available or finished downloading. **Restart to install** runs the NSIS installer (`quitAndInstall`).

### Ship a release

1. Merge to `main`.
2. Bump `version` in `package.json` (semver).
3. Commit, tag `vX.Y.Z` to match that version, and push the tag — or on Windows run `npm run build:win:publish`.
4. Publishing uploads `sideline-X.Y.Z-setup.exe`, `latest.yml`, and the `.blockmap` to a GitHub Release.
5. `releaseType: release` publishes that Release immediately (not a draft) so `electron-updater` can read `/releases/latest`.
6. Already-installed Sideline offers the update on the next check.

Tag workflow (`.github/workflows/release.yml`) builds NSIS on `windows-latest` when you push `v*`. It maps `GITHUB_TOKEN` to `GH_TOKEN` for electron-builder (`contents: write` on the same repo). No extra secret.

### Publishing auth (maintainers only)

Uploading assets needs GitHub auth. Checking/downloading updates does not.

- **GitHub Actions:** `GITHUB_TOKEN` (already provided). Do not add a PAT to the workflow.
- **Local Windows:** `gh auth login`, or set a `GH_TOKEN` env var to a PAT that can create releases, then `npm run build:win:publish`. electron-builder reads `GH_TOKEN`. Never commit it, and never bake it into the app.

`npm run build:win` still builds the installer without publishing.

# Sideline

Second-screen fantasy companion for NFL Sundays. One Electron app, two windows: a glanceable companion board and a compact always-on-top overlay. Same live data, no backend.

**Sleeper** uses the official read-only HTTP API. **ESPN** access is unofficial, uses your own login, and is for personal companion use only.

## Run

```bash
npm install
npm start
```

Preseason / no live scoring yet? Replay a completed 2025 week with jittered totals:

```bash
npm run replay
```

That loads both a Sleeper board and an ESPN board so you can flip the switcher and watch scores tick.

## Connect

### Sleeper

Type your Sleeper **username** (not email, not password). Sideline calls `GET /v1/user/{username}`, then lists your NFL leagues for the current `league_season` from `GET /v1/state/nfl`.

### ESPN

Click **Sign in with ESPN**. An in-app window opens ESPN's own login (2FA/OTP included). Sideline never sees or stores your password. After you sign in, it reads `espn_s2` and `SWID` from the `persist:espn` session partition on this machine and attaches them to later GETs.

Those cookies expire (often after a few weeks). When they do, sign in again the same way.

League discovery is best-effort and unofficial. If your leagues don't appear, **paste the numeric league ID** from the ESPN fantasy URL (`.../football/league?leagueId=XXXX`).

Public leagues sometimes work with no cookies. Private leagues need `espn_s2` + `SWID`.

## Overlay

- Companion: **Overlay** button, or global hotkey `Ctrl+Shift+O` (`Cmd+Shift+O` on Mac)
- OBS Browser Source: `http://127.0.0.1:7333/overlay` (port increments if 7333 is taken)
- Overlay stays interactive and draggable in v1. Click-through is later.

### TV / LAN

Connect → **Allow devices on this Wi-Fi to load the overlay**. Sideline then binds the overlay server on all interfaces and requires a session token (`?k=`). Paste the TV URL into a phone browser to confirm, or into the Sideline Google TV app (`tv/`). Loopback OBS use is unchanged while this toggle is off.

Windows is the first-class overlay target. macOS uses `type: 'panel'`, `setAlwaysOnTop(..., 'screen-saver')`, `setVisibleOnAllWorkspaces({ visibleOnFullScreen: true })`, and accessory activation policy so it can sit above fullscreen video. That last setting **hides the Dock icon**; use the tray icon to show the companion.

Google TV overlay app: see [`tv/README.md`](tv/README.md).

## Polling

~30s idle, ~10s when games are likely live (regular/postseason, America/New_York: Sunday from 12:55p, Monday from 7p, Thursday from 7:30p). Sleeper's player map is cached locally once per day. Stay well under Sleeper's 1000 req/min guidance.

## Out of scope

Yahoo, pick'em, DFS, betting, chat, drafts, and any write actions (lineups, waivers).

## Build

```bash
npm run build:win
npm run build:mac
```

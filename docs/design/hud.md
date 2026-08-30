# Sideline HUD — Sunday Tape

Locked spec for the Sunday watch companion and Hashmark overlay. Sleeper is the production API. ESPN reuses the same widgets and `Matchup` model (cookie login on this machine). This file is the visual/system source of truth; do not invent a second overlay language.

**Out of scope:** betting / odds / moneylines, DFS, Yahoo, chat, drafts, write actions (lineups, waivers).

---

## Product split

- **Companion.** Board is the production truck for **one** matchup: left watchlist of pinned leagues, center you-vs-them board, right scoring TAPE, Overlay Studio.
- **Overlay = Hashmark.** One fullscreen transparent canvas. Modules sit on the **sidelines**; the center stays empty so live video is the product. Smoke panes, never a near-opaque card.
- **Editor.** Companion Overlay Studio is canonical. Desktop overlay can enter Edit (`Ctrl/Cmd+Shift+E`) to drag/resize. TV (`?tv=1`) and OBS (`?surface=obs`) never mount edit chrome, even if `?edit=1` is appended.

Screens stay **Board / Boards / Connect**. Overlay is a window, not a fourth nav destination.

---

## Tokens (Sunday Tape)

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#07080A` | OLED |
| `--card` | `#101216` | Panels |
| `--line` | `#1E232B` | Hairline |
| `--text` | `#F4F6F8` | Primary |
| `--muted` | `#94A3B8` | Meta / them steel |
| `--you` | `#7DD3FC` | Ice — your hash, lead, selected |
| `--them` | `#94A3B8` | Opponent. Not “loss” |
| `--lime` | `#B6FF3B` | Just scored / HUD on |
| `--air` | `#FF4D4D` | ON AIR, injury, waiver |
| Sleeper / ESPN | cyan / crimson | **tiny stamps only** |

Type: Barlow + Barlow Condensed (condensed grotesk for scores/headers, UI sans for body). Data radii 0–2px. Tabular nums. Overlay fill ≤ ~28% smoke (TV floor 40%). Type stays full contrast. One focal matchup; rails sit at ~60% visual weight.

Do not show betting percentages. A lead bar is share of combined fantasy points plus a delta, not a win probability.

---

## Overlay widget catalog

Coordinates are **percent of canvas**. Each id is independently placed, hidden, resized, locked, and given fill opacity.

- Meta: `meta.league`, `meta.week`, `meta.live`
- Identity: `team.mine.name`, `team.opp.name`
- Scores: `score.mine`, `score.opp`, `score.delta` (lead pill)
- Rails (split name vs points): `col.mine.pos|name|nfl|pts`, `col.opp.*`
- Bench: `bench.mine`, `bench.opp` (hidden in Broadcast L)
- Alerts: `toast.slot` (moving crawler when tape/toasts exist)

Default preset **Broadcast L**: left spine your rail + lead pill; right spine their rail; bottom crawler; center ~60% empty. Also: Corners, PiP, Minimal, plus `user.1`.

Rails group by default (`groupedRails`). Ungroup to place columns separately. `trackLock` keeps row Y/H aligned.

Watch mode: Electron `setIgnoreMouseEvents(true, { forward: true })`. Edit: mouse restored, 8-column percent grid, 1% snap (Alt free-place).

---

## HUD payload

`OverlayHudState` is provider-agnostic: scores, both starters, both benches, week, `pollingLive`, last toast, `tape`, `layout`. Adapters map transactions to `trade | add | drop | add_drop | status`. Score ticks and injuries append to `tape` only from real diffs. Do not branch overlay markup on `provider === 'sleeper'`.

Layout persists in `sideline-settings.json` and is pushed on the same SSE `/events` payload so OBS and Google TV update when Studio saves.

---

## Companion Board

- Left rail: pinned leagues as a live watchlist (name, two scores, sparkline or delta, selected ice bar). `[` `]` still cycle.
- Center: one Kalshi-style head-to-head (huge you vs them, lead bar / delta), slot-aligned starters, horizontal bench chips.
- Right rail: scoring TAPE (newest first) from existing transactions + point diffs. Quiet empty state if history is thin — never fake play-by-play.
- No NFL game ticker unless a sports-data feed already exists (it does not).
- Top bar: SIDELINE wordmark, week, BOARD / BOARDS / CONNECT, HUD toggle, quiet Studio.
- Overlay Studio: real mini HUD preview, not gold rectangles.

Keyboard: `[` `]` channels, `O` HUD, `E` Studio, `Esc` close Studio.

---

## ESPN

Connect/Boards stay provider-specific. Board, overlay widgets, layout JSON, tape, and crawler consume only `Matchup` + `OverlayHudState` + `TapeEvent`. ESPN cookies never leave the machine. Adapter maps `proTeamId` to NFL abbreviations and only surfaces real injury/IR — never raw `ACTIVE` / `INJURY_RESERVE` / owner abbrev.

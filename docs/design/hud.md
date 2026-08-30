# Sideline HUD — Booth + Hashmark

Locked spec for the Sunday watch companion and overlay. Sleeper is the production API. ESPN reuses the same widgets and `Matchup` model later. This file is the visual/system source of truth; do not invent a second overlay language.

**Out of scope:** waivers, standings, chat, player research, multi-league tickers, write actions.

---

## Product split

- **Companion = Booth.** Board is the production truck for **one** matchup: scores, both full lineups, both benches, live crawler, Overlay Studio.
- **Overlay = Hashmark.** One fullscreen transparent canvas. Modules sit on the **sidelines**; the center stays empty so live video is the product. Smoke panes, never a near-opaque card.
- **Editor.** Companion Overlay Studio is canonical. Desktop overlay can enter Edit (`Ctrl/Cmd+Shift+E`) to drag/resize. TV (`?tv=1`) and OBS (`?surface=obs`) never mount edit chrome, even if `?edit=1` is appended.

Screens stay **Board / Boards / Connect**. Overlay is a window, not a fourth nav destination.

---

## Tokens (provider-agnostic)

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#050505` | OLED |
| `--card` | `#0C0C0A` | Warm film |
| `--line` | `#242420` | Hairline |
| `--text` | `#F2F0E8` | Ivory |
| `--muted` | `#8A8778` | Meta |
| `--you` | `#E6B422` | Home / your hash / lead delta |
| `--them` | `#8A9BA8` | Away. Opponent is not “loss” |
| `--air` | `#E63946` | ON AIR, crawler, injury labels |
| Sleeper / ESPN | cyan / red | **10px stamps only** |

Type: Barlow + Barlow Condensed. Data radii 0–2px. No `backdrop-filter`. Overlay fill ≤ ~28% smoke (TV floor 40%). Type stays full contrast.

---

## Overlay widget catalog

Coordinates are **percent of canvas**. Each id is independently placed, hidden, resized, locked, and given fill opacity.

- Meta: `meta.league`, `meta.week`, `meta.live`
- Identity: `team.mine.name`, `team.opp.name`
- Scores: `score.mine`, `score.opp`, `score.delta`
- Rails (split name vs points): `col.mine.pos|name|nfl|pts`, `col.opp.*`
- Bench: `bench.mine`, `bench.opp` (hidden in Broadcast L)
- Alerts: `toast.slot`

Default preset **Broadcast L**: left spine your rail + bottom ledger; right spine their rail; center ~60% empty. Also: Corners, PiP, Minimal, plus `user.1`.

Rails group by default (`groupedRails`). Ungroup to place columns separately. `trackLock` keeps row Y/H aligned.

Watch mode: Electron `setIgnoreMouseEvents(true, { forward: true })`. Edit: mouse restored, 8-column percent grid, 1% snap (Alt free-place).

---

## HUD payload

`OverlayHudState` is provider-agnostic: scores, both starters, both benches, week, `pollingLive`, last toast, `layout`. Adapters map transactions to `trade | add | drop | add_drop | status`. Do not branch overlay markup on `provider === 'sleeper'`.

Layout persists in `sideline-settings.json` and is pushed on the same SSE `/events` payload so OBS and Google TV update when Studio saves.

---

## Companion Board

- Channel strip of pinned leagues (not a `<select>`)
- Compressed scoreboard (amber you / steel them)
- Slot-aligned starters + horizontal bench chip rails
- Bottom crawler for transactions
- Overlay Studio drawer: HUD power, Edit, presets, kit (eye/lock), opacity, rail grouping

Keyboard: `[` `]` channels, `O` HUD, `E` Studio, `Esc` close Studio.

---

## ESPN later

Connect/Boards stay provider-specific. Board, overlay widgets, layout JSON, and crawler consume only `Matchup` + `OverlayHudState`. ESPN cookies never leave the machine.

# Sideline HUD — Sunday Tape

Locked spec for the Sunday watch companion and Hashmark overlay. Sleeper is the production API. ESPN reuses the same widgets and `Matchup` model (cookie login on this machine). This file is the visual/system source of truth; do not invent a second overlay language.

**Out of scope:** betting / odds / moneylines, DFS, Yahoo, chat, drafts, write actions (lineups, waivers).

---

## Product split

- **Companion.** Board is the production truck for **one** matchup: left watchlist of pinned leagues, center you-vs-them board, right scoring TAPE, Overlay Studio.
- **Overlay = Hashmark.** One fullscreen transparent canvas. Modules sit on the **sidelines**; the center stays empty so live video is the product. Smoke panes, never a near-opaque card.
- **Editor.** Companion Overlay Studio is canonical. Desktop overlay can enter Edit (`Ctrl/Cmd+Shift+E`) to drag/resize. TV (`?tv=1`) and OBS (`?surface=obs`) never mount edit chrome, even if `?edit=1` is appended.

Screens stay **Scoreboard / Leagues / Connect**. Overlay is a window, not a fourth nav destination.

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

Type: Barlow + Barlow Condensed (condensed grotesk for scores/headers, UI sans for body). Data radii 0–2px. Tabular nums. Overlay names/scores are fill `0` (text + shadow only). Rail columns use ~5% smoke with a faded wash — never a framed card. TV floor ~8% so living-room contrast stays on type, not a pane. Type scales with widget size (`cqh`). One focal matchup; rails sit at ~60% visual weight.

Do not show betting percentages. A lead bar is share of combined fantasy points plus a delta, not a win probability.

---

## Overlay widget catalog

Coordinates are **percent of canvas**. Each id is independently placed, hidden, resized, locked, and given fill opacity.

- Meta: `meta.league`, `meta.week` (hidden in every canned preset), `meta.live` (1px lime live/replay pip, no ON AIR wordmark)
- Identity: `team.mine.name`, `team.opp.name` — condensed uppercase, sized to the name widget (`cqh`), above the team score
- Scores: `score.mine`, `score.opp` (loudest number, fills the score widget), `score.delta` (tiny lead next to your score, not a third scoreboard)
- Rails: `col.mine.pos|name|pts`, `col.opp.pos|name|pts` — pos muted, last name, pts right-aligned tabular. Row type scales with row height. `col.*.nfl` stays in the catalog but is hidden.
- Bench / alerts: `bench.mine`, `bench.opp`, `toast.slot` stay in the catalog, hidden in every canned preset. No crawler, no toast chips, no marquee.

Visible HUD is **names, scores, and both starter rails**. Last names only (`overlayName`). No NFL city tags.

### Score ticks (inline, not tape)

When a player's points **increase**, that pts cell (and the team total if the sum moved) highlights lime `#B6FF3B`, shows the delta in the same type slot (`+6.2`) for the full ~1.1s beat (limeT held at 1), then eases to the new total. Lime eases off over ~1.6s total back to ice (`#7DD3FC`, you) or steel (`#94A3B8`, them).

When points **drop**, the same beat runs in alert red `#FF4D4D` with `-N` (e.g. `-0.3`). Drops are a first-class tick (`kind: 'down'`), not idle. Zero-change / noise never flash. Shared `scoreTickChange` / `ScoreTick` drive overlay rails, overlay team scores, Board starter/team totals, and tape rows that are a pts delta.

Default preset **Tape rails** (`national`): dual skinny rails — them left, you right — with names + scores above each rail. No framed card. Type fills the allocated widgets. Center video stays clear.

```
them left / you right
y 10–13.4   team name
y 13.6–22.6 team total (dominant) + tiny lead on you
y 23.2–81.2 starters  pos | name | pts
```

**RedZone** (optional): both lineups stacked on the **left** so NFL RedZone keeps the right ~20% (`x >= 80`), top banner (`y < 12`), and bottom ticker (`y > 82`).

```
y 14–23  YOUR name + YOUR score + tiny lead
y 23–48  YOUR starters  pos | name | pts
y 50–57  THEIR name + THEIR score
y 57–80  THEIR starters pos | name | pts
```

Watch templates (Studio dropdown order): **Tape rails**, **RedZone**, **Ticket**, then Minimal, Broadcast L, Corners, PiP, Custom.

Occupied broadcast chrome — Tape rails relaxes the old eyebar floor so type can use the rail. RedZone / Ticket still vacate network chrome:

| Zone | Occupancy |
| --- | --- |
| `y < 12` | Network eyebar / RedZone banner (**RedZone / Ticket**) |
| `y > 82` (RedZone / Ticket) or `y+h > 86` (Tape rails) | Bottom ticker + modern scorebug |
| `x >= 80` on RedZone | Persistent RedZone score/stat rail (full height) |
| `x > 78` on Ticket | Optional YouTube TV / Sunday Ticket right panel (~25%) |
| Center `x 22–78`, `y 22–86` | Live video. Stay off it. |

**Tape rails:** dual skinny rails — them left, you right — names + scores above each rail, `y >= 10`, `y+h <= 86`. Ghost fill on names/scores. Soft wash on roster columns. No crawler.

**Ticket:** stacked like RedZone (both teams), left-only, `x <= 78`, `y 14–82`.

**Broadcast L / Corners / PiP:** same widget visibility (both starter rails). **Minimal:** scores only.

Saved `presetId`s are kept; unknown ids fall back to Tape rails (`national`). `user.1` clones Tape rails until you drag.

Rails group by default (`groupedRails`). Ungroup to place columns separately. `trackLock` keeps row Y/H aligned.

Watch mode: Electron `setIgnoreMouseEvents(true, { forward: true })`. Edit: mouse restored, 8-column percent grid, 1% snap (Alt free-place).

---

## HUD payload

`OverlayHudState` is provider-agnostic: scores, both starters, both benches, week, `pollingLive`, last toast, `tape`, `layout`. Adapters map transactions to `trade | add | drop | add_drop | status`. Score ticks and injuries append to `tape` only from real diffs. Do not branch overlay markup on `provider === 'sleeper'`.

Layout persists in `sideline-settings.json` and is pushed on the same SSE `/events` payload so OBS and Google TV update when Studio saves.

---

## Companion Board

- Left rail: pinned leagues as a live watchlist (name, two scores, sparkline or delta, selected ice bar). `[` `]` still cycle.
- Center: one head-to-head (readable team names, dominant totals, lead bar / delta), slot-aligned starters as pos | name | pts, no framed card around the data.
- Right rail: scoring TAPE (newest first) from existing transactions + point diffs. Quiet empty state if history is thin. Replay may emit short scripted notes (`TD`, `FUM`, `INJ`); live mode never invents play-by-play.
- Bottom ON AIR ticker is **replay-only** chrome from the fixture (scripted NFL chips). No live sports-data API, no betting.
- Top bar: SIDELINE wordmark, week, SCOREBOARD / LEAGUES / CONNECT, HUD toggle, quiet Studio.
- Overlay Studio: real mini HUD preview, not gold rectangles.

Keyboard: `[` `]` channels, `O` HUD, `E` Studio, `Esc` close Studio.

---

## ESPN

Connect/Boards stay provider-specific. Board, overlay widgets, layout JSON, tape, and crawler consume only `Matchup` + `OverlayHudState` + `TapeEvent`. ESPN cookies never leave the machine. Adapter maps `proTeamId` to NFL abbreviations and only surfaces real injury/IR — never raw `ACTIVE` / `INJURY_RESERVE` / owner abbrev.

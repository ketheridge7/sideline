# Sideline HUD — Sunday Tape

Locked spec for the Sunday watch companion and Hashmark overlay. Sleeper is the production API. ESPN reuses the same widgets and `Matchup` model (cookie login on this machine). This file is the visual/system source of truth; do not invent a second overlay language.

**Out of scope:** betting / odds / moneylines, DFS, Yahoo, chat, drafts, write actions (lineups, waivers).

---

## Product split

- **Companion.** Board is the production truck for **one** matchup: left watchlist of pinned leagues, center you-vs-them board, right scoring TAPE, Overlay Studio.
- **Overlay = Hashmark.** One fullscreen transparent canvas. Modules sit on the **sidelines**; the center stays empty so live video is the product. Smoke panes, never a near-opaque card.
- **Editor.** Companion Overlay Studio is canonical: five dual-rail placements, position/size sliders, save/overwrite. Desktop overlay can still enter Edit (`Ctrl/Cmd+Shift+E`) to drag/resize. TV (`?tv=1`) and OBS (`?surface=obs`) never mount edit chrome, even if `?edit=1` is appended.

Screens stay **Scoreboard / Leagues / Connect**. Overlay is a window, not a fourth nav destination.

---

## Tokens (Sunday Tape)

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#07080A` | OLED |
| `--card` | `#101216` | Panels |
| `--line` | `#1E232B` | Hairline |
| `--text` | `#F4F6F8` | Primary |
| `--muted` | `#94A3B8` | Meta |
| `--you` | `#A6E6A0` | Warm ice-green — your team name, lead, selected |
| `--them` | `#E8E4DC` | Warm silver — opponent name. Not “loss” |
| `--lime` | `#B6FF3B` | Just scored / HUD on |
| `--air` | `#FF4D4D` | ON AIR, injury, waiver |
| Sleeper / ESPN | cyan / crimson | **tiny stamps only** |

Type: Barlow + Barlow Condensed (condensed grotesk for scores/headers, UI sans for body). Data radii 0–2px. Tabular nums. Overlay fill is `0` — frosted type only, no smoke wash, no pane, no drop-shadow card. A 0.4px dark glyph stroke keeps contrast on grass. Type scales with widget size (`cqh`). One focal matchup; rails sit at ~60% visual weight.

SCOREBOARD LeadBar is **chance to win**, not score-share and not a betting line. ESPN mirrors official `schedule[].home.winProbability` / `away.winProbability` from `mMatchupScore` (**Chance to win**). Sleeper public `/matchups` has no win% field — SCOREBOARD shows **Est. win%** from weekly `GET /projections/nfl/{season_type}/{season}/{week}` plus live starter points (remaining-aware). Missing projections stay **Est. win% pending**; never fake 50/50 from 0–0. Overlay still shows the point delta only.

---

## Overlay widget catalog

Coordinates are **percent of canvas**. Studio selects **big blocks** (your team frame, their team frame, bottom ticker) and moves that block with position/size sliders. Per-widget show/hide/lock chrome is gone. Preview clicks select; they do not drag.

- Meta: `meta.league`, `meta.week`, `meta.live` (hidden / unpainted in canned presets — no decorative live pip)
- Identity: `team.mine.name`, `team.opp.name` — condensed uppercase, **centered** and enlarged in the name widget (`cqh`), above the team score
- Scores: `score.mine`, `score.opp` (loudest number, **centered** in the score widget), `score.delta` (tiny lead next to your score, not a third scoreboard)
- Rails: one `col.*.name` widget per side paints a CSS grid `POS | NAME | PTS`. Split `col.*.pos` / `col.*.pts` stay in the catalog but are hidden so points cannot drift or overlap position labels. `col.*.nfl` stays hidden. No ice hash line on either rail.
- Bench / alerts: `bench.mine`, `bench.opp`, `toast.slot` stay in the catalog, hidden in every canned preset. No crawler, no toast chips, no marquee.
- Ticker: `ticker.nfl` is the bottom NFL score strip. Studio treats it as one selectable block. No ON AIR wordmark.

Visible HUD is **names, scores, and both starter rails**. Last names only (`overlayName`). No NFL city tags.

### Score ticks (inline, not tape)

When a player's points **increase**, that pts cell (and the team total if the sum moved) highlights lime `#B6FF3B`, shows the delta in the same type slot (`+6.2`) for the full ~1.1s beat (limeT held at 1), then eases to the new total. Lime eases off over ~1.6s total back to frost white on the roster. Team names stay ice-green (you) / warm silver (them).

When points **drop**, the same beat runs in alert red `#FF4D4D` with `-N` (e.g. `-0.3`). Drops are a first-class tick (`kind: 'down'`), not idle. Zero-change / noise never flash. Shared `scoreTickChange` / `ScoreTick` drive overlay rails, overlay team scores, Board starter/team totals, and tape rows that are a pts delta.

Default **Preset 1** (far sides): dual skinny frost rails — **you left, them right** — with enlarged centered names + centered scores above each rail. Tiny lead chip stays next to your total. No framed card. Each starter row is a CSS grid `POS | NAME | PTS`. Center video stays clear.

Studio has **exactly five** placements (same you/them chrome, different screen regions):

| Preset | Placement | Notes |
| --- | --- | --- |
| 1 | Far sides | You on the left gutter, them on the right gutter, full-height-ish rails |
| 2 | Upper corners | Same gutters, shorter rails tucked to the top |
| 3 | Lower corners | Same gutters, shorter rails tucked to the bottom |
| 4 | Same-side stack | Both teams on the **same side**, stacked one above the other (not left/right) |
| 5 | Side bands | You left-upper band, them right-lower band (offset stack) |

Clicking a preset **applies it immediately** to the live HUD (factory map, or the overwritten slot if you saved). The green preset box follows the preset that was actually applied. Click a team frame or the ticker in the Studio preview, then Position X/Y and Width/Height sliders move **that block only**. **Save over Preset N** writes the current geometry into that slot.

Old saved ids (`national`, `redzone`, `ticket`, `broadcast-l`, `corners`, `pip`, `minimal`, `user.1`) migrate onto these five. Split pos/name/pts columns coalesce into one rail widget so leftover settings cannot recreate the offset-points bug.

Occupied broadcast chrome — stay off the live video rectangle:

| Zone | Occupancy |
| --- | --- |
| Center `x 22–78`, `y 22–86` | Live video. Stay off it. |
| Side gutters `x < 22` / `x >= 78` | Dual rails |

Fill `0` everywhere (no wash). Frosted type + 0.4px glyph stroke. No crawler. No ice hash accent.

Watch mode: Electron `setIgnoreMouseEvents(true, { forward: true })`. Edit: mouse restored, 8-column percent grid, 1% snap (Alt free-place).

---

## HUD payload

`OverlayHudState` is provider-agnostic: scores, both starters, both benches, week, `pollingLive`, last toast, `tape`, `layout`. Adapters map transactions to `trade | add | drop | add_drop | status`. Score ticks and injuries append to `tape` only from real diffs. Do not branch overlay markup on `provider === 'sleeper'`.

Layout persists in `sideline-settings.json` and is pushed on the same SSE `/events` payload so OBS and Google TV update when Studio saves. Each layout JSON carries `schemaVersion` (currently **3**: you-left dual frost rails, five placements, Preset 4 same-side stack, `ticker.nfl` block). When that number is missing or behind the factory, Sideline **auto-migrates once**: live widget geometry resets to Preset 1 (far sides) and is written back. Intentionally saved preset slots 1–5 are kept. Current-version Studio overwrites still merge as before — no manual Revert.

SCOREBOARD and the overlay HUD share `HudTeamName` / `HudTeamScore` / `LeadChip` / `LineupRow` (POS | NAME | PTS). Team names stay ice-green (you) / warm silver (them); scores and rows stay frost. Overlay still last-names the rail; the board keeps full names.

---

## Companion Board

- Left rail: pinned leagues as a live watchlist (name, two scores, sparkline or delta, selected ice bar). `[` `]` still cycle. SL / ES health pips sit to the right of the **My leagues** header, not in the top bar.
- Center: one head-to-head (you left / them right, readable team names, dominant totals, lead bar / delta), slot-aligned starters as pos | name | pts, no framed card around the data.
- Right rail: **Scoring tape**. Scoreboard = Scoring tape · This matchup. Leagues/Boards = Scoring tape · All leagues (same name, same right-hand placement). Quiet empty state if history is thin. Replay may emit short scripted notes (`TD`, `FUM`, `INJ`); live mode never invents play-by-play. Injuries land on tape only after a baseline exists (no cold-open injury dump).
- Leagues matchup cards: **Top scorers** chips are highest starter points, not “who just scored.”
- Bottom ticker is **replay-only** NFL chips from the fixture. No ON AIR wordmark, no live sports-data API, no betting.
- Top bar: packaging mark + **SIDELINE** (all caps, lime underline; `build/icon`), week, SCOREBOARD / LEAGUES / CONNECT, HUD toggle (tracks `overlayVisible` from hotkey and the switch), quiet Studio. No decorative Live / Auto-refresh pips. Replay mode still labels **Replay**. ES health stays on the watchlist.
- Overlay Studio: five presets, click-to-select team frames and ticker, position/size sliders for the selected block, save/overwrite. Mini HUD preview. No HUD on/off control — TopBar slider / hotkey owns visibility.

Keyboard: `[` `]` channels, `Ctrl+Shift+O` HUD (global), `Ctrl+Shift+M` next display (global; no-op on one monitor), `Ctrl+Shift+E` overlay edit (global), companion `O` HUD / `E` Studio / `Esc` close Studio. Remap under Connect → Keyboard shortcuts (`sideline-settings.json`).

---

## ESPN

Connect/Boards stay provider-specific. Board, overlay widgets, layout JSON, tape, and crawler consume only `Matchup` + `OverlayHudState` + `TapeEvent`. ESPN cookies never leave the machine. Adapter maps `proTeamId` to NFL abbreviations and only surfaces real injury/IR — never raw `ACTIVE` / `INJURY_RESERVE` / owner abbrev.

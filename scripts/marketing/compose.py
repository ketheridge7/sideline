#!/usr/bin/env python3
"""Composite real Sideline captures onto the game-day backdrops for site stills.

The backdrops in ./backdrops are generated rooms with no people in them. Only the
screens are replaced, and only with real captures from `npm run replay:capture`:

  frost   head-on broadcast plate + HUD             -> site/public/images/frost-hud.jpg
  hero    field plate + HUD inside the existing TV  -> site/public/images/hero-living-room.jpg

The hero TV is an axis-aligned glass (no perspective warp). Both stills are built
at 2x and downscaled so the ticker stays sharp. See docs/marketing/stills.md.

Hero keeps the published room and replaces only the glass from
scripts/marketing/backdrops/tv-field-plate.png (cover-fit, dimmed 10%, preset 3).
Frost-hud is the full frame: scripts/marketing/backdrops/overlay-headon-plate.png
cover-fit, with the real overlay HUD (preset 1, far sides) on top. No room or bezel.
The frost plate is graded before the HUD: side edges darken about 40% and fade
out by 32% of the width, the stands darken about 20% down to the field wall,
and the ticker band is left alone. The plate is zoomed from the top so the near
20/30 numbers fall below the DEF row. The HUD stays on preset 1.
Swap either plate in place and rerun that still:

  python3 scripts/marketing/compose.py hero
  python3 scripts/marketing/compose.py frost
"""

from __future__ import annotations

import argparse
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BACKDROPS = Path(__file__).resolve().parent / "backdrops"
IMAGES = ROOT / "site" / "public" / "images"
OUT_SIZE = (1600, 900)
SUPERSAMPLE = 2

Quad = list[tuple[float, float]]
Rect = tuple[int, int, int, int]

# Glass rectangles measured on the 1280x720 backdrops, just inside the bezel.
# Frost glass is already a rectangle (every column's content edge is y=114 and y=416).
FROST_GLASS: Rect = (365, 114, 916, 417)
# Tight crop so the ticker (4.2% of the glass) stays legible at 1600x900.
FROST_CROP: Rect = (318, 88, 968, 454)
# Hero glass after the picture is flattened. The generated top of this screen is a
# dark gash (about y=82-129); repair_hero_glass clones clean field over it.
HERO_GLASS: Rect = (260, 78, 740, 366)
# Laptop panel, remeasured: axis-aligned enough to resize into (the bottom edge
# slopes one pixel). Content x=830-1034, y=404-524.
HERO_LAPTOP: Rect = (830, 404, 1034, 524)
# Crop that keeps the full TV and the laptop, tighter than the full 1280x720 frame.
HERO_CROP: Rect = (180, 28, 1100, 545)

BROADCAST_DIM = 0.2
LAPTOP_DIM = 0.12
# Hero TV picture. Drop-in replacement: same filename, then `compose.py hero`.
FIELD_PLATE = BACKDROPS / "tv-field-plate.png"
FIELD_DIM = 0.10
# Head-on 50-yard broadcast. Drop-in replacement: same filename, then `compose.py frost`.
HEADON_PLATE = BACKDROPS / "overlay-headon-plate.png"
# Live overlay: preset 1 is far sides (left and right thirds). Preset 3 is lower corners.
HERO_HUD_PRESET = "3"
FROST_HUD_PRESET = "1"
# Frost plate grade only. The HUD is composited after this, still on preset 1.
# Edges: 40% darker, smooth to 0 by 32% of the width (the center 50 stays bright).
FROST_EDGE_DARK = 0.40
FROST_EDGE_REACH = 0.32
# Stands: 20% darker at the top, smooth to 0 at the field wall.
FROST_STAND_DARK = 0.20
# Preset 1 ticker (overlayLayout.ts). Plate pixels in this band are not graded.
FROST_TICKER_TOP = 0.958
# Near 20/30 glyphs on overlay-headon-plate.png start at about y=521/720 (72.4%).
# Preset 1's DEF row ends at 81.2%. A 5% center zoom only slides that band to
# ~74%, still through the row. Zooming 13% from the top drops it to ~82%.
FROST_PLATE_SCALE = 1.13
FROST_PLATE_ANCHOR_Y = 0.0


def perspective_coeffs(dst: Quad, src: Quad) -> list[float]:
    rows, rhs = [], []
    for (x, y), (u, v) in zip(dst, src):
        rows.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        rhs.append(u)
        rows.append([0, 0, 0, x, y, 1, -v * x, -v * y])
        rhs.append(v)
    return np.linalg.solve(np.array(rows, float), np.array(rhs, float)).tolist()


def repair_frost_bezel(room: Image.Image) -> Image.Image:
    """Close the generated black trench between the bezel highlight and the glass.

    On gameday-tv.png the glass is a perfect rectangle, but rows y=109-113 are a
    near-black gap under the y=107 highlight. Upscaling that gap is what reads as
    a warped top edge. Fill it with the bezel face so the lip meets the glass.
    """
    arr = np.array(room.convert("RGB"))
    x0, y0, x1, y1 = FROST_GLASS
    face = arr[102:106, x0:x1].astype(np.float32).mean(axis=0)
    for index, y in enumerate(range(109, y0)):
        shade = 0.92 - index * 0.08
        arr[y, x0:x1] = np.clip(face * shade, 0, 255).astype(np.uint8)
    # Same generated trench under the glass (y=417-422), between the picture and the stand.
    under = arr[y1 + 8 : y1 + 14, x0:x1].astype(np.float32).mean(axis=0)
    span = 6
    for index, y in enumerate(range(y1, y1 + span)):
        mix = (index + 1) / (span + 1)
        arr[y, x0:x1] = np.clip(face * (1 - mix) * 0.55 + under * mix, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def repair_hero_glass(room: Image.Image) -> Image.Image:
    """Flatten the hero TV and replace the garbled top of the picture.

    The cabinet's glass is nearly straight (left x=258, right x=740, bottom sloping
    about 7px). The top of the generated picture is not: rows y=82-129 are a dark,
    broken band (about half the pixels under luminance 30) cutting through the
    field. Unwarp the slight keystone into HERO_GLASS, then clone the clean field
    just below that band over it so the top edge is one straight line.
    """
    arr = np.array(room.convert("RGBA"))
    src: Quad = [(258, 78), (741, 78), (741, 364), (258, 368)]
    x0, y0, x1, y1 = HERO_GLASS
    width, height = x1 - x0, y1 - y0
    dst: Quad = [(0, 0), (width, 0), (width, height), (0, height)]
    flat = room.convert("RGBA").transform(
        (width, height), Image.PERSPECTIVE, perspective_coeffs(dst, src), Image.BICUBIC
    )
    flat_arr = np.array(flat)
    # Band in the flattened image that corresponds to the gash. The source gash
    # starts ~4px under the glass top and runs ~48px; cloning the next clean strip
    # covers it without inventing a new scene.
    gash_top, gash_bottom = 4, 52
    donor = flat_arr[56:104]
    if donor.shape[0] == 0:
        raise RuntimeError("hero glass donor strip is empty")
    cloned = np.array(Image.fromarray(donor).resize((width, gash_bottom - gash_top), Image.LANCZOS))
    # Feather the clone into the original so the seam is not a hard line.
    span = gash_bottom - gash_top
    fade = np.linspace(1.0, 0.15, span, dtype=np.float32)[:, None, None]
    base = flat_arr[gash_top:gash_bottom].astype(np.float32)
    flat_arr[gash_top:gash_bottom] = np.clip(cloned.astype(np.float32) * fade + base * (1 - fade), 0, 255).astype(
        np.uint8
    )
    # One-pixel inner lip so the repaired field meets a straight bezel.
    lip = flat_arr[0].astype(np.float32) * 0.35
    flat_arr[0] = np.clip(lip, 0, 255).astype(np.uint8)
    arr[y0:y1, x0:x1] = flat_arr
    return Image.fromarray(arr, "RGBA").convert("RGB")


def dim_glass(base: Image.Image, rect: Rect, amount: float) -> Image.Image:
    arr = np.array(base.convert("RGBA"))
    x0, y0, x1, y1 = rect
    glass = arr[y0:y1, x0:x1].astype(np.float32)
    glass[:, :, :3] *= 1 - amount
    arr[y0:y1, x0:x1] = np.clip(glass, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def paste_flat(base: Image.Image, layer: Image.Image, rect: Rect, dim: float = 0.0) -> None:
    """Resize the capture once into the glass. No perspective warp."""
    x0, y0, x1, y1 = rect
    resized = layer.convert("RGBA").resize((x1 - x0, y1 - y0), Image.LANCZOS)
    if dim:
        shade = Image.new("RGBA", resized.size, (0, 0, 0, int(255 * dim)))
        resized = Image.alpha_composite(resized, shade)
    base.alpha_composite(resized, (x0, y0))


def scaled_rect(rect: Rect, sx: float, sy: float, ox: float = 0, oy: float = 0) -> Rect:
    x0, y0, x1, y1 = rect
    return (
        int(round((x0 - ox) * sx)),
        int(round((y0 - oy) * sy)),
        int(round((x1 - ox) * sx)),
        int(round((y1 - oy) * sy)),
    )


def render(room: Image.Image, crop: Rect, glass: Rect, hud: Image.Image, laptop: tuple[Rect, Image.Image] | None) -> Image.Image:
    x0, y0, x1, y1 = crop
    work = (OUT_SIZE[0] * SUPERSAMPLE, OUT_SIZE[1] * SUPERSAMPLE)
    sx, sy = work[0] / (x1 - x0), work[1] / (y1 - y0)
    base = room.crop(crop).resize(work, Image.LANCZOS).convert("RGBA")
    tv = scaled_rect(glass, sx, sy, x0, y0)
    base = dim_glass(base, tv, BROADCAST_DIM)
    paste_flat(base, hud, tv)
    if laptop:
        panel, board = laptop
        paste_flat(base, board, scaled_rect(panel, sx, sy, x0, y0), dim=LAPTOP_DIM)
    return base.resize(OUT_SIZE, Image.LANCZOS)


def frost(hud: Path) -> Image.Image:
    room = repair_frost_bezel(Image.open(BACKDROPS / "gameday-tv.png"))
    return render(room, FROST_CROP, FROST_GLASS, Image.open(hud), None)


def hero(hud: Path, board: Path) -> Image.Image:
    room = repair_hero_glass(Image.open(BACKDROPS / "gameday-dual.png"))
    return render(room, HERO_CROP, HERO_GLASS, Image.open(hud), (HERO_LAPTOP, Image.open(board)))


def supersampled_hero_glass() -> Rect:
    """HERO_GLASS mapped into the 2x hero frame, matching render()."""
    x0, y0, x1, y1 = HERO_CROP
    work = (OUT_SIZE[0] * SUPERSAMPLE, OUT_SIZE[1] * SUPERSAMPLE)
    sx, sy = work[0] / (x1 - x0), work[1] / (y1 - y0)
    return scaled_rect(HERO_GLASS, sx, sy, x0, y0)


def output_hero_glass() -> Rect:
    """Axis-aligned glass in the published 1600x900 hero (half-open)."""
    x0, y0, x1, y1 = supersampled_hero_glass()
    return (x0 // SUPERSAMPLE, y0 // SUPERSAMPLE, (x1 + 1) // SUPERSAMPLE, (y1 + 1) // SUPERSAMPLE)


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Scale so the image fills size, then center-crop."""
    tw, th = size
    sw, sh = image.size
    scale = max(tw / sw, th / sh)
    resized = image.resize((max(tw, round(sw * scale)), max(th, round(sh * scale))), Image.LANCZOS)
    left = max(0, (resized.width - tw) // 2)
    top = max(0, (resized.height - th) // 2)
    return resized.crop((left, top, left + tw, top + th))


def cover_anchored(
    image: Image.Image, size: tuple[int, int], scale: float, anchor_y: float
) -> Image.Image:
    """Cover-fit, then zoom by `scale` and crop.

    Horizontal crop stays centered. `anchor_y` places the vertical crop in the
    leftover strip (0 keeps the top, so lower field markings move down).
    """
    tw, th = size
    sw, sh = image.size
    fit = max(tw / sw, th / sh) * scale
    resized = image.resize((max(tw, round(sw * fit)), max(th, round(sh * fit))), Image.LANCZOS)
    left = max(0, (resized.width - tw) // 2)
    slack = max(0, resized.height - th)
    top = min(slack, max(0, int(round(slack * anchor_y))))
    return resized.crop((left, top, left + tw, top + th))


def _smoothstep(t: np.ndarray) -> np.ndarray:
    x = np.clip(t, 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


def field_wall_fraction(rgb: np.ndarray) -> float:
    """Where the stands give way to the field, as a fraction of frame height."""
    height, width = rgb.shape[:2]
    x0, x1 = int(width * 0.40), int(width * 0.60)
    sl = rgb[:, x0:x1].astype(np.float32)
    green = sl[:, :, 1].mean(axis=1)
    blue = sl[:, :, 2].mean(axis=1)
    rows = np.arange(height)
    # The field reads yellow-green (green only a little above red) against a blue wall.
    hit = np.where(
        (rows >= int(height * 0.12))
        & (rows < int(height * 0.55))
        & (green > blue + 40)
        & (green > 90)
    )[0]
    if hit.size == 0:
        return 0.30
    return float(hit[0] / height)


def grade_frost_plate(field: Image.Image) -> Image.Image:
    """Darken the side edges and the stands. Leave the ticker band untouched."""
    original = np.array(field.convert("RGB"))
    rgb = original.astype(np.float32)
    height, width = rgb.shape[:2]
    wall = field_wall_fraction(original)
    ys = (np.arange(height) + 0.5) / height
    xs = (np.arange(width) + 0.5) / width
    edge = np.maximum(
        1.0 - _smoothstep(xs / FROST_EDGE_REACH),
        1.0 - _smoothstep((1.0 - xs) / FROST_EDGE_REACH),
    )
    # Ease the side shade out just above the ticker so the strip stays at the
    # plate's own brightness and the join is not a hard line.
    above_ticker = 1.0 - _smoothstep((ys - (FROST_TICKER_TOP - 0.02)) / 0.02)
    edge_amt = (FROST_EDGE_DARK * edge)[None, :] * above_ticker[:, None]
    stand = 1.0 - _smoothstep(ys / wall)
    stand_amt = (FROST_STAND_DARK * stand)[:, None]
    factor = (1.0 - edge_amt) * (1.0 - stand_amt)
    rgb *= factor[:, :, None]
    graded = np.clip(np.rint(rgb), 0, 255).astype(np.uint8)
    graded[ys >= FROST_TICKER_TOP] = original[ys >= FROST_TICKER_TOP]
    return Image.fromarray(graded, "RGB")


def render_overlay_hud(out: Path, preset: str) -> None:
    """Capture a Studio preset from the real overlay (render-hero-hud.mjs + hud-shot.mjs)."""
    script = Path(__file__).resolve().parent / "render-hero-hud.mjs"
    subprocess.run(["node", str(script), str(out), preset], cwd=ROOT, check=True)


def render_hero_hud(out: Path) -> None:
    render_overlay_hud(out, HERO_HUD_PRESET)


def broadcast_field(plate_path: Path, hud_path: Path) -> Image.Image:
    """Full-bleed plate with the HUD placed flat. No TV, room, or bezel.

    Cover-fit at 2x, grade the plate, composite the transparent overlay with
    Lanczos, then downscale to 1600x900 so the ticker stays sharp. The HUD is
    not moved off preset 1.
    """
    if not plate_path.is_file():
        raise SystemExit(f"missing field plate: {plate_path}")
    work = (OUT_SIZE[0] * SUPERSAMPLE, OUT_SIZE[1] * SUPERSAMPLE)
    placed = cover_anchored(
        Image.open(plate_path).convert("RGB"),
        work,
        FROST_PLATE_SCALE,
        FROST_PLATE_ANCHOR_Y,
    )
    field = grade_frost_plate(placed).convert("RGBA")
    paste_flat(field, Image.open(hud_path), (0, 0, work[0], work[1]))
    return field.resize(OUT_SIZE, Image.LANCZOS).convert("RGB")


def hero_field(room_path: Path, plate_path: Path, hud_path: Path) -> Image.Image:
    """Replace only the TV glass. Room, glow, laptop, chips, and bezel stay put.

    The plate is cover-fit into the flattened glass, dimmed, then the HUD is
    placed flat with Lanczos. Work happens at 2x and is downscaled, same as the
    backdrop composite. The bezel is the pixels outside the glass, copied back
    from the published hero so they stay on top of the new picture.
    """
    if not plate_path.is_file():
        raise SystemExit(f"missing field plate: {plate_path}")
    room = Image.open(room_path).convert("RGB")
    if room.size != OUT_SIZE:
        raise SystemExit(f"hero base must be {OUT_SIZE[0]}x{OUT_SIZE[1]}, got {room.size}")
    tv = supersampled_hero_glass()
    glass = output_hero_glass()
    work = room.resize((OUT_SIZE[0] * SUPERSAMPLE, OUT_SIZE[1] * SUPERSAMPLE), Image.LANCZOS).convert("RGBA")
    field = cover(Image.open(plate_path).convert("RGB"), (tv[2] - tv[0], tv[3] - tv[1]))
    shaded = np.array(field).astype(np.float32)
    shaded *= 1 - FIELD_DIM
    field = Image.fromarray(np.clip(shaded, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    work.paste(field, (tv[0], tv[1]))
    paste_flat(work, Image.open(hud_path), tv)
    down = work.resize(OUT_SIZE, Image.LANCZOS).convert("RGB")
    x0, y0, x1, y1 = glass
    patched = room.copy()
    patched.paste(down.crop((x0, y0, x1, y1)), (x0, y0))
    before = np.array(room)
    after = np.array(patched)
    outside = np.ones(before.shape[:2], dtype=bool)
    outside[y0:y1, x0:x1] = False
    if np.any(before[outside] != after[outside]):
        raise SystemExit("hero composite changed pixels outside the TV glass")
    return patched


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("shot", choices=["frost", "hero"])
    parser.add_argument("--hud", type=Path, help="transparent 1920x1080 HUD render (hud-shot.mjs). Rendered from the overlay when omitted.")
    parser.add_argument("--plate", type=Path, help="field plate (default depends on the shot)")
    parser.add_argument("--base", type=Path, help="published hero to keep outside the glass (default site hero)")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    if args.shot == "frost":
        plate = args.plate or HEADON_PLATE
        if args.hud:
            image = broadcast_field(plate, args.hud)
        else:
            with tempfile.TemporaryDirectory() as tmp:
                hud = Path(tmp) / "hud.png"
                render_overlay_hud(hud, FROST_HUD_PRESET)
                image = broadcast_field(plate, hud)
        out = args.out or IMAGES / "frost-hud.jpg"
    else:
        plate = args.plate or FIELD_PLATE
        base = args.base or IMAGES / "hero-living-room.jpg"
        if args.hud:
            image = hero_field(base, plate, args.hud)
        else:
            with tempfile.TemporaryDirectory() as tmp:
                hud = Path(tmp) / "hud.png"
                render_hero_hud(hud)
                image = hero_field(base, plate, hud)
        out = args.out or IMAGES / "hero-living-room.jpg"
    image.convert("RGB").save(out, quality=90, optimize=True, progressive=True)
    print(f"wrote {out} {image.size}")


if __name__ == "__main__":
    main()

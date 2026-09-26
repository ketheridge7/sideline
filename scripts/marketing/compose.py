#!/usr/bin/env python3
"""Composite real Sideline captures onto the game-day backdrops for site stills.

The backdrops in ./backdrops are generated rooms with no people in them. Only the
screens are replaced, and only with real captures from `npm run replay:capture`:

  frost   HUD render (hud-shot.mjs) on the TV       -> site/public/images/frost-hud.jpg
  hero    field plate + HUD inside the existing TV  -> site/public/images/hero-living-room.jpg

The TVs are straightened to axis-aligned glass before the HUD is placed, so the
overlay sits flat (no 8-parameter perspective warp). The composite is built at 2x
and downscaled so the 20px ticker stays sharp. See docs/marketing/stills.md.

Hero keeps the published room (lime glow, laptop, chips, bezel) and replaces only
the glass. The picture is scripts/marketing/backdrops/tv-field-plate.png, cover-fit,
dimmed 10%, with the real overlay HUD (preset 3, lower corners) on top. Swap that
plate in place and rerun:

  python3 scripts/marketing/compose.py hero
  python3 scripts/marketing/compose.py frost --hud hud-tv.png
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


def render_hero_hud(out: Path) -> None:
    """Capture preset 3 from the real overlay (render-hero-hud.mjs + hud-shot.mjs)."""
    script = Path(__file__).resolve().parent / "render-hero-hud.mjs"
    subprocess.run(["node", str(script), str(out), "3"], cwd=ROOT, check=True)


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
    parser.add_argument("--hud", type=Path, help="transparent 1920x1080 HUD render (hud-shot.mjs). Hero renders one when omitted.")
    parser.add_argument("--plate", type=Path, help=f"hero TV picture (default {FIELD_PLATE.name})")
    parser.add_argument("--base", type=Path, help="published hero to keep outside the glass (default site hero)")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    if args.shot == "frost":
        if not args.hud:
            parser.error("frost needs --hud")
        image = frost(args.hud)
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

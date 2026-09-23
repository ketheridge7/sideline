#!/usr/bin/env python3
"""Composite real Sideline captures onto the game-day backdrops for site stills.

The backdrops in ./backdrops are generated rooms with no people in them. Only the
screens are replaced, and only with real captures from `npm run replay:capture`:

  frost   HUD render (hud-shot.mjs) on the TV       -> site/public/images/frost-hud.jpg
  hero    same HUD on the TV + Scoreboard on laptop  -> site/public/images/hero-living-room.jpg

Capture the HUD and the Scoreboard in the same poll so both surfaces show the same
score. See docs/marketing/stills.md.

  python3 scripts/marketing/compose.py frost --hud hud-tv.png
  python3 scripts/marketing/compose.py hero --hud hud-tv.png --board board.png
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
BACKDROPS = Path(__file__).resolve().parent / "backdrops"
IMAGES = ROOT / "site" / "public" / "images"
OUT_SIZE = (1600, 900)

Quad = list[tuple[float, float]]

# Screen corners (TL, TR, BR, BL) measured on the 1280x720 backdrops, just inside the bezel.
FROST_TV: Quad = [(365, 114), (915, 114), (915, 416), (365, 416)]
FROST_CROP = (250, 55, 1030, 494)
HERO_TV: Quad = [(258, 86), (741, 98), (741, 364), (258, 369)]
HERO_LAPTOP: Quad = [(826, 402), (1037, 402), (1037, 526), (825, 521)]

BROADCAST_DIM = 0.2
LAPTOP_DIM = 0.12


def perspective_coeffs(dst: Quad, src: Quad) -> list[float]:
    rows, rhs = [], []
    for (x, y), (u, v) in zip(dst, src):
        rows.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        rhs.append(u)
        rows.append([0, 0, 0, x, y, 1, -v * x, -v * y])
        rhs.append(v)
    return np.linalg.solve(np.array(rows, float), np.array(rhs, float)).tolist()


def place(base: Image.Image, layer: Image.Image, quad: Quad, dim: float = 0.0, soften: float = 0.0) -> None:
    w, h = layer.size
    src: Quad = [(0, 0), (w, 0), (w, h), (0, h)]
    warped = layer.transform(base.size, Image.PERSPECTIVE, perspective_coeffs(quad, src), Image.BICUBIC)
    if soften:
        warped = warped.filter(ImageFilter.GaussianBlur(soften))
    if dim:
        shade = Image.new("RGBA", base.size, (0, 0, 0, 255))
        shade.putalpha(warped.getchannel("A").point(lambda a: int(a * dim)))
        warped.alpha_composite(shade)
    base.alpha_composite(warped)


def dim_broadcast(base: Image.Image, quad: Quad) -> Image.Image:
    """Knock the TV picture down a touch so frost type reads over bright grass."""
    mask = Image.new("L", base.size, 0)
    ImageDraw.Draw(mask).polygon(quad, fill=255)
    dimmed = Image.blend(base, Image.new("RGBA", base.size, (6, 10, 8, 255)), BROADCAST_DIM)
    return Image.composite(dimmed, base, mask)


def scaled(quad: Quad, sx: float, sy: float, ox: float = 0, oy: float = 0) -> Quad:
    return [((x - ox) * sx, (y - oy) * sy) for x, y in quad]


def frost(hud: Path) -> Image.Image:
    room = Image.open(BACKDROPS / "gameday-tv.png").convert("RGBA")
    x0, y0, x1, y1 = FROST_CROP
    base = room.crop(FROST_CROP).resize(OUT_SIZE, Image.LANCZOS)
    tv = scaled(FROST_TV, OUT_SIZE[0] / (x1 - x0), OUT_SIZE[1] / (y1 - y0), x0, y0)
    base = dim_broadcast(base, tv)
    place(base, Image.open(hud).convert("RGBA"), tv)
    return base


def hero(hud: Path, board: Path) -> Image.Image:
    room = Image.open(BACKDROPS / "gameday-dual.png").convert("RGBA")
    sx, sy = OUT_SIZE[0] / room.width, OUT_SIZE[1] / room.height
    base = room.resize(OUT_SIZE, Image.LANCZOS)
    tv = scaled(HERO_TV, sx, sy)
    base = dim_broadcast(base, tv)
    place(base, Image.open(hud).convert("RGBA"), tv)
    place(base, Image.open(board).convert("RGBA"), scaled(HERO_LAPTOP, sx, sy), dim=LAPTOP_DIM, soften=0.35)
    return base


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("shot", choices=["frost", "hero"])
    parser.add_argument("--hud", type=Path, required=True, help="transparent 1920x1080 HUD render (hud-shot.mjs)")
    parser.add_argument("--board", type=Path, help="1600x900 Scoreboard capture (hero only)")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    if args.shot == "frost":
        image = frost(args.hud)
        out = args.out or IMAGES / "frost-hud.jpg"
    else:
        if not args.board:
            parser.error("hero needs --board")
        image = hero(args.hud, args.board)
        out = args.out or IMAGES / "hero-living-room.jpg"
    image.convert("RGB").save(out, quality=88, optimize=True, progressive=True)
    print(f"wrote {out} {image.size}")


if __name__ == "__main__":
    main()

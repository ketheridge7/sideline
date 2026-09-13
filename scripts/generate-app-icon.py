#!/usr/bin/env python3
"""Rasterize Sideline theme A icons: charcoal field, ice-green stripe, white S."""

from __future__ import annotations

import io
import re
import struct
import sys
import tempfile
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from fontTools.misc.transform import Transform
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

try:
    from icnsutil import IcnsFile
except ImportError:
    IcnsFile = None

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "build"

CHARCOAL = (0x12, 0x14, 0x1A, 255)
ICE = (0xA6, 0xE6, 0xA0, 255)
FROST = (0xF4, 0xF6, 0xF8, 255)
WHITE = (255, 255, 255, 255)

MASTER = 1024
STRIPE_RATIO = 0.125
FONT_URL = (
    "https://github.com/google/fonts/raw/main/ofl/barlowcondensed/"
    "BarlowCondensed-ExtraBold.ttf"
)
ICO_SIZES = (16, 24, 32, 48, 64, 128, 256)
ICNS_MEDIA = (
    (16, "icp4"),
    (32, "icp5"),
    (128, "ic07"),
    (256, "ic08"),
    (512, "ic09"),
    (1024, "ic10"),
    (32, "ic11"),
    (64, "ic12"),
    (256, "ic13"),
    (512, "ic14"),
)


def load_font_path() -> Path:
    cached = Path("/tmp/BarlowCondensed-ExtraBold.ttf")
    if cached.is_file() and cached.stat().st_size > 1000:
        return cached
    print("Downloading Barlow Condensed ExtraBold…", file=sys.stderr)
    urllib.request.urlretrieve(FONT_URL, cached)
    return cached


def glyph_bounds(font_path: Path) -> tuple[int, int, int, int]:
    font = TTFont(font_path)
    g = font["glyf"]["S"]
    return g.xMin, g.yMin, g.xMax, g.yMax


def s_transform(size: int) -> Transform:
    """Map font-space S (y-up) into the icon field to the right of the stripe."""
    x_min, y_min, x_max, y_max = glyph_bounds(load_font_path())
    gw, gh = x_max - x_min, y_max - y_min
    stripe = round(size * STRIPE_RATIO)
    pad_y = size * 0.16
    target_h = size - 2 * pad_y
    scale = target_h / gh
    tw = gw * scale
    field_cx = stripe + (size - stripe) / 2
    tx = field_cx - tw / 2
    ty = (size - target_h) / 2
    return Transform(scale, 0, 0, -scale, -x_min * scale + tx, y_max * scale + ty)


def svg_path() -> str:
    font = TTFont(load_font_path())
    gs = font.getGlyphSet()
    pen = SVGPathPen(gs)
    gs["S"].draw(TransformPen(pen, s_transform(MASTER)))
    return re.sub(
        r"-?\d+\.\d+",
        lambda match: f"{float(match.group()):.1f}",
        pen.getCommands(),
    )


def write_svg(path: Path) -> None:
    stripe = round(MASTER * STRIPE_RATIO)
    path.write_text(
        (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {MASTER} {MASTER}">\n'
            f'  <rect width="{MASTER}" height="{MASTER}" fill="#12141A"/>\n'
            f'  <rect width="{stripe}" height="{MASTER}" fill="#A6E6A0"/>\n'
            f'  <path fill="#F4F6F8" d="{svg_path()}"/>\n'
            "</svg>\n"
        ),
        encoding="utf-8",
    )


def render(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), CHARCOAL)
    draw = ImageDraw.Draw(img)
    stripe = 2 if size <= 16 else max(2, round(size * STRIPE_RATIO))
    draw.rectangle((0, 0, stripe - 1, size - 1), fill=ICE)

    x_min, y_min, x_max, y_max = glyph_bounds(load_font_path())
    gw, gh = x_max - x_min, y_max - y_min
    pad_y = size * (0.14 if size <= 32 else 0.16)
    target_h = size - 2 * pad_y
    font_px = max(8, round(target_h * 1000 / gh))
    font = ImageFont.truetype(str(load_font_path()), font_px)
    fill = WHITE if size <= 32 else FROST
    bbox = draw.textbbox((0, 0), "S", font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    field_cx = stripe + (size - stripe) / 2
    x = field_cx - tw / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1]
    draw.text((x, y), "S", font=font, fill=fill)
    return img


def write_ico(path: Path, images: list[Image.Image]) -> None:
    payloads: list[bytes] = []
    for im in images:
        buf = io.BytesIO()
        im.convert("RGBA").save(buf, format="PNG")
        payloads.append(buf.getvalue())

    offset = 6 + 16 * len(images)
    out = io.BytesIO()
    out.write(struct.pack("<HHH", 0, 1, len(images)))
    cursor = offset
    for im, payload in zip(images, payloads):
        w, h = im.size
        out.write(
            struct.pack(
                "<BBBBHHII",
                0 if w >= 256 else w,
                0 if h >= 256 else h,
                0,
                0,
                1,
                32,
                len(payload),
                cursor,
            )
        )
        cursor += len(payload)
    for payload in payloads:
        out.write(payload)
    path.write_bytes(out.getvalue())


def write_icns(path: Path, master: Image.Image) -> None:
    if IcnsFile is None:
        print("icnsutil not installed; skipping icon.icns", file=sys.stderr)
        return

    icns = IcnsFile()
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        for size, key in ICNS_MEDIA:
            png = tmp_path / f"{key}.png"
            master.resize((size, size), Image.Resampling.LANCZOS).save(png)
            icns.add_media(key=key, file=str(png))
        icns.write(str(path))


def main() -> None:
    BUILD.mkdir(parents=True, exist_ok=True)
    write_svg(BUILD / "icon.svg")
    master = render(MASTER)
    master.save(BUILD / "icon.png", format="PNG")
    icos = [render(s) if s <= 32 else master.resize((s, s), Image.Resampling.LANCZOS) for s in ICO_SIZES]
    write_ico(BUILD / "icon.ico", icos)
    write_icns(BUILD / "icon.icns", master)
    print("Wrote", BUILD / "icon.svg")
    print("Wrote", BUILD / "icon.png")
    print("Wrote", BUILD / "icon.ico")
    if (BUILD / "icon.icns").exists():
        print("Wrote", BUILD / "icon.icns")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Derive packaging PNG / Windows .ico / Mac .icns from the locked broadcast S.

Does not invent artwork. Master is build/broadcast-s.svg (fallback:
build/broadcast-s.png) — solid lime #B6FF3B S on black. Writes build/icon.png,
then icon.ico (16/24/32/48/64/128/256) and icon.icns.
"""

from __future__ import annotations

import io
import struct
import sys
import tempfile
from pathlib import Path

from PIL import Image

try:
    from icnsutil import IcnsFile
except ImportError:
    IcnsFile = None

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "build"
BROADCAST_SVG = BUILD / "broadcast-s.svg"
BROADCAST_PNG = BUILD / "broadcast-s.png"
MASTER_PNG = BUILD / "icon.png"
MASTER_SIZE = 1024
BLACK = (0, 0, 0, 255)

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


def composite_on_black(mark: Image.Image, size: int) -> Image.Image:
    fitted = mark.convert("RGBA")
    if fitted.size != (size, size):
        fitted = fitted.resize((size, size), Image.Resampling.LANCZOS)
    bg = Image.new("RGBA", (size, size), BLACK)
    bg.alpha_composite(fitted)
    return bg


def load_broadcast_master() -> Image.Image:
    if BROADCAST_SVG.is_file():
        try:
            import cairosvg

            raw = cairosvg.svg2png(
                url=str(BROADCAST_SVG), output_width=MASTER_SIZE, output_height=MASTER_SIZE
            )
            return composite_on_black(Image.open(io.BytesIO(raw)), MASTER_SIZE)
        except Exception as err:
            print(f"cairosvg rasterize skipped ({err}); using {BROADCAST_PNG}", file=sys.stderr)
    if not BROADCAST_PNG.is_file():
        sys.exit(f"missing broadcast master {BROADCAST_SVG} / {BROADCAST_PNG}")
    return composite_on_black(Image.open(BROADCAST_PNG), MASTER_SIZE)


def main() -> None:
    master = load_broadcast_master()
    if master.size[0] != master.size[1]:
        sys.exit(f"master must be square, got {master.size}")
    master.save(MASTER_PNG, format="PNG")
    icos = [master.resize((size, size), Image.Resampling.LANCZOS) for size in ICO_SIZES]
    write_ico(BUILD / "icon.ico", icos)
    write_icns(BUILD / "icon.icns", master)
    print("Wrote", MASTER_PNG, "from broadcast S")
    print("Wrote", BUILD / "icon.ico", "sizes", ",".join(str(s) for s in ICO_SIZES))
    if (BUILD / "icon.icns").exists():
        print("Wrote", BUILD / "icon.icns")


if __name__ == "__main__":
    main()

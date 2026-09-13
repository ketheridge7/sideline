#!/usr/bin/env python3
"""Derive Windows .ico and Mac .icns from the committed theme A master PNG.

Does not invent artwork. Edit build/icon.svg (vector) / build/icon.png (master),
then run this script to refresh icon.ico and icon.icns.
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
MASTER_PNG = BUILD / "icon.png"

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


def main() -> None:
    if not MASTER_PNG.is_file():
        sys.exit(f"missing master {MASTER_PNG}")
    master = Image.open(MASTER_PNG).convert("RGBA")
    if master.size[0] != master.size[1]:
        sys.exit(f"master must be square, got {master.size}")
    icos = [master.resize((size, size), Image.Resampling.LANCZOS) for size in ICO_SIZES]
    write_ico(BUILD / "icon.ico", icos)
    write_icns(BUILD / "icon.icns", master)
    print("Wrote", BUILD / "icon.ico", "from", MASTER_PNG)
    if (BUILD / "icon.icns").exists():
        print("Wrote", BUILD / "icon.icns")


if __name__ == "__main__":
    main()

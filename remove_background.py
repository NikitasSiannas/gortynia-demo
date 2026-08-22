"""
Remove the background from one or more images, saving transparent PNGs.

Setup (once):
    pip install rembg pillow

Usage:
    python remove_background.py public/disco_ball.png public/bouzouki.png

Each input "name.ext" produces "name_nobg.png" next to it.
"""

from __future__ import annotations

import sys
from pathlib import Path

from rembg import remove
from PIL import Image


def remove_background(input_path: Path) -> Path:
    output_path = input_path.with_name(f"{input_path.stem}_nobg.png")
    image = Image.open(input_path)
    result = remove(image)
    result.save(output_path)
    return output_path


def main(argv: list[str]) -> int:
    if not argv:
        print("Usage: python remove_background.py <image1> [image2 ...]")
        return 1

    for arg in argv:
        input_path = Path(arg)
        if not input_path.exists():
            print(f"Skipping {input_path}: file not found")
            continue
        output_path = remove_background(input_path)
        print(f"{input_path} -> {output_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

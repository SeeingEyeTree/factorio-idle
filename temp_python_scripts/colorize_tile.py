"""
colorize_tile.py
----------------
Recolour any grayscale-ish tile image using a target RGB value.

Usage:
    python colorize_tile.py --input <image> --r R --g G --b B [--output <path>]
    python colorize_tile.py --input <image> --hex RRGGBB [--output <path>]
    python colorize_tile.py --input <image> --name <name> [--output <path>]

    If --output is omitted the result is saved next to the input file with
    the colour name or hex appended, e.g. concrete_tile_cropped_FF8800.png

Examples:
    python colorize_tile.py --input data/map_imgs/concrete_tile_cropped.png --hex FF8800
    python colorize_tile.py --input data/map_imgs/concrete_tile_cropped.png --r 255 --g 140 --b 0 --name orange
    python colorize_tile.py --input data/map_imgs/concrete_tile_cropped.png --name purple

Built-in named colours (use with --name):
    red, green, black, white, blue, pink, teal,
    orange, yellow, purple, brown
"""

import os
import sys
import argparse
import numpy as np
from PIL import Image

NAMED_COLOURS = {
    "red":    (200,  60,  50),
    "green":  ( 55, 160,  55),
    "black":  ( 40,  40,  42),
    "white":  (230, 230, 232),
    "blue":   ( 50,  90, 200),
    "pink":   (220,  90, 160),
    "teal":   ( 45, 170, 160),
    "orange": (220, 120,  30),
    "yellow": (210, 190,  40),
    "purple": (130,  50, 200),
    "brown":  (130,  75,  35),
}


def colorize(img_rgb, tint_r, tint_g, tint_b):
    arr = np.array(img_rgb, dtype=float)
    luma = 0.299 * arr[:,:,0] + 0.587 * arr[:,:,1] + 0.114 * arr[:,:,2]
    ref = luma.mean()
    s = 1.0 / max(ref, 1.0)
    out = np.zeros(arr.shape[:2] + (3,), dtype=np.uint8)
    out[:,:,0] = np.clip(luma * tint_r * s, 0, 255)
    out[:,:,1] = np.clip(luma * tint_g * s, 0, 255)
    out[:,:,2] = np.clip(luma * tint_b * s, 0, 255)
    return Image.fromarray(out)


def main():
    parser = argparse.ArgumentParser(description="Recolour a tile image")
    parser.add_argument("--input",  required=True, help="Source image path")
    parser.add_argument("--output", default=None,  help="Output path (optional)")
    parser.add_argument("--r",    type=int, default=None, help="Red   0-255")
    parser.add_argument("--g",    type=int, default=None, help="Green 0-255")
    parser.add_argument("--b",    type=int, default=None, help="Blue  0-255")
    parser.add_argument("--hex",  default=None, help="Hex colour e.g. FF8800")
    parser.add_argument("--name", default=None,
                        help="Named colour: " + ", ".join(NAMED_COLOURS.keys()))
    parser.add_argument("--batch", action="store_true",
                        help="Generate all named colours at once")
    args = parser.parse_args()

    img = Image.open(args.input).convert("RGB")
    base = os.path.splitext(args.input)[0]

    if args.batch:
        print("Generating all " + str(len(NAMED_COLOURS)) + " named colours...")
        for name, (r, g, b) in NAMED_COLOURS.items():
            result = colorize(img, r, g, b)
            out_path = base + "_" + name + ".png"
            result.save(out_path)
            print("  Saved: " + out_path)
        return

    # Resolve colour
    if args.name:
        name = args.name.lower()
        if name not in NAMED_COLOURS:
            print("Unknown colour '" + name + "'. Available: " + ", ".join(NAMED_COLOURS.keys()))
            sys.exit(1)
        r, g, b = NAMED_COLOURS[name]
        label = name
    elif args.hex:
        h = args.hex.lstrip("#")
        r = int(h[0:2], 16)
        g = int(h[2:4], 16)
        b = int(h[4:6], 16)
        label = h.upper()
    elif args.r is not None and args.g is not None and args.b is not None:
        r, g, b = args.r, args.g, args.b
        label = "%d_%d_%d" % (r, g, b)
    else:
        print("Provide --name, --hex, or --r/--g/--b values.")
        sys.exit(1)

    result = colorize(img, r, g, b)

    out_path = args.output if args.output else base + "_" + label + ".png"
    result.save(out_path)
    print("Saved: " + out_path + "  (RGB " + str(r) + "," + str(g) + "," + str(b) + ")")


if __name__ == "__main__":
    main()

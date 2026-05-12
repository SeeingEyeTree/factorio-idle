"""
compose_map.py
--------------
Generates 5 color variants of ore_patch.jpeg and composites 3 of them
onto the grass map at hardcoded tile positions.

The ore patch background (cream ~rgb(238,235,226)) is masked out so only
the rocks are drawn over the grass tiles.

Usage:
    python compose_map.py [options]

    --grass       Path to grass map PNG  (default: grass_map.png)
    --ore         Path to ore patch JPEG (default: data/map_imgs/ore_patch.jpeg)
    --variant     Which color to use: silver|gray|black|dark_green|copper
                  (default: copper)
    --output      Output PNG path        (default: grass_map_composed.png)
    --save-variants  Also save each variant image to data/map_imgs/
"""

import os
import argparse
import numpy as np
from PIL import Image

# ── Ore patch color variants ───────────────────────────────────────────────────
# Each entry is the target midtone RGB colour. Darker image areas will be
# proportionally darker; lighter areas proportionally lighter.
VARIANTS = {
    "silver":     (190, 200, 215),   # cool blue-silver
    "gray":       (155, 155, 158),   # neutral mid-gray
    "black":      ( 55,  52,  58),   # near-black with slight cool tint
    "dark_green": ( 55, 115,  60),   # dark forest green
    "copper":     (205, 128,  52),   # warm copper / bronze
}

# ── Tile grid parameters (must match generate_grid.py) ────────────────────────
TILE_SIZE = 30
GAP       = 1
CELL      = TILE_SIZE + GAP   # 31 px per grid cell

# ── Ore patch display size on the map ─────────────────────────────────────────
ORE_W = 30   # width of each composited patch in pixels (1 tile)
ORE_H = 30   # height

# ── Hardcoded patch positions: list of (row, col, variant) ────────────────────
# Tiles are 0-indexed on a 15x15 grid.
PATCH_TILES = [
    (4,  7, "copper"),
    (5,  5, "silver"),
    (5,  7, "gray"),
    (7,  6, "black"),
    (10, 9, "dark_green"),   # bottom-right — green as requested
]

# ── Background removal threshold ──────────────────────────────────────────────
# Pixels where ALL channels are above this value are treated as background
BG_THRESHOLD = 210


def remove_background(ore_rgb):
    """Return RGBA array with the cream background made transparent."""
    arr = ore_rgb.astype(np.float32)
    # Background detection: high brightness, low saturation (cream/off-white)
    r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    min_ch = np.minimum(np.minimum(r, g), b)
    is_bg = min_ch > BG_THRESHOLD

    # Smooth the mask slightly at edges (soft fade over ~10 pixel range)
    alpha = np.where(is_bg, 0.0, 255.0)
    # Partial transparency for near-background pixels (soft edges)
    near_bg = (min_ch > BG_THRESHOLD - 30) & (~is_bg)
    alpha[near_bg] = ((min_ch[near_bg] - (BG_THRESHOLD - 30)) / 30.0)
    alpha[near_bg] = (1.0 - alpha[near_bg]) * 255.0

    rgba = np.zeros((*arr.shape[:2], 4), dtype=np.uint8)
    rgba[:,:,:3] = ore_rgb
    rgba[:,:,3]  = np.clip(alpha, 0, 255).astype(np.uint8)
    return rgba


def colorize(rgba, tint_rgb):
    """
    Recolour the ore patch by converting it to grayscale then applying a
    colour tint. The alpha channel is preserved unchanged.
    """
    r, g, b = rgba[:,:,0].astype(float), rgba[:,:,1].astype(float), rgba[:,:,2].astype(float)
    # Perceptual grayscale luminance
    luma = 0.299 * r + 0.587 * g + 0.114 * b

    # Reference brightness: the average non-background pixel brightness
    mask = rgba[:,:,3] > 30
    ref  = luma[mask].mean() if mask.any() else 128.0

    tr, tg, tb = tint_rgb
    # Scale each channel so that luma==ref maps to the tint colour
    scale = 1.0 / max(ref, 1.0)
    new_r = np.clip(luma * tr * scale, 0, 255)
    new_g = np.clip(luma * tg * scale, 0, 255)
    new_b = np.clip(luma * tb * scale, 0, 255)

    out = rgba.copy()
    out[:,:,0] = new_r.astype(np.uint8)
    out[:,:,1] = new_g.astype(np.uint8)
    out[:,:,2] = new_b.astype(np.uint8)
    return out


def make_variant(ore_rgb, tint_rgb, size):
    """Full pipeline: remove bg -> colorize -> resize."""
    rgba   = remove_background(ore_rgb)
    tinted = colorize(rgba, tint_rgb)
    img    = Image.fromarray(tinted, "RGBA")
    img    = img.resize(size, Image.LANCZOS)
    return img


def tile_center(row, col):
    """Pixel coordinate of the centre of tile (row, col) in the grass map."""
    x = col * CELL + TILE_SIZE // 2
    y = row * CELL + TILE_SIZE // 2
    return x, y


def paste_ore(canvas, ore_rgba_img, row, col):
    """Paste one ore patch centred on tile (row, col)."""
    cx, cy = tile_center(row, col)
    x = cx - ore_rgba_img.width  // 2
    y = cy - ore_rgba_img.height // 2
    # Use the alpha channel as paste mask
    canvas.paste(ore_rgba_img, (x, y), mask=ore_rgba_img)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--grass",         default="grass_map.png")
    parser.add_argument("--ore",           default=os.path.join("data", "map_imgs", "ore_patch.jpeg"))
    parser.add_argument("--variant",       default="copper",
                        choices=list(VARIANTS.keys()))
    parser.add_argument("--output",        default="grass_map_composed.png")
    parser.add_argument("--save-variants", action="store_true",
                        help="Save all 5 variant PNGs to data/map_imgs/")
    args = parser.parse_args()

    # Load source images
    grass_img  = Image.open(args.grass).convert("RGB")
    ore_rgb    = np.array(Image.open(args.ore).convert("RGB"))
    blank_tile = Image.open(os.path.join("tiles_unique", "tile_r02_c02.png")).convert("RGB").resize((TILE_SIZE, TILE_SIZE), Image.LANCZOS)

    print("Generating ore patch variants...")
    variant_imgs = {}
    for name, tint in VARIANTS.items():
        img = make_variant(ore_rgb, tint, (ORE_W, ORE_H))
        variant_imgs[name] = img
        print("  " + name)

    if args.save_variants:
        out_dir = os.path.join("data", "map_imgs")
        os.makedirs(out_dir, exist_ok=True)
        for name, img in variant_imgs.items():
            path = os.path.join(out_dir, "ore_patch_" + name + ".png")
            img.save(path)
            print("  Saved " + path)

    # Composite onto grass map
    canvas = grass_img.copy()

    print("Compositing " + str(len(PATCH_TILES)) + " patches onto " + args.grass + "...")
    for row, col, variant in PATCH_TILES:
        print("  (" + str(row) + ", " + str(col) + ") -> " + variant)
        # First stamp a clean blank grass tile, then overlay the ore
        canvas.paste(blank_tile, (col * CELL, row * CELL))
        paste_ore(canvas, variant_imgs[variant], row, col)

    canvas.save(args.output)
    print("Saved -> " + args.output)


if __name__ == "__main__":
    main()

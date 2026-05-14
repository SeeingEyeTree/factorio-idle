"""
generate_walls.py
-----------------
Generates wall tile images (30x30 RGBA PNG) for the map.

Wall thickness per level:
  20% -> 2 px
  40% -> 4 px
  60% -> 6 px
  80% -> 6 px main wall + 2 px gap + 2 px dragon's teeth (alternating rows)

Walls are flush with the RIGHT edge of the tile. The script rotates
to produce bottom/left/top variants as well, plus 4 corner pieces per level.

Each tile has light wear applied: brightness noise, a few dark crack pixels,
and ~10% inner-edge pixel erosion.

Output files saved to data/map_imgs/ (32 files total):
  wall_right_20.png   wall_bottom_20.png   wall_left_20.png   wall_top_20.png
  wall_corner_br_20.png  wall_corner_tr_20.png
  wall_corner_bl_20.png  wall_corner_tl_20.png
  ... same for 40, 60, 80 ...

Usage:
    python generate_walls.py [--seed N] [--output-dir data/map_imgs]
"""

import os
import argparse
import numpy as np
from PIL import Image

TILE_SIZE  = 30
BASE_RGB   = (148, 148, 152)   # mid-gray with slight cool tint

# Thickness of the main wall strip per level (px, from right edge)
THICKNESS = {20: 2, 40: 4, 60: 6, 80: 6}

# Dragon-teeth params (level 80 only)
TEETH_GAP = 2       # transparent gap between main wall and teeth
TEETH_W   = 2       # width of teeth strip (px)
TEETH_PERIOD = 3    # rows per on/off cycle half


def make_right_mask(level, size=TILE_SIZE):
    """
    Boolean mask (size x size) for a right-edge wall.
    Wall pixels = True, transparent pixels = False.

    For level 80, layout from right (outer/enemy side) to left (inner/base side):
        teeth (2 px, alternating rows) | gap (2 px) | main wall (6 px)
    For other levels, a single solid strip flush with the right edge.
    """
    mask = np.zeros((size, size), dtype=bool)

    thickness = THICKNESS[level]

    if level == 80:
        # Teeth at outer (right) edge
        teeth_end   = size
        teeth_start = size - TEETH_W                  # col 28-29
        gap_end     = teeth_start                     # col 28
        gap_start   = gap_end   - TEETH_GAP           # col 26-27
        wall_end    = gap_start                       # col 26
        wall_start  = wall_end  - thickness           # col 20-25

        # Main wall
        mask[:, wall_start:wall_end] = True

        # Teeth (alternating row groups)
        for row in range(size):
            if (row // TEETH_PERIOD) % 2 == 0:
                mask[row, teeth_start:teeth_end] = True
    else:
        wall_start = size - thickness
        mask[:, wall_start:] = True

    return mask


def apply_wear(arr, mask, rng):
    """
    Mutate RGBA array in-place: add brightness noise, erode inner edge,
    paint a few dark crack pixels.
    """
    size = arr.shape[0]

    # -- brightness noise (+/-18) on all wall pixels --------------------------
    noise = rng.integers(-18, 19, size=(size, size), dtype=np.int32)
    for c in range(3):
        ch = arr[:, :, c].astype(np.int32)
        ch[mask] = np.clip(ch[mask] + noise[mask], 0, 255)
        arr[:, :, c] = ch.astype(np.uint8)

    # -- inner-edge erosion (~10%) -------------------------------------------
    # Inner edge = wall pixels whose left neighbour (col-1) is NOT in the mask
    inner = np.zeros((size, size), dtype=bool)
    inner[:, 1:]  = mask[:, 1:]  & ~mask[:, :-1]
    inner[:, 0]   = mask[:, 0]
    inner_coords  = np.argwhere(inner)
    for wy, wx in inner_coords:
        if rng.random() < 0.10:
            arr[wy, wx, 3] = 0   # erode to transparent

    # -- 2-4 dark crack pixels ------------------------------------------------
    wall_coords = np.argwhere(mask)
    if len(wall_coords) > 0:
        n_cracks = int(rng.integers(2, 5))
        for _ in range(n_cracks):
            idx  = int(rng.integers(0, len(wall_coords)))
            wy, wx = wall_coords[idx]
            if arr[wy, wx, 3] > 0:
                arr[wy, wx, :3] = np.clip(
                    arr[wy, wx, :3].astype(np.int32) - 55, 0, 255
                ).astype(np.uint8)


def make_tile(mask, rng):
    """Return a 30x30 RGBA PIL Image for the given boolean mask."""
    size = mask.shape[0]
    arr  = np.zeros((size, size, 4), dtype=np.uint8)

    r, g, b = BASE_RGB
    arr[mask, 0] = r
    arr[mask, 1] = g
    arr[mask, 2] = b
    arr[mask, 3] = 255

    apply_wear(arr, mask, rng)
    return Image.fromarray(arr, "RGBA")


def rotate_mask_cw(mask, steps=1):
    """
    Rotate mask clockwise by 90*steps degrees.
    np.rot90 with k=1 is CCW, so k=(4-steps) gives CW.
    """
    return np.rot90(mask, k=(4 - steps) % 4)


def main():
    parser = argparse.ArgumentParser(description="Generate wall tile images")
    parser.add_argument("--seed",       type=int, default=42)
    parser.add_argument("--output-dir", default=os.path.join("data", "map_imgs"))
    args = parser.parse_args()

    rng = np.random.default_rng(args.seed)
    os.makedirs(args.output_dir, exist_ok=True)

    levels = [20, 40, 60, 80]

    # Direction name -> CW rotation steps from "right"
    dir_rotations = {
        "right":  0,   # original
        "bottom": 1,   # 90 CW  -> strip on bottom
        "left":   2,   # 180    -> strip on left
        "top":    3,   # 270 CW -> strip on top
    }

    # Corner name -> pair of direction names to OR together
    corners = {
        "br": ("bottom", "right"),
        "tr": ("top",    "right"),
        "bl": ("bottom", "left"),
        "tl": ("top",    "left"),
    }

    count = 0

    for level in levels:
        right_mask = make_right_mask(level)
        suffix     = "_" + str(level) + ".png"

        # Compute all 4 direction masks
        dir_masks = {}
        for dname, steps in dir_rotations.items():
            dir_masks[dname] = rotate_mask_cw(right_mask, steps)

        # Straight wall pieces
        for dname, dmask in dir_masks.items():
            img   = make_tile(dmask, rng)
            fname = "wall_" + dname + suffix
            path  = os.path.join(args.output_dir, fname)
            img.save(path)
            print("Saved " + path)
            count += 1

        # Corner pieces
        for cname, (d1, d2) in corners.items():
            combined = dir_masks[d1] | dir_masks[d2]
            img   = make_tile(combined, rng)
            fname = "wall_corner_" + cname + suffix
            path  = os.path.join(args.output_dir, fname)
            img.save(path)
            print("Saved " + path)
            count += 1

    print("Done! Generated " + str(count) + " wall tiles in " + args.output_dir)


if __name__ == "__main__":
    main()

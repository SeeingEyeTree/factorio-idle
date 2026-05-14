"""
generate_grid.py
----------------
Assembles an NxN tile grid semi-randomly. Plain grass tiles appear more
often; similar tiles cluster near each other.

Dirt tiles (low green-to-red ratio) are skipped automatically, so you can
point this at tiles_unique/ even if stale files remain in it.

Usage:
    python generate_grid.py [tile_folder] [output.png] [options]

    --grid N          Grid size NxN (default 11)
    --tile-size PX    Tile size in output (default 30)
    --gap PX          Gap between tiles in px (default 1)
    --temperature T   Similarity clustering strength (default 2; 0 = off)
    --blank-weight W  Probability multiplier for plain grass tiles (default 4)
    --seed S          Random seed for reproducibility
    --no-repeat       Use each tile at most once
"""

import os
import sys
import argparse
import numpy as np
from PIL import Image

DIRT_RATIO = 1.4
BLANK_GRASS_STD_MAX = 65.0

DEFAULT_GRID = 15
DEFAULT_TEMPERATURE = 0.5
DEFAULT_TILE_SIZE = 30
DEFAULT_GAP = 1
DEFAULT_BLANK_WEIGHT = 8.0


def is_dirt(arr):
    r = arr[:, :, 0].mean()
    g = arr[:, :, 1].mean()
    return (g / max(r, 1)) < DIRT_RATIO


def load_tiles(folder, tile_size):
    all_files = sorted(
        f for f in os.listdir(folder)
        if f.lower().endswith(".png") and not f.startswith("_")
    )
    if not all_files:
        print("No PNG tiles found in " + folder)
        sys.exit(1)

    files, arrays, skipped = [], [], 0
    for fname in all_files:
        img = Image.open(os.path.join(folder, fname)).convert("RGB")
        img = img.resize((tile_size, tile_size), Image.LANCZOS)
        arr = np.array(img, dtype=np.float32)
        if is_dirt(arr):
            skipped += 1
            continue
        files.append(fname)
        arrays.append(arr)

    print("Loaded " + str(len(files)) + " tiles from " + folder +
          " (skipped " + str(skipped) + " dirt tiles)")
    return files, arrays


def compute_base_weights(files, arrays, blank_weight, blank_tile=None):
    weights = np.ones(len(arrays), dtype=np.float64)
    if blank_tile:
        # Weight only the explicitly named tile
        for i, fname in enumerate(files):
            if fname == blank_tile:
                weights[i] = blank_weight
                return weights
        print("Warning: --blank-tile '" + blank_tile + "' not found in folder, falling back to auto-detect")
    # Auto-detect: green tiles with low pixel std
    for i, arr in enumerate(arrays):
        r = arr[:, :, 0].mean()
        g = arr[:, :, 1].mean()
        if (g / max(r, 1)) >= DIRT_RATIO and arr.std() <= BLANK_GRASS_STD_MAX:
            weights[i] = blank_weight
    return weights


def build_similarity_matrix(arrays):
    n = len(arrays)
    sim = np.zeros((n, n), dtype=np.float32)
    for i in range(n):
        for j in range(i, n):
            mae = float(np.mean(np.abs(arrays[i] - arrays[j])))
            s = 1.0 / (1.0 + mae)
            sim[i, j] = s
            sim[j, i] = s
    return sim


def generate_grid(n_tiles, sim_matrix, base_weights, grid_size,
                  temperature, allow_repeat, rng):
    grid = np.full((grid_size, grid_size), -1, dtype=int)

    for row in range(grid_size):
        for col in range(grid_size):
            if allow_repeat:
                candidates = np.arange(n_tiles)
            else:
                used = set(grid.flatten()) - {-1}
                candidates = np.array([t for t in range(n_tiles) if t not in used])
                if len(candidates) == 0:
                    candidates = np.arange(n_tiles)

            weights = base_weights[candidates].copy()

            neighbours = []
            if row > 0 and grid[row - 1, col] >= 0:
                neighbours.append(grid[row - 1, col])
            if col > 0 and grid[row, col - 1] >= 0:
                neighbours.append(grid[row, col - 1])

            if neighbours and temperature > 0:
                sim_scores = np.array([
                    np.mean([sim_matrix[t, nb] for nb in neighbours])
                    for t in candidates
                ], dtype=np.float64)
                weights *= sim_scores ** temperature

            total = weights.sum()
            if total == 0:
                weights = np.ones(len(candidates)) / len(candidates)
            else:
                weights /= total

            grid[row, col] = rng.choice(candidates, p=weights)

    return grid


def render_grid(grid, arrays, tile_size, gap):
    gs = grid.shape[0]
    canvas_size = gs * tile_size + (gs - 1) * gap
    canvas = Image.new("RGB", (canvas_size, canvas_size), (50, 50, 50))
    for row in range(gs):
        for col in range(gs):
            tile_img = Image.fromarray(arrays[grid[row, col]].astype(np.uint8))
            x = col * (tile_size + gap)
            y = row * (tile_size + gap)
            canvas.paste(tile_img, (x, y))
    return canvas


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("tile_folder",   nargs="?", default="tiles_unique")
    parser.add_argument("output",        nargs="?", default="grass_map.png")
    parser.add_argument("--grid",         type=int,   default=DEFAULT_GRID)
    parser.add_argument("--tile-size",    type=int,   default=DEFAULT_TILE_SIZE)
    parser.add_argument("--gap",          type=int,   default=DEFAULT_GAP)
    parser.add_argument("--temperature",  type=float, default=DEFAULT_TEMPERATURE)
    parser.add_argument("--blank-weight", type=float, default=DEFAULT_BLANK_WEIGHT)
    parser.add_argument("--blank-tile",   type=str,   default=None,
                        help="Exact filename to weight higher (e.g. tile_r02_c02.png). Overrides auto-detect.")
    parser.add_argument("--seed",         type=int,   default=None)
    parser.add_argument("--no-repeat",    action="store_true")
    args = parser.parse_args()

    rng = np.random.default_rng(args.seed)

    files, arrays = load_tiles(args.tile_folder, args.tile_size)
    base_weights = compute_base_weights(files, arrays, args.blank_weight, args.blank_tile)

    blank_count = int((base_weights > 1).sum())
    print("  Blank-grass tiles : " + str(blank_count) + " (weight x" + str(args.blank_weight) + ")")
    print("  Feature tiles     : " + str(len(files) - blank_count) + " (weight x1)")

    print("Building similarity matrix...")
    sim_matrix = build_similarity_matrix(arrays)

    print("Generating " + str(args.grid) + "x" + str(args.grid) + " grid...")
    grid = generate_grid(
        n_tiles=len(files),
        sim_matrix=sim_matrix,
        base_weights=base_weights,
        grid_size=args.grid,
        temperature=args.temperature,
        allow_repeat=not args.no_repeat,
        rng=rng,
    )

    output_img = render_grid(grid, arrays, args.tile_size, args.gap)
    output_img.save(args.output)
    print("Saved to " + args.output + " (" + str(output_img.width) + "x" + str(output_img.height) + " px)")


if __name__ == "__main__":
    main()

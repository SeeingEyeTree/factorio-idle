"""
deduplicate_tiles.py
--------------------
Removes near-identical tiles from a folder using pixel-level MAE similarity.

Dirt tiles are auto-removed (G/R < 1.4). One blank-grass tile is always
kept regardless of threshold. Use --keep-dirt to disable dirt removal.

Usage:
    python deduplicate_tiles.py [input_folder] [output_folder] [options]

    --threshold N   MAE duplicate threshold, 0-255 (default 8)
    --keep-dirt     Keep dirt tiles
    --preview       Save a _contact_sheet.png of kept tiles
"""

import os
import sys
import shutil
import argparse
import numpy as np
from PIL import Image

DEFAULT_THRESHOLD = 8
DIRT_RATIO = 1.4


def load_tiles(folder):
    files = sorted(
        f for f in os.listdir(folder)
        if f.lower().endswith(".png") and not f.startswith("_")
    )
    if not files:
        print("No PNG files found in " + folder)
        sys.exit(1)
    arrays = []
    for fname in files:
        img = Image.open(os.path.join(folder, fname)).convert("RGB")
        arrays.append(np.array(img, dtype=np.float32))
    return files, arrays


def is_dirt(arr):
    r = arr[:, :, 0].mean()
    g = arr[:, :, 1].mean()
    return (g / max(r, 1)) < DIRT_RATIO


def blank_score(arr):
    if is_dirt(arr):
        return float("-inf")
    return -arr.std()


def mae(a, b):
    return float(np.mean(np.abs(a - b)))


def find_unique(files, arrays, threshold, remove_dirt):
    removed = []

    if remove_dirt:
        clean_f, clean_a = [], []
        for f, a in zip(files, arrays):
            if is_dirt(a):
                removed.append(f + "  [dirt]")
            else:
                clean_f.append(f)
                clean_a.append(a)
        files, arrays = clean_f, clean_a

    if not files:
        print("No tiles left after dirt removal.")
        sys.exit(1)

    # Always keep the most uniform green tile
    blank_idx = int(np.argmax([blank_score(a) for a in arrays]))
    blank_f = files[blank_idx]
    blank_a = arrays[blank_idx]

    pool_f = [f for i, f in enumerate(files) if i != blank_idx]
    pool_a = [a for i, a in enumerate(arrays) if i != blank_idx]

    kept_f = [blank_f]
    kept_a = [blank_a]
    for f, a in zip(pool_f, pool_a):
        if any(mae(a, k) < threshold for k in kept_a):
            removed.append(f)
        else:
            kept_f.append(f)
            kept_a.append(a)

    return kept_f, kept_a, removed


def save_contact_sheet(kept_f, kept_a, output_folder):
    n = len(kept_a)
    cols = min(16, n)
    rows = (n + cols - 1) // cols
    th, tw = kept_a[0].shape[:2]
    pad = 2
    sheet = np.full(((th + pad) * rows + pad, (tw + pad) * cols + pad, 3), 200, dtype=np.uint8)
    for i, arr in enumerate(kept_a):
        r, c = divmod(i, cols)
        y = pad + r * (th + pad)
        x = pad + c * (tw + pad)
        sheet[y:y + th, x:x + tw] = arr.astype(np.uint8)
    path = os.path.join(output_folder, "_contact_sheet.png")
    Image.fromarray(sheet).save(path)
    print("  Contact sheet saved to " + path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input_folder",  nargs="?", default="tiles")
    parser.add_argument("output_folder", nargs="?", default="tiles_unique")
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    parser.add_argument("--keep-dirt", action="store_true")
    parser.add_argument("--preview",   action="store_true")
    args = parser.parse_args()

    print("Loading from " + args.input_folder)
    files, arrays = load_tiles(args.input_folder)
    print("  Found " + str(len(files)) + " tiles")

    print("Deduplicating (threshold=" + str(args.threshold) + ", remove_dirt=" + str(not args.keep_dirt) + ")")
    kept_f, kept_a, removed = find_unique(files, arrays, args.threshold, not args.keep_dirt)

    print("  Kept    : " + str(len(kept_f)) + "  (first = protected blank-grass tile)")
    print("  Removed : " + str(len(removed)))
    for r in removed:
        print("    - " + r)

    os.makedirs(args.output_folder, exist_ok=True)

    # Clear stale tiles from output folder
    for old in os.listdir(args.output_folder):
        if old.lower().endswith(".png"):
            try:
                os.remove(os.path.join(args.output_folder, old))
            except OSError:
                pass

    for fname in kept_f:
        shutil.copy2(
            os.path.join(args.input_folder, fname),
            os.path.join(args.output_folder, fname),
        )

    if args.preview:
        save_contact_sheet(kept_f, kept_a, args.output_folder)

    print("Done! " + str(len(kept_f)) + " tiles written to " + args.output_folder)


if __name__ == "__main__":
    main()
